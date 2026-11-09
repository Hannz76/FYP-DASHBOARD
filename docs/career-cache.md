# Department career caching

The career module uses Redis for search pages, recent keywords, and job details. MongoDB remains the source of student identity and department membership.

## Start the cache

For Podman Compose, put `JSEARCH_API_KEY` in the ignored project-root `.env`. Compose already supplies `REDIS_URL=redis://redis:6379` and `TZ=Asia/Kuala_Lumpur` to the backend.

From the project root, rebuild the backend and frontend with Redis:

```bash
podman compose up -d --build redis backend frontend
podman compose exec redis redis-cli ping
```

The check returns `PONG`. Redis has no published host port. It uses a named volume, append-only persistence, a 128 MB memory limit, and `noeviction`. Increase the memory limit if Redis reaches capacity. The backend refuses new paid searches when Redis cannot confirm a cache claim.

For the existing Docker stack, rebuild only the frontend and backend from the project root:

```bash
docker compose up -d --build backend frontend
docker compose ps
curl -fsS http://localhost:5000/api/health
```

The root and backend `.dockerignore` files exclude database storage, runtime uploads, dependencies and local environment files from their respective build contexts. MongoDB and uploaded files remain in the existing runtime mounts. A frontend build must not try to read `mongodb_data` or copy it into an image.

For local Node development, start a separate Redis instance bound to loopback:

```bash
podman run -d --name tvet-career-redis-local \
  -p 127.0.0.1:6379:6379 docker.io/library/redis:7.4-alpine
```

Add these settings to the ignored `backend/.env`, alongside the existing MongoDB and JWT settings:

```dotenv
REDIS_URL=redis://127.0.0.1:6379
TZ=Asia/Kuala_Lumpur
JSEARCH_API_KEY=your-openweb-ninja-key
```

Install backend dependencies and start the backend from its directory. Redis is connected lazily on the first career request. Its outages affect career searches, not login or unrelated endpoints.

## API reference

All routes require a valid JWT through the existing Next.js proxy. Career responses use `Cache-Control: private, no-store`.

| Route | Input | Output |
| --- | --- | --- |
| `GET /api/careers/search` | Search parameters and an authorized scope | `jobs`, `cursor`, `department`, `cached`, `resetAt` |
| `GET /api/careers/history` | Optional authorized scope | `keywords`, `department`, `resetAt` |
| `GET /api/careers/history/:department` | Department checked against the student record | Same history output |
| `GET /api/careers/recommendations` | Own session choices `roleFamilyId`, `placeId`, `placeMode` | Ranked `suggestions`, `needsReview`, `olderAdvertisements`, server choices, `emptyReason`, `department`, `resetAt` |
| `GET /api/careers/job-details` | One `job_id` and optional authorized scope | `job`, `cached`, `resetAt` |
| `GET /api/careers/pathways/:studentId` | Existing owner-or-staff check | Derived pathway and department-cached recommended jobs |

A student's scope comes from `Student.Kursus`, selected by the JWT's `studentId` through `getCurrentCareerSubject`. This requires a student row in the current processed dataset. If no dataset is marked current, the most recently processed dataset is selected. Missing membership receives 403 with `MEMBERSHIP_UNAVAILABLE`; an older student snapshot cannot grant access. Academic routes retain their separate historical fallback. Search writes, history reads, pathways and recommendations use this same career selector. A supplied department must match that record. An unlinked student receives 403. Invalid departments also receive 403. The supported codes are ITW, DFK, DGA, SLR, DCG, SED, and PPU.

Recommendations are student-only. They reject course, student ID, dataset, grade and score inputs. The response ranks the authenticated student's course pool using only that student's visible choices. Personal bookmarks never enter this shared pool.

Admin and counselor requests must select one department or one student with `department=DFK` or `studentId=...`. Supplying both selectors receives 400. Staff can access all seven departments under the existing role policy.

