import { readConfig } from '../config';
import { uploadTranscript } from '../utils/uploadTranscript';
import { log } from '../utils/log';

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
  });
}

export async function hook(): Promise<void> {
  log('hook', 'started');

  const config = readConfig();
  if (!config) {
    log('hook', 'no config found, exiting');
    process.exit(0);
  }

  const stdinRaw = await readStdin();
  let input: HookInput = { hook_event_name: '', session_id: '' };
  try {
    input = JSON.parse(stdinRaw);
  } catch {
    log('hook', `stdin parse failed, raw length=${stdinRaw.length}`);
    process.exit(0);
  }

  log('hook', `event=${input.hook_event_name} session=${input.session_id} transcript_path=${input.transcript_path ?? 'none'}`);

  if (input.hook_event_name !== 'SessionEnd' || !input.session_id) {
    log('hook', 'not a SessionEnd event, exiting');
    process.exit(0);
  }

  if (input.transcript_path) {
    await uploadTranscript(config.baseUrl, config.apiKey, input.session_id, input.transcript_path);
  } else {
    log('hook', 'no transcript_path in input, skipping upload');
  }

  log('hook', 'finished');
}
