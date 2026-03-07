# claudetrail

Session telemetry collection for [Claude Code](https://claude.ai/code). Captures real-time events and full session transcripts, uploads them to [ClaudeTrail](https://claudetrail.com) for storage and visualization.

## Install

```bash
npm i -g claudetrail
```

## Setup

```bash
claudetrail init <api-token>
```

This does two things:

1. Saves your API token to `~/.claudetrail`
2. Configures hooks in `~/.claude/settings.json` for all five Claude Code hook events

Your token starts with `ct_` — get one from the ClaudeTrail dashboard.

## How It Works

ClaudeTrail uses Claude Code's hook system to capture telemetry with zero impact on your workflow.

### Two-Layer Architecture

**Layer 1 — Event Stream:** Lightweight POSTs to the ClaudeTrail API throughout your session. Every hook event (SessionStart, PostToolUse, PostToolUseFailure, Stop, SessionEnd) fires a small JSON payload with event type, session ID, timestamp, and hook-provided context.

**Layer 2 — Transcript Upload:** At SessionEnd, the full `.jsonl` transcript is uploaded to S3 via a presigned URL. This captures the complete conversation for detailed analysis.

### Hook Events

| Event | What's Captured |
|-------|----------------|
| SessionStart | Session begins — baseline event |
| PostToolUse | Each tool call (tool name, success/failure) |
| PostToolUseFailure | Failed tool calls with error context |
| Stop | Session metrics from `.claude.json` (cost, tokens, duration, model usage, lines changed) |
| SessionEnd | Session complete — triggers transcript upload |

The Stop hook enriches the event with a summary extracted from `~/.claude.json`, including cost, token counts, duration, model breakdown, and lines changed.

## Commands

```
claudetrail init <api-token>   Configure token and hooks
claudetrail hook               Handle hook events (called by Claude Code)
claudetrail collect            Legacy Stop-only handler (backward compat)
claudetrail upgrade            Re-run hook configuration without re-entering token
claudetrail --version          Show version
```

## Configuration

Config is stored at `~/.claudetrail`:

```json
{
  "apiKey": "ct_...",
  "baseUrl": "https://api.claudetrail.com",
  "legacyIngest": true
}
```

### Environment Variables

For CI/headless environments, set these instead of using a config file:

| Variable | Purpose |
|----------|---------|
| `CLAUDETRAIL_API_KEY` | API token (overrides config file) |
| `CLAUDETRAIL_BASE_URL` | API endpoint (default: `https://api.claudetrail.com`) |

### Options

- **legacyIngest**: When `true`, the Stop hook also sends the full `~/.claude.json` snapshot to `/ingest`. This is the v0.1.x behavior, kept for backward compatibility. Will be deprecated in a future version.

## Upgrading

If you installed an earlier version, run:

```bash
claudetrail upgrade
```

This updates your hook configuration to the latest format without requiring you to re-enter your token.

## Technical Details

- Pure Node.js, zero native dependencies
- All network calls are fire-and-forget (events) or presigned URL uploads (transcripts)
- Hook timeouts: 5s for most events, 15s for SessionEnd (transcript upload)
- Config migration: automatically handles v0.1.x `endpoint` field format

## License

MIT