Search accepts the documented provider fields `query`, `country`, `date_posted`, `cursor`, `num_pages`, `language`, `work_from_home`, `employment_types`, `job_requirements`, `radius`, `exclude_job_publishers`, and `fields`. Unknown fields, repeated scalar fields, invalid enums, and conflicting aliases receive 400. `num_pages` is restricted to `1` to cap each cache miss at one page credit.

Existing callers may use `q`, `location`, and `employmentType`. Those aliases become the effective `query` and `employment_types` before hashing or contacting the provider. Defaults are `country=my`, `date_posted=all`, `employment_types=INTERN`, `num_pages=1`, and `work_from_home=false`.

Keywords normalize whitespace and case. Set-valued filters normalize their ordering. Opaque cursor text is preserved. The hash covers exactly the effective object serialized into the provider URL, with stable object-key order. Department selectors and the API key are never provider parameters.

When callers request a field projection, the backend adds `job_id`, `job_title`, and `job_apply_link` before hashing and serialization. Partial projections cannot turn real listings into false empty pages.

## Cache ownership and reset

The implementation lives in these files:

- `backend/utils/careerCache.js` validates effective parameters, builds keys, and calculates the reset deadline.
- `backend/services/careerCache.service.js` owns Redis connection handling, cache claims, history updates, and cooldowns.
- `backend/services/jobSearch.service.js` owns provider authentication and response mapping.
- `backend/careers.js` resolves authorization and maps HTTP results and errors.
- `backend/services/careerRecommendations.service.js` owns personalized ordering, requirement uncertainty, deduplication and explanation generation.
- `backend/utils/careerPathway.js` owns reviewed role families and place choices used by the server.
- `src/components/CareerRecommendations.jsx` renders the automatic recommendations and their session choices.
- `src/components/dashboard/StudentDashboardClient.jsx` owns browser state, history selection, pagination, and details display.

Search keys are `job_cache:v3:<department>:<md5 of canonical effective parameters>`. History keys are `job_history:v3:<department>`. Candidate indexes are `job_pages:v3:<department>`. Detail keys are `job_details:<job_id>` and are shared across departments.

The v3 result and history namespaces exclude entries that may have been assigned to an outdated course. Legacy pages and keyword lists are not copied or read. They expire at their existing daily deadline. Shared search results and history start empty once after this change. Job details and private saved jobs retain their existing identities.

Every new search page stores `schemaVersion`, `department`, canonical `params`, Redis-clock `fetchedAt`, `resetAt` and the complete result `value`. The same fenced Lua publication adds its page reference to the course index and trims that index to the most recent 30 fetched pages. It does not copy job payloads. Cache hits change neither fetch time nor index position. Empty successful pages can be indexed but supply no recommendation cards. Candidate reads inspect only the bounded index and recheck course, schema and deadline. They never scan all Redis keys or call the provider.

Global detail requests use fixed `country=my` and `language=en`. They accept one job ID, not batches or caller-selected response variants. If detail language or country becomes configurable, include those variants in the global key.

08:00 Asia/Kuala_Lumpur is 00:00 UTC. `getDailyCacheWindow()` returns the next UTC-midnight deadline and dynamic TTL seconds. At exactly 08:00, the helper advances to tomorrow's 08:00. The cache uses Redis time and absolute `PXAT` or `PEXPIREAT` expiration. Absolute expiry avoids extending a TTL by the time spent waiting for the provider. See [Redis expiration](https://redis.io/docs/latest/commands/expireat/).

Result and history keys become unavailable at that deadline. Redis can reclaim their memory later. The implementation does not promise that every byte is physically erased at the same instant.

Publication uses a Lua script that checks the original deadline and lock owner. A provider request that crosses the reset receives `DAILY_RESET` and cannot recreate yesterday's results or history. The browser clears cached display state at `resetAt` and rejects late expired responses.

Recent history is a ten-item Redis list. One atomic script removes the prior matching keyword, prepends it, trims the list, and assigns the daily deadline. Successful manual searches and cache hits update history, including valid empty pages. Pagination refreshes the same keyword. Automatic pathway loads and detail reads do not add history.

