import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { writeConfig, DEFAULT_BASE_URL } from '../config';

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

const HOOK_EVENTS = ['SessionStart', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'SessionEnd'] as const;
const HOOK_TIMEOUTS: Record<string, number> = {
  SessionStart: 5,
  PostToolUse: 5,
  PostToolUseFailure: 5,
  Stop: 5,
  SessionEnd: 15,
};

function readSettings(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  const dir = path.dirname(CLAUDE_SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

function askConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (y/n) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

function hasClaudetrailHook(hookEntries: Record<string, unknown>[]): boolean {
  return hookEntries.some((h: Record<string, unknown>) => {
    const innerHooks = h.hooks as Record<string, unknown>[];
    return innerHooks?.some((ih) => (ih.command as string)?.includes('claudetrail'));
  });
}

function makeHookEntry(timeout: number) {
  return {
    matcher: '',
    hooks: [
      {
        type: 'command',
        command: 'claudetrail hook',
        timeout,
      },
    ],
  };
}

export function configureHooks(): void {
  const settings = readSettings();
  const hooks = (settings.hooks || {}) as Record<string, unknown[]>;

  for (const eventName of HOOK_EVENTS) {
    const existing = (hooks[eventName] || []) as Record<string, unknown>[];

    if (hasClaudetrailHook(existing)) {
      // Upgrade existing entries: replace old `claudetrail collect` with `claudetrail hook`
      // then remove duplicates (keep first claudetrail entry + all non-claudetrail entries)
      let foundClaudetrail = false;
      const deduped: Record<string, unknown>[] = [];
      for (const entry of existing) {
        const innerHooks = entry.hooks as Record<string, unknown>[];
        const isClaudetrail = innerHooks?.some((ih) => (ih.command as string)?.includes('claudetrail'));
        if (isClaudetrail) {
          if (!foundClaudetrail) {
            for (const ih of innerHooks) {
              if ((ih.command as string)?.includes('claudetrail')) {
                ih.command = 'claudetrail hook';
                ih.timeout = HOOK_TIMEOUTS[eventName];
              }
            }
            deduped.push(entry);
            foundClaudetrail = true;
          }
          // Skip duplicates
        } else {
          deduped.push(entry);
        }
      }
      hooks[eventName] = deduped;
    } else {
      existing.push(makeHookEntry(HOOK_TIMEOUTS[eventName]));
      hooks[eventName] = existing;
    }
  }

  settings.hooks = hooks;
  writeSettings(settings);
}

export async function init(token: string): Promise<void> {
  if (!token) {
    console.error('Usage: claudetrail init <api-token>');
    process.exit(1);
  }

  if (!token.startsWith('ct_')) {
    console.error('Invalid token format. Token should start with "ct_".');
    process.exit(1);
  }

  // Write config with baseUrl
  writeConfig({
    apiKey: token,
    baseUrl: DEFAULT_BASE_URL,
    legacyIngest: true,
  });
  console.log('Token saved to ~/.claudetrail');

  // Configure hooks
  const confirmed = await askConfirm('Add ClaudeTrail hooks to Claude Code settings?');
  if (!confirmed) {
    console.log('Skipped hook configuration. Run "claudetrail upgrade" later to add hooks.');
    return;
  }

  configureHooks();
  console.log(`Hooks configured for: ${HOOK_EVENTS.join(', ')}`);
  console.log('ClaudeTrail is now configured.');
}
