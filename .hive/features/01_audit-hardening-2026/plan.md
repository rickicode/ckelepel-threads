# Audit & Hardening 2026

Comprehensive audit & fix untuk semua bug, edge case, dan hardening di ckelepel-threads.

## Discovery Notes

Analyzed 6 core modules + CLI + tests. Identified critical gaps:

- **http.js**: Tidak ada timeout → hanging indefinitely jika Meta hold connection
- **scraper.js**: Tidak detect GraphQL `errors` array, tidak handle 404/private gracefully  
- **docid-resolver.js**: Regex bisa fail jika Meta rotate bundle structure
- **normalizers.js**: Null safety untuk carousel media perlu diperkuat
- **db.js**: Tidak ada explicit statement cleanup, error message kurang detail
- **bin/ckelepel.js**: Tidak ada SIGINT/SIGTERM handler, exit codes tidak differentiated
- **test/**: Coverage untuk edge case masih minim

## Tasks

### 01-http-hardening
**Dependencies**: none  
**Estimate**: 30m

Add timeout config (`headersTimeout`, `bodyTimeout`) ke undici dispatcher, improve network error detection & retry logic, add explicit error types.

**Files**: `src/http.js`

**Acceptance**:
- undici request dengan default timeout 30s (configurable)
- Network error di-catch & logged dengan detail
- Retry hanya untuk transient error (429, 5xx, ECONNRESET)

---

### 02-scraper-error-detection
**Dependencies**: 01-http-hardening  
**Estimate**: 45m

Add GraphQL `errors` array detection, 404/302/private profile handling, improve pagination cursor edge cases.

**Files**: `src/scraper.js`

**Acceptance**:
- Throw explicit error jika GraphQL response contain `errors`
- Detect 404 atau redirect 302 untuk profile/post
- Handle private profile gracefully dengan descriptive error
- Cursor pagination handle null/invalid cursor tanpa crash

---

### 03-docid-resolver-fallback
**Dependencies**: none  
**Estimate**: 30m

Harden regex untuk doc_id extraction, add multiple fallback patterns, improve error reporting jika bundle structure berubah.

**Files**: `src/docid-resolver.js`

**Acceptance**:
- 3+ regex pattern untuk extract doc_id dari berbagai bundle format
- Cache invalidation mechanism untuk force refresh
- Descriptive error jika semua pattern fail

---

### 04-normalizers-null-safety
**Dependencies**: none  
**Estimate**: 30m

Add comprehensive null safety untuk carousel media, quoted posts, link preview. Verify emoji/unicode handling.

**Files**: `src/normalizers.js`

**Acceptance**:
- `extractMediaFromPost` handle empty/null carousel gracefully
- `extractLinkPreview` handle missing fields tanpa crash
- No `undefined` atau `null` di output final (fallback ke `""` atau `null` explicit)

---

### 05-db-cleanup-errors
**Dependencies**: none  
**Estimate**: 30m

Add explicit statement cleanup (best practice), improve transaction error messages, add WAL checkpoint mechanism.

**Files**: `src/db.js`

**Acceptance**:
- Statement prepared di constructor di-reuse & cleanup di close()
- Transaction error contain detail (table, operation, row count)
- WAL checkpoint mechanism documented (auto atau manual)

---

### 06-cli-signal-handling
**Dependencies**: 01-http-hardening, 02-scraper-error-detection  
**Estimate**: 30m

Add SIGINT/SIGTERM handlers, differentiate exit codes (0=success, 1=user error, 2=network error, 3=api error), improve error output.

**Files**: `bin/ckelepel.js`

**Acceptance**:
- Graceful shutdown pada SIGINT/SIGTERM
- Exit codes: 0 (ok), 1 (args), 2 (network), 3 (API/rate limit)
- Error output dengan helpful message & next action

---

### 07-unit-tests-edge-cases
**Dependencies**: 01-http-hardening, 02-scraper-error-detection, 03-docid-resolver-fallback, 04-normalizers-null-safety  
**Estimate**: 60m

Add unit test untuk semua edge case yang diperbaiki: timeout, GraphQL errors, null carousel, private profile, cursor pagination.

**Files**: `test/audit-hardening.test.js` (new)

**Acceptance**:
- Test coverage untuk timeout handling
- Test untuk GraphQL error detection
- Test untuk null/empty media carousel
- Test untuk private/404 profile
- `npm test` pass 100%

---

## Out of Scope

- Performance optimization (bukan correctness bug)
- UI/formatting changes (sudah ada formatters.js)
- New feature (focus: bug fix only)

## Verification

After each batch merge:
1. `npm test` → 100% pass
2. Manual smoke test: `./bin/ckelepel.js profile zuck --posts`
3. Check error message quality dengan invalid input
