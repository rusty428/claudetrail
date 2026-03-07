# claudetrail

The hosted dashboard for [Claude Code](https://claude.ai/code). See your usage, costs, and session activity — no Grafana, no Datadog, no infrastructure.

ClaudeTrail leverages Claude Code's built-in OpenTelemetry telemetry for metrics and events, and adds full session transcript capture for session replay and analysis.

## Install

```bash
npm i -g claudetrail
```

## Setup

```bash
claudetrail init <api-token>
```

This does two things:

1. Configures Claude Code's OpenTelemetry to export to ClaudeTrail (writes env vars to `~/.claude/settings.json`)
2. Registers a SessionEnd hook for transcript upload

Your token starts with `ct_` — get one from the ClaudeTrail dashboard.

That's it. Start a Claude Code session and data flows automatically.

## How It Works

### Two Channels

**OTel (native, zero overhead):** Claude Code's built-in OpenTelemetry exporter streams metrics and events directly to ClaudeTrail. Cost tracking, token usage, tool activity, session timing — all captured without any hook overhead.

**Transcripts (SessionEnd hook):** At session end, the full `.jsonl` conversation transcript is uploaded to ClaudeTrail via presigned S3 URL. This enables session replay and analysis that pure metrics can't provide.

### What's Captured via OTel

| Category | Data |
|----------|------|
| Cost | USD per model, per session |
| Tokens | Input, output, cache read, cache creation — by model |
| Tools | Every tool call with duration, success/failure, decision source |
| Sessions | Count, active time (user vs CLI) |
| Code | Lines added/removed, commits, PRs |
| API | Every API request with latency, tokens, model |

### What's Captured via Transcripts

Full conversation history — every prompt and response in the session. Enables session replay, sentiment analysis, and understanding *why* costs were incurred.

## Commands

```
claudetrail init <api-token>   Configure OTel + transcript upload
claudetrail hook               Handle SessionEnd hook (called by Claude Code)
claudetrail upgrade            Upgrade configuration to latest
claudetrail --version          Show version
```

## Configuration

### Config File

`~/.claudetrail`:

```json
{
  "apiKey": "ct_...",
  "baseUrl": "https://api.claudetrail.com"
}
```

### Claude Code Settings

`init` writes these to `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://api.claudetrail.com/otlp",
    "OTEL_EXPORTER_OTLP_HEADERS": "x-api-key=ct_..."
  },
  "hooks": {
    "SessionEnd": [{ "matcher": "", "hooks": [{ "type": "command", "command": "claudetrail hook", "timeout": 15 }] }]
  }
}
```

### Environment Variables

For CI/headless environments, set these instead of using a config file:

| Variable | Purpose |
|----------|---------|
| `CLAUDETRAIL_API_KEY` | API token (overrides config file) |
| `CLAUDETRAIL_BASE_URL` | API endpoint (default: `https://api.claudetrail.com`) |

## Upgrading

If you installed an earlier version (v0.2.x or below), run:

```bash
claudetrail upgrade
```

This migrates from the old multi-hook event posting to the new OTel-based architecture.

## Technical Details

- Pure Node.js, zero native dependencies
- OTel telemetry is handled natively by Claude Code — no hook overhead for metrics/events
- Only one hook registered (SessionEnd) with 15s timeout for transcript upload
- Transcript upload uses presigned S3 URLs (no payload size limits)

## License

MIT
