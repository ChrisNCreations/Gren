# Media

Saved product stills and the demo video live here. Keep them out of the repo
root and out of `apps/`.

Playwright verification screenshots must use an explicit filename:

```text
media/gren-<surface>-<state>.png
```

Examples: `gren-landing-desktop.png`, `gren-agent-reject.png`,
`gren-agent-execute-confirmed.png`.

Do not store Playwright MCP session dumps (`page-*.yml`, `console-*.log`) here.
Those belong in `.playwright-mcp/`, which is gitignored.
