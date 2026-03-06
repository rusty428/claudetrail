import { readConfig } from '../config';
import { configureHooks } from './init';

export async function upgrade(): Promise<void> {
  const config = readConfig();
  if (!config) {
    console.error('ClaudeTrail is not configured. Run "claudetrail init <api-token>" first.');
    process.exit(1);
  }

  configureHooks();
  console.log('Hook configuration upgraded to multi-hook mode.');
  console.log('All five hooks are now configured: SessionStart, PostToolUse, PostToolUseFailure, Stop, SessionEnd');
}
