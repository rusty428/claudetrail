import { readConfig } from '../config';
import { uploadTranscript } from '../utils/uploadTranscript';
import { log } from '../utils/log';

export async function upload(sessionId: string, transcriptPath: string): Promise<void> {
  log('upload-cmd', `started session=${sessionId} path=${transcriptPath}`);

  const config = readConfig();
  if (!config) {
    log('upload-cmd', 'no config found, exiting');
    process.exit(1);
  }

  await uploadTranscript(config.baseUrl, config.apiKey, sessionId, transcriptPath);
  log('upload-cmd', 'finished');
}
