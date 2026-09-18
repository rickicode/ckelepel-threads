# Authenticated activity replies — scope and orientation

Repository: standalone Node.js ESM CLI ckelepel-threads. bin/ckelepel.js uses Commander; src/index.js exports API; src/http.js implements undici, cookie input/env resolution and retries. npm test uses node:test. origin is rickicode fork; upstream wongedyan. Existing AGENTS.md applies. OpenLore executable and Basic Memory tools unavailable in this session; these notes provide local orientation.

User request: inspect https://www.threads.com/activity/replies with authorized logged-in diskongelo session and add authenticated read-only activity replies CLI/API if feasible. Existing replies command reads one post, not inbox. Do not change social-suite or live posting configuration.

Acceptance:
- Derive endpoint/Relay operation/variables and response shape from real logged-in traffic, not guessed IDs.
- New CLI command and ESM export support provided cookie file/env, limits and pagination/cursor where available.
- Missing/expired auth and blocked responses fail explicitly, never disguised as empty success. Credentials never logged or committed.
- Normalize stable notification/comment IDs, source/root post identifiers when actually present; missing mapping stays null, not invented.
- Keep existing public commands compatible; regression tests for fixtures, auth errors, pagination, duplicate handling and JSON output.
- Verify npm test and real CLI read using authorized session. Distinguish fixture tests from live results; no posting, replying, liking or permission changes.
- Document exact verified command, known limits and auth storage. Work on feature branch; do not include unrelated changes. Never delete files outside /tmp; move aside if necessary. Follow AST/comby preference for supported edits, structured additions may use file writer. Do not install formatters.