Both manual searches and pathways use this single cache. The old MongoDB `JobSearchCache` model and student-level cache reader and writer were removed. Existing unused documents do not affect new requests. Rebuild every backend replica so an old application instance cannot continue using the previous policy.

## Automatic ranking

Cadangan Automatik displays the current student's ranked saved-result cards. Role and workplace choices last for the dashboard session and reset on account or course changes. The server supplies the choices and performs all ranking. With no choice, the UI labels the list as course suggestions.

The order is selected role family, positive preferred-place match, valid posting date newest first, then stable title, company and job ID. Unknown and known-other places tie for a soft preference. A known required-place conflict is excluded; an unknown required place or ambiguous title enters `needsReview`. A clearly unrelated occupation is omitted even if a course peer searched for it. Known postings older than 30 days enter `olderAdvertisements`, retaining any uncertainty notices. A failed required place never reappears in that section.

Equal provider IDs are deduplicated across pages. Different IDs merge only when a safely normalized application URL, title, company and location agree. Keep one coherent provider snapshot rather than mixing fields. Repeated searches, peer counts, fetch recency and academic scalar scores never improve rank.

Cards explain title and place relevance and state that employer requirements remain unconfirmed. The retained job fields cannot establish employment type, minimum pay, skills, experience or certification eligibility. Another student's query filters are provenance, not per-job facts. DGA and DCG remain visibly unmapped for automatic ranking until their role registry is reviewed; their isolated manual search remains available.

Opening or changing recommendations makes no paid request. An explicit starter-search action uses the existing search route. Few saved results produce fewer cards. Empty history, all-excluded results and unavailable storage have distinct states. The browser clears expired cards at 08:00 and refreshes the saved pool without calling the provider. See [the approved architecture](career-ranking-proposal.md) for examples and tradeoffs.

## Pagination and failures

The provider's `data.cursor` is returned without modification. Each cursor and filter combination has a separate cache entry. The provider adapter retains the complete page instead of discarding listings after six cards.

The browser stores the parameters of the last successful search. **Muat Lagi** uses those parameters, even if the student has edited the form. It deduplicates job IDs across pages. A failed next page leaves previous listings visible. **Cuba Lagi** retries that page. An invalid cursor or a reset requires a new search. The adapter stops a repeated cursor to prevent a pagination loop.

A missing key, malformed provider response, network failure, or provider timeout is an error. It never becomes a cached successful empty page. There are no automatic provider retries. Authentication secrets and provider error bodies are not returned to the browser.

A provider 429 stores a global cooldown based on `Retry-After`, bounded to 1–300 seconds. New misses receive 429 and `Retry-After` during that period. Existing cache hits remain available. Cooldown and 30-second request locks are coordination records, not job caches. Their short deadlines can cross 08:00 to protect an active request or a provider limit.

Concurrent 429 responses preserve the longer remaining cooldown. A later shorter response cannot reopen paid misses early.

An unpredictable owner token and an atomic Redis claim protect ordinary concurrent misses across backend instances. Waiters share the result or a short-lived failure and wait at most 12 seconds. They never call the provider while another owner holds the claim. The lock lasts longer than the provider's 10-second timeout.

This prevents duplicate calls during normal concurrency. It cannot guarantee exactly-once external billing after a process crash, lost Redis state, or an ambiguous HTTP timeout. Owner fencing prevents stale publication. The bounded lock permits recovery after a crash.

## Frontend examples

The existing proxy supplies the HttpOnly token. Browser code sends only same-origin requests:

```javascript
const response = await fetch('/api/careers/search?' + new URLSearchParams({
	q: 'Cloud Support',
	location: 'Malaysia',
	employmentType: 'INTERN',
	date_posted: 'week',
}));
const page = await response.json();
if (!response.ok) throw new Error(page.message);

const historyResponse = await fetch('/api/careers/history');
const { keywords } = await historyResponse.json();

const nextResponse = await fetch('/api/careers/search?' + new URLSearchParams({
	q: 'Cloud Support',
	location: 'Malaysia',
	employmentType: 'INTERN',
	date_posted: 'week',
	cursor: page.cursor,
}));
```

