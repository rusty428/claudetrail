import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LOG_PATH = path.join(os.homedir(), '.claudetrail.log');
const MAX_SIZE = 512 * 1024; // 512KB

function truncateIfNeeded(): void {
  try {
    const stats = fs.statSync(LOG_PATH);
    if (stats.size > MAX_SIZE) {
      // Keep the last half of the file
      const content = fs.readFileSync(LOG_PATH, 'utf-8');
      const lines = content.split('\n');
      const half = Math.floor(lines.length / 2);
      fs.writeFileSync(LOG_PATH, '--- log truncated ---\n' + lines.slice(half).join('\n'), 'utf-8');
    }
  } catch {
    // File doesn't exist yet — that's fine
  }
}

export function log(command: string, message: string): void {
  try {
    truncateIfNeeded();
    const ts = new Date().toISOString();
    fs.appendFileSync(LOG_PATH, `${ts} [${command}] ${message}\n`, 'utf-8');
  } catch {
    // Never let logging break the collector
  }
}

export { LOG_PATH };
