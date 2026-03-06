import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.claudetrail');
const CLAUDE_JSON_PATH = path.join(os.homedir(), '.claude.json');

interface ClaudeTrailConfig {
  apiKey: string;
  baseUrl: string;
  legacyIngest: boolean;
}

// Stored config may have old `endpoint` field from v0.1.x
interface StoredConfig {
  apiKey: string;
  baseUrl?: string;
  endpoint?: string;
  legacyIngest?: boolean;
}

const DEFAULT_BASE_URL = 'https://api.claudetrail.com';

export function readConfig(): ClaudeTrailConfig | null {
  const envKey = process.env.CLAUDETRAIL_API_KEY;
  if (envKey) {
    return {
      apiKey: envKey,
      baseUrl: process.env.CLAUDETRAIL_BASE_URL || DEFAULT_BASE_URL,
      legacyIngest: true,
    };
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const stored = JSON.parse(raw) as StoredConfig;

    // Migrate from old endpoint format
    let baseUrl = stored.baseUrl;
    if (!baseUrl && stored.endpoint) {
      baseUrl = stored.endpoint.replace(/\/ingest$/, '');
    }

    return {
      apiKey: stored.apiKey,
      baseUrl: baseUrl || DEFAULT_BASE_URL,
      legacyIngest: stored.legacyIngest ?? true,
    };
  } catch {
    return null;
  }
}

export function writeConfig(config: ClaudeTrailConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function readClaudeJson(): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(CLAUDE_JSON_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export { CONFIG_PATH, CLAUDE_JSON_PATH, DEFAULT_BASE_URL };
export type { ClaudeTrailConfig };
