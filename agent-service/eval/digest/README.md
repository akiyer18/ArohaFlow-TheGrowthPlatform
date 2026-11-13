# Email Digest eval harness

Labelled email set → include/exclude metrics. **Not** part of `npm run agent:test`.

## Run

```bash
npm run agent:eval:digest
```

## Add real inbox labels

1. Copy a row shape from `fixtures/labelled-emails.v1.json`.
2. Set `expected` to `include` or `exclude`.
3. For non-allowlist / non-noise keeps, add a matching entry under `llmRank` (or later wire a live LLM port for eval-only runs).
4. Re-run `npm run agent:eval:digest`.

You do not need Sender Allowlist entries to start — fixtures can stay synthetic until you have Important Email examples from live digests (`agent_email_digest_items` in Supabase).