The dropdown loads history on input focus and after a successful search. An open list also refreshes when the window regains focus. The UI binds keywords and pending requests to the account, student ID, normalized course, and dataset. It sends the displayed course as a constraint and rejects mismatched-course or superseded responses. That constraint does not grant access; the server independently resolves membership. Keyboard selection and loading and unavailable states remain. Job cards expose **Lihat Butiran**, which calls the globally cached details endpoint.

## Verify without provider credits

`backend/scripts/verify-course-history.mjs` exercises the real Express routes, JWT checks, MongoDB selection, and Redis history operations. The provider boundary returns fixture jobs, so the check uses no provider credits.

The fixture has two current DFK students and one current ITW student. One DFK student also has an older ITW snapshot. The check verifies shared DFK history, ITW isolation, forged selectors, cache hits, legacy-list exclusion, current pathway membership, and access after a course change.

After installing backend dependencies, start disposable MongoDB and Redis instances:

```bash
docker run -d --rm --name tvet-history-mongo-check \
	-p 127.0.0.1:27109:27017 docker.io/mongo:latest
docker run -d --rm --name tvet-history-redis-check \
	-p 127.0.0.1:6399:6379 docker.io/library/redis:7.4-alpine \
	redis-server --save '' --appendonly no
```

From the project root, run:

```bash
HISTORY_TEST_MONGO_URI=mongodb://127.0.0.1:27109 \
HISTORY_TEST_REDIS_URL=redis://127.0.0.1:6399 \
	node backend/scripts/verify-course-history.mjs
```

Run the personalized-result check against those same disposable services:

```bash
HISTORY_TEST_MONGO_URI=mongodb://127.0.0.1:27109 \
HISTORY_TEST_REDIS_URL=redis://127.0.0.1:6399 \
	node backend/scripts/verify-career-recommendations.mjs
```

That check asserts two DFK students reuse one provider page but receive personal orders `A/B/C` and `C/A`. It checks ITW isolation, forged selectors, current membership, duplicate handling, unknown requirements, old advertisements, the 30-page bound and real Redis expiry. Both scripts use fixture providers and isolated database/key namespaces.

The script creates a unique test database and Redis key prefix, then removes only that run's fixtures. It does not read student records in the application database or call `FLUSHDB`.

Expected results include:

```text
DFK A search resolved DFK; DFK B history=["cloud support"]; ITW C history=[]
PASS: two DFK students share history; ITW stays isolated; forged course and student selectors are rejected.
PASS: cache hits preserve course isolation; legacy leaked keywords are ignored; a course change revokes previous-course access.
```

Run `npm test` from the root for rendered UI checks and from `backend` for backend tests. `CourseHistory.test.jsx` checks course-response isolation, window-focus refresh, and late replies. Existing career tests cover pagination, bookmarks, and daily reset behavior.

Stop the disposable services after verification:

```bash
docker stop tvet-history-mongo-check tvet-history-redis-check
```

## Design decision

The design comparison considered a MongoDB-only cache and a Redis-owned cache. Both could enforce department authorization and logical freshness. Redis was selected because it provides absolute expiration and atomic bounded history operations without adding MongoDB cache schemas or transaction requirements. MongoDB TTL deletion is asynchronous, as described in [MongoDB TTL documentation](https://www.mongodb.com/docs/manual/core/index-ttl/).

The final design incorporates the MongoDB candidate's full-page preservation, request-bound pagination, and expiry-fenced writes. It uses bounded Redis locks instead of persistent uncertain-attempt reservations. This accepts bounded crash-recovery ambiguity in exchange for availability and a smaller interface.

Provider requests follow the [OpenWeb Ninja JSearch contract](https://www.openwebninja.com/api/jsearch/llms.txt). No provider key or student record is sent to the browser.
