# Web library

Chain clients, environment parsing, explorer URL helpers, and server/client
boundaries belong here. Keep secrets out of browser bundles.

`agent.ts` is the public preview client. It may call `/v1/decisions/preview`
with a vault address. It must never send `AGENT_API_KEY` or the keeper key.
