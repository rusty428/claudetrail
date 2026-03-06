import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function findTranscript(sessionId: string): string | null {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  // Transcripts are stored as ~/.claude/projects/<project-hash>/<session-id>.jsonl
  try {
    const projectDirs = fs.readdirSync(projectsDir);
    for (const dir of projectDirs) {
      const candidate = path.join(projectsDir, dir, `${sessionId}.jsonl`);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Can't read directory — not a fatal error
  }

  return null;
}
