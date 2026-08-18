# Decisions

Decision input snapshots, deterministic baseline policy, model adapter, and
schema validation belong here. This layer returns structured data, never raw
transaction calldata.

`model.ts` calls an OpenAI-compatible provider (default Groq) for the
explanation. Allocation is clamped to reserve-only while `bdexEnabled` is
false. Tests inject `complete` so they do not need a live API key.

`pnpm --filter @gren/agent smoke:model` checks a live key without starting
the keeper or reading a vault. It never prints the key.
