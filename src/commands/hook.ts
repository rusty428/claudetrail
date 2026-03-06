import { readConfig, readClaudeJson } from '../config';
import { sendEvent } from '../utils/sendEvent';
import { uploadTranscript } from '../utils/uploadTranscript';
import * as https from 'https';
import * as url from 'url';

interface HookInput {
  hook_event_name: string;
  session_id: string;
  transcript_path?: string;
  [key: string]: unknown;
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 1000);
  });
}

function fireAndForgetIngest(baseUrl: string, apiKey: string, payload: Record<string, unknown>): void {
  const endpoint = `${baseUrl}/ingest`;
  const parsed = new url.URL(endpoint);
  const body = JSON.stringify(payload);

  const req = https.request({
    hostname: parsed.hostname,
    port: 443,
    path: parsed.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-api-key': apiKey,
    },
  });

  req.on('error', () => {});
  req.on('socket', (socket) => { socket.unref(); });
  req.write(body);
  req.end();
}

function extractStopSummary(claudeJson: Record<string, unknown>): Record<string, unknown> {
  const projects = claudeJson.projects as Record<string, Record<string, unknown>> | undefined;
  if (!projects) return {};

  // Get the most recently active project's metrics
  let latestProject: Record<string, unknown> | null = null;
  let latestTime = '';
  for (const proj of Object.values(projects)) {
    const lastActive = proj.lastActiveAt as string || '';
    if (lastActive > latestTime) {
      latestTime = lastActive;
      latestProject = proj;
    }
  }

  if (!latestProject) return {};

  return {
    costUsd: latestProject.totalCost,
    durationMs: latestProject.totalDurationMs,
    apiDurationMs: latestProject.totalApiDurationMs,
    tokensIn: latestProject.totalInputTokens,
    tokensOut: latestProject.totalOutputTokens,
    cacheCreation: latestProject.totalCacheCreationTokens,
    cacheRead: latestProject.totalCacheReadTokens,
    linesAdded: latestProject.linesAdded,
    linesRemoved: latestProject.linesRemoved,
    modelUsage: latestProject.modelUsage,
  };
}

function handleEvent(config: { baseUrl: string; apiKey: string }, input: HookInput): void {
  // Forward the full stdin as payload — capture everything Claude Code sends
  const { hook_event_name, session_id, ...stdinPayload } = input;

  sendEvent(config.baseUrl, config.apiKey, {
    eventType: hook_event_name,
    sessionId: session_id,
    timestamp: new Date().toISOString(),
    payload: stdinPayload,
  });
}

function handleStop(config: { baseUrl: string; apiKey: string; legacyIngest: boolean }, input: HookInput): void {
  const claudeJson = readClaudeJson();
  const { hook_event_name, session_id, ...stdinPayload } = input;

  // Enrich Stop event with .claude.json summary
  const summary = claudeJson ? extractStopSummary(claudeJson) : {};

  sendEvent(config.baseUrl, config.apiKey, {
    eventType: 'Stop',
    sessionId: session_id,
    timestamp: new Date().toISOString(),
    payload: {
      ...stdinPayload,
      summary,
    },
  });

  // Optionally send full snapshot to /ingest (legacy mode)
  if (config.legacyIngest && claudeJson) {
    fireAndForgetIngest(config.baseUrl, config.apiKey, {
      sessionId: session_id,
      cwd: input.cwd,
      claudeJson,
      collectorVersion: '0.2.0',
      collectedAt: new Date().toISOString(),
    });
  }
}

async function handleSessionEnd(config: { baseUrl: string; apiKey: string }, input: HookInput): Promise<void> {
  const { hook_event_name, session_id, ...stdinPayload } = input;

  sendEvent(config.baseUrl, config.apiKey, {
    eventType: 'SessionEnd',
    sessionId: session_id,
    timestamp: new Date().toISOString(),
    payload: stdinPayload,
  });

  // Upload transcript — use transcript_path from stdin if available
  const transcriptPath = input.transcript_path;
  if (transcriptPath) {
    await uploadTranscript(config.baseUrl, config.apiKey, session_id, transcriptPath);
  }
}

export async function hook(): Promise<void> {
  const config = readConfig();
  if (!config) {
    process.exit(0);
  }

  const stdinRaw = await readStdin();
  let input: HookInput = { hook_event_name: '', session_id: '' };
  try {
    input = JSON.parse(stdinRaw);
  } catch {
    process.exit(0);
  }

  if (!input.hook_event_name || !input.session_id) {
    process.exit(0);
  }

  switch (input.hook_event_name) {
    case 'Stop':
      handleStop(config, input);
      break;
    case 'SessionEnd':
      await handleSessionEnd(config, input);
      break;
    default:
      handleEvent(config, input);
      break;
  }
}
