# Personalized career recommendations from course history

Design checkpoint, approved by the user on 9 November 2026. The ranking feature is implemented, verified and running in this project's local Docker frontend and backend after the user requested a rebuild. This document preserves the reviewed design and signature sketches. No provider-field enrichment or production-data migration was performed.

## Recommendation

Use deterministic, role-first rules. Saved searches provide candidate vacancies from the current student's course. Evaluate those vacancies again using that student's own choices. Do not rank by another student's interest, search count or academic profile.

The first version should support a selected career family and a preferred workplace. A student can mark the workplace as required. Keep these choices in the current dashboard session and clear them when the account or current course changes. No choice is silently copied from manual-search defaults. Without personal choices, label results as course suggestions rather than personalized matches.

Show the actual ranked job cards inside Cadangan Automatik. Replace its fixed match percentages with observable reasons and missing-information notices. A result is a suggestion to investigate, not a statement that the student meets every employer requirement.

## What exists today

The automatic tab displays fixed examples from `careerMapping` in `src/components/dashboard/StudentDashboardClient.jsx:31`. Its DFK percentages, 94% and 85%, are literals. Clicking a card invokes the manual search handler and switches to Carian Manual at line 447. There is no existing personalized ranker.

The request goes through `src/app/api/[...proxy]/route.js`, which adds the authenticated JWT. `backend/careers.js:21` resolves the student's database-owned course. `backend/services/careerCache.service.js:114` reuses exact course-specific search pages or loads them from the provider. All normalized provider parameters participate in the key at `backend/utils/careerCache.js:23`.

Three stores have different meanings. Redis result pages hold reusable job cards. Redis keyword history holds ten recent keyword strings. MongoDB SavedJob records are private bookmarks and must remain private. Keyword strings cannot reconstruct the original filters. Private bookmarks are not a shared recommendation source.

The source course selector prefers the current processed dataset, with newest-own-record fallback for unpinned academic lookups at `backend/item.model.js:188`. The running Docker image still uses the older unscoped lookup. Existing cached results therefore cannot be adopted as trusted new recommendation history.

## Evidence available for matching

| Available field | Supported use | Limit |
|---|---|---|
| Current student's database course | Authorize the candidate pool and select relevant career families. | A peer search in the same course does not prove relevance. |
| Job title | Recognize a controlled career family and explain title relevance. | Does not establish skills, employment type or experience requirements. |
| Job location text | Compare an unambiguous listed place with the student's chosen workplace. | Does not establish remote work, commuting distance or willingness to relocate. |
| Job posting date | Prefer newer postings and label older advertisements. | Does not prove a vacancy remains open. |
| Provider job ID and application URL | Deduplicate repeated listings. | Different vacancies can share an employer or application landing page. |
| Company, publisher and salary text | Display the listing. | Salary is not a comparable numeric range; publisher is not a suitability signal. |
| Student CGPA, PLO, attendance and semester | Academic guidance. | No corresponding job-side requirements exist for per-job comparisons. |
| Certificate names and uploads | Display self-reported evidence when relevant. | Not verified, no expiry or exact credential equivalence. |

`backend/services/jobSearch.service.js:20` retains only jobId, title, company, location, applyLink, salary, postedAt and source. Stored cards omit structured employment type, skills, experience, qualifications, work mode, closing date and numeric salary. The separate details API adds free-text description, not parsed eligibility. A search filter requesting internships is not proof that each returned job is an internship.

`backend/models/Student.js` and `backend/models/User.js` contain no saved career preference profile. Malaysia and INTERN are temporary manual-search defaults. The home address is contact information, not a workplace preference. The academic readiness formula is not a career-match probability.

Read-only runtime inspection found 713 current student records across seven courses. None had a recorded nonempty professional certificate other than Tiada, or an uploaded certificate. This means evidence is absent from the records, not that students have no certificates. Redis held three DFK search pages with 19 card records before deduplication. The pages lacked original search parameters and fetch timestamps. Some posting dates were missing.

## Approaches compared

| Approach | Behaviour | Decision |
|---|---|---|
| Ordered rules | Check requirements first, then compare selected career, preferred place and posting recency in that order. | Recommended. No arbitrary weights, predictable explanations and useful with current sparse fields. |
| Weighted evidence | Add points for role, location and supported preferences after hard exclusions. | Useful if compensating tradeoffs are a product requirement. No training labels currently justify the weights. |
| Semantic or model ranking | Compare richer student and vacancy descriptions using a model. | Not suitable for this first version. The required descriptions, verified requirement facts and evaluation examples are missing. A model cannot recover missing eligibility evidence. |

The weighted candidate used selected role +6, related course role +3 and preferred place +4. A related local role scores 7 and outranks an exact-role distant role scoring 6. The role-first design gives the opposite order. The recommendation is to make this tradeoff visible through a required-location choice rather than hide it in weights.

Search popularity and collaborative filtering were rejected. Another student's interest supplies no evidence that a particular job suits this student.

## Proposed requirements and ordering

### Candidate access and exclusions

The server derives membership from the authenticated student. The new recommendation endpoint accepts preferences, never a candidate pool, another student's ID, grades, a score or a course grant. Historical dataset selection cannot change the authorized course.

For shared career access, require a student row in the current processed dataset. If it is missing, return a distinct membership-unavailable state. Do not silently authorize a previous course through the academic fallback. Apply this rule consistently to new search publication, keyword-history access and recommendation reads. Keep the academic snapshot fallback for academic routes. This is a proposed tightening of the existing career policy and needs checkpoint approval with the rest of this design.

The candidate reader accepts only trusted current-version pages for the resolved course. It rejects expired or mismatched envelopes. Other-course jobs never enter ranking or a browser response.

Apply these listing decisions before ordering:

| Condition | Decision |
|---|---|
| Missing ID or title, unsafe or missing application URL | Omit the invalid card. |
| Cache deadline passed, including a read crossing 08:00 | Omit the page and refresh the visible state. |
| Title clearly belongs only to a known occupation outside this course | Omit from automatic suggestions. A DFK search containing Pipe Welder does not make it a DFK career. |
| Unrecognized or ambiguous title | Put in Perlu semakan. Do not invent a role match from its source query. |
| Required workplace clearly conflicts with the listed place | Exclude from suggestions. Do not relax the requirement automatically. |
| Required workplace cannot be established from the listing | Put in Perlu semakan. Unknown is not a pass or a known failure. |
| Missing salary, certificates, experience, skills or employer conditions | Say these conditions are unconfirmed. Do not invent an eligibility decision. |

The first version must not offer internship-only, minimum-pay, remote-only, experience, qualification or certification filters as verified hard requirements. Current stored fields cannot enforce them. If internship-only is essential for the first release, first retain a documented per-listing employment-type fact from provider responses when present. Missing type remains unknown. Query filters and title words cannot supply it. That extension is separate from the recommended baseline.

Low CGPA, low PLO, attendance and dropout risk never automatically reject a job. Absent certificate records do not prove a student lacks a qualification. If an employer minimum is added later, compare it only with corresponding reliable current-student evidence. Represent every supported mandatory check as met, failed or unknown.

### Display groups

Show these sections in order:

1. Suggestions whose role family is recognized and whose supported required choices are met.
2. Perlu semakan for uncertain role relevance or an unknown supported required choice.
3. Iklan lebih lama for known posting dates more than 30 days old. Keep any uncertainty labels within this section.

A failed mandatory choice is excluded from every section. Check failures before assigning groups. The 30-day boundary is a proposed display policy, not a job-closing date. An undated posting stays in its applicable section with Tarikh iklan tidak dinyatakan. It cannot receive a newly-posted label.

Every section displays Syarat majikan belum disahkan. The first section means supported selected constraints match, not that all employment eligibility has been verified.

### Exact ranking inside a section

Compare the following keys, stopping at the first difference:

1. The student's selected role family, followed by other recognized families in their course. Without a selected family, all recognized families tie.
2. A positive match to the student's preferred workplace. An unknown place and a known other place tie for this preference. Neither earns a match. Required-place failures and unknowns have already been handled separately.
3. A valid nonfuture posting date, newest first. Missing, invalid or future dates receive no recency advantage and tie after dated postings.
4. Normalized title, normalized company and job ID for stable ties.

Do not award rank for repeated searches, number of peers, another student's filters, fetch recency, listing completeness or a student-wide academic scalar. Cache retrieval cannot improve a vacancy's rank. Salary that is not stated receives no invented zero value.

Career-family matching uses controlled whole-word phrases and aliases in titles. A generic word such as cloud alone must not prove Cloud Support relevance. Unknown titles remain uncertain. Keep aliases and starter roles in one server course registry derived from the existing pathway map. Do not duplicate rules in the browser. The pathway map currently lacks DGA and DCG; their coded UI roles can be proposed as seeds, but automatic ranking for an unmapped course must remain visibly unavailable until its role mapping is reviewed. All seven courses still receive safe manual search and their own isolated history.

## Example output

These are illustrative fixtures, not live vacancies, computed match scores or measured hiring outcomes. All rows except F came from fresh trusted DFK pages. Dates are relative to the same request time. All employer conditions remain unverified.

| ID | Saved listing | Place | Posting age |
|---|---|---|---|
| A | Cloud Support Intern | Selangor | 4 days |
| B | Cloud Support Intern | Penang | 1 day |
| C | IT Support Intern | Selangor | Today |
| D | Technology Programme | Not stated | Not stated |
| E | Cloud Support Intern | Selangor | 60 days |
| F | Cloud Support Intern, stored only in ITW history | Selangor | Today |
| G | Pipe Welder Intern | Selangor | Today |

Student A selects Cloud Support and prefers Selangor. The main order is A, B, C. A beats B because place is preferred before recency. B beats C because the chosen career is preferred before place. D is in Perlu semakan. E appears under older advertisements. F is never read from ITW history. G is outside DFK's career families and is omitted.

Student B is also DFK, selects IT Support and requires Selangor. The main order is C, A. B is excluded for its known location conflict. D cannot satisfy the required place and stays in Perlu semakan. E remains an older advertisement. The same shared pool produces a different order because B's own choices are used.

A duplicate of A from another search produces one card and adds no rank. An ITW student receives only ITW candidates, even if their search keyword matches A's keyword.

An example card for A reads:

> Cloud Support Intern
>
> Selangor. Posted 4 days ago.
>
> Sebab cadangan: Bidang Cloud Support pilihan anda. Lokasi pilihan anda sepadan.
>
> Syarat majikan belum disahkan. Jenis pekerjaan, pengalaman dan kelayakan perlu disemak pada iklan.

The word Intern comes from the saved title in this fixture. It is not independent employment-type verification.

## Duplicates, freshness and sparse history

Deduplicate equal provider job IDs across pages. For different IDs, merge only when the normalized application URL, title, company and place agree. Ignore URL fragments and only known tracking parameters. Preserve material application parameters. A common employer landing URL or matching title alone is insufficient.

Keep the newest coherent provider snapshot for a duplicate. Do not combine a favorable salary from one snapshot with an employment condition from another. If snapshots conflict on a future supported mandatory fact, keep the conflict unknown. Deduplication count never improves suitability.

Keep the existing next-08:00 Asia/Kuala_Lumpur deadline. Cache hits do not extend it. Store the actual provider fetchedAt separately from postedAt. Fetch time controls snapshot freshness and duplicate selection, never personal fit. An old advertisement fetched today is still an old advertisement.

The cache service owns a new bounded index referencing the most recent 30 successfully fetched pages per course. This proposed limit bounds recommendation reads; it is not a claim that every result ever searched will be included. The index and pages share the daily expiry. Cache hits do not promote pages. Exact-match search caches can retain valid pages beyond index eviction, but those pages are outside the bounded automatic recommendation pool. The UI describes the pool as recent saved course results.

With little history, show fewer real suggestions. With no suitable candidates, show a clear reason and reviewed course starter searches. With no personal choices, label results Cadangan mengikut kursus and invite the student to choose a career and workplace. With all candidates excluded by a required place, explain the conflict and offer an explicit preference edit. Do not silently broaden the requirement.

Opening or reranking recommendations never calls a paid provider or retrieves every job's details. An explicit Cari jawatan untuk pilihan saya action uses the normal authorized search route. New search results populate the course index and refresh the recommendations. Load the list on entry, a changed preference, returning window focus and successful search. No polling is needed. At 08:00 clear expired cards and reload the saved pool without triggering a provider search. Redis failure has an unavailable state and retry, not a false empty-history message.

## Usage and module sketch

The following is a contract sketch, not executable application implementation. Existing route authentication supplies the student identity. The browser supplies only its own visible choices.

```js
// HTTP route usage after authentication.
const result = await recommendForStudent(req.user.studentId, req.query);
res.json({ success: true, ...result });

// Behaviour-fixture usage with domain data.
const forCloud = rankCareerCandidates({ subject, preferences: cloudChoices, candidates, now });
const forSupport = rankCareerCandidates({ subject, preferences: supportChoices, candidates, now });

/**
 * @typedef {'ITW'|'DFK'|'DGA'|'SLR'|'DCG'|'SED'|'PPU'} Course
 * @typedef {{mode:'none'}|{mode:'prefer'|'require', placeId:string}} PlaceChoice
 * @typedef {{roleFamilyId:string|null, place:PlaceChoice}} CareerPreferences
 * @typedef {{state:'met'}|{state:'failed',reason:string}|{state:'unknown',reason:string}} RequirementCheck
 * @typedef {{course:Course,dataset:string}} CurrentCareerSubject
 * @typedef {{jobId:string,title:string,company:string,location:string,
 *   applyLink:string,salary:string,postedAt:string,source:string}} CareerCard
 * @typedef {{schemaVersion:3,course:Course,params:Record<string,string>,fetchedAt:number,
 *   resetAt:number,value:{jobs:CareerCard[],cursor:string|null}}} SavedSearchPage
 * @typedef {{course:Course,resetAt:number,pages:SavedSearchPage[]}} CourseCandidates
 * @typedef {{job:CareerCard,reasons:string[],checksNeeded:string[]}} CareerSuggestion
 * @typedef {{id:string,label:string}} RoleChoice
 * @typedef {{q:string,location:string,employmentType:string}} StarterSearch
 * @typedef {{course:Course,resetAt:number,mode:'personalized'|'course-only',
 *   preferences:CareerPreferences,roleChoices:RoleChoice[],
 *   suggestions:CareerSuggestion[],needsReview:CareerSuggestion[],
 *   olderAdvertisements:CareerSuggestion[],
 *   emptyReason:null|'no-history'|'no-relevant-jobs'|'requirements-exclude-all'|'unmapped-course',
 *   starterSearches:StarterSearch[]}} CareerRecommendations
 */

export async function recommendForStudent(authenticatedStudentId, rawChoices) {
  throw new Error('not implemented');
}

function rankCareerCandidates({ subject, preferences, candidates, now }) {
  throw new Error('not implemented');
}

// Proposed additional method on the existing careerCache object.
async function candidates(resolvedCourse) {
  throw new Error('not implemented');
}
```

`recommendForStudent` obtains membership through one shared current-career-subject lookup, validates inputs against that course's allowed role and place choices, reads its saved pool, and ranks it. Existing search and history routes use that same subject lookup. Do not copy its current-dataset selection or normalized course policy into each caller. Request parsing rejects unsupported or forged scope inputs. `rankCareerCandidates` is a pure internal policy function. Behaviour tests exercise it through the recommendation module. Raw Redis keys and provider schemas remain behind the cache boundary.

| Module | Proposed responsibility |
|---|---|
| `backend/careers.js` | Add authenticated student recommendation route, reject foreign scope inputs, return private/no-store responses. Use the same current-membership rule for all shared career access. |
| `backend/item.model.js` | Own the shared current-career-subject lookup used by all shared career routes and the recommendation operation. Preserve academic historical lookup behaviour separately. |
| `backend/services/careerCache.service.js` | Sole writer for versioned search envelopes and bounded course reference index. Add the candidate read operation with expiry and course rechecks. |
| New `backend/services/careerRecommendations.service.js` | Own one recommendation operation and its private ranking, deduplication and explanation rules. |
| `backend/utils/careerPathway.js` | One reviewed course-role registry and starter-search source. Derive UI choices from server output. |
| `src/components/dashboard/StudentDashboardClient.jsx` | Replace automatic example percentages with own-student choices, ranked cards, review and empty states. Ignore delayed responses for old account, course or choices. |

Search publication atomically writes the new page envelope and course index through the existing cache owner. Do not add a second jobs collection. Do not cache the personalized recommendation response under a course-only key. Two students can share candidate pages while receiving different ordered responses.

Use a fresh result namespace populated only after corrected course resolution is active. Do not reconstruct or import legacy pages whose course attribution or filter provenance may be wrong. Old keys can expire naturally. The local Docker rebuild was separately requested and completed after the implementation checkpoint.

## Synthesis decision and tradeoffs

Two independent design candidates were produced from the same traced source and runtime evidence. Both used the available inherited model because the skill's preferred model families are unavailable. This is independent design exploration, not evidence of model diversity.

The ordered-rule candidate is the base. Its role-first comparison makes the undecided preference tradeoff explicit. The weighted candidate contributes a single recommendation service boundary, positive-evidence-only preference handling and an example that exposes compensating weights. Both keep one result owner and separate uncertain requirements. An independent cross-review agreed with this choice and required the unified career-membership rule and conservative duplicate matching described above.

Drop the ordered candidate's title-stage score and fetchedAt ranking tie-break. Neither establishes verified employment suitability, and a later peer fetch should not promote a career. Keep the weighted candidate's bounded 30-page reference index as a stated capacity choice. Retain the ordered candidate's visibly separate older-advertisement group. Reject a new job collection, shared personalized scores, invented percentages and background model/provider calls.

The design accepts coarse title and place relevance in exchange for using fields actually available. It accepts sparse daily pools and session-only choices in exchange for predictable expiry and no new preference-write API. It accepts explicit unknowns in exchange for never claiming that missing employer requirements pass. Interface review found one storage owner, one recommendation operation and one source for course roles. The UI does not repeat policy or orchestrate ranking stages.

## Verification after approval

Use isolated MongoDB, Redis and authenticated HTTP fixtures, with a fixture provider and no real student data or paid calls:

1. DFK A searches once. DFK B reuses identical cached jobs and the shared pool with no second provider call.
2. A and B select the example preferences and receive the literal orders A/B/C and C/A respectively.
3. ITW C sees only its own course's history and candidates. Forged student and course selectors fail before any DFK page read.
4. A current-course change revokes the old pool. Missing current membership does not fall back to an older course. Viewing a historical academic dataset grants no career scope.
5. A required place conflict excludes; an unknown required place is review-only. Changing CGPA or another student's preferences does not change the viewer's order.
6. Duplicate pages show one coherent card. Stable ties remain stable. Unrelated, ambiguous, undated and older jobs produce the specified sections.
7. Daily expiry clears pages, index and UI. Cache hits change neither fetchedAt nor resetAt. Opening or reranking recommendations makes zero provider calls.
8. Delayed old-account, old-course and old-preference UI responses cannot render. No history, no personal choices, all-excluded, unmapped course and unavailable storage remain distinct states.

## Checkpoint and implementation status

The user approved the role-first priority, location preference with an explicit required option, session-only choices, 08:00 reset, 30-day older-advertisement section and stricter current-dataset membership. The first version does not promise internship or employer-qualification eligibility with today's stored fields. Data enrichment remains outside this baseline.

Implementation follows the reviewed boundaries. The API and cache use the existing name `department` for a course. `getCurrentCareerSubject` supplies the shared current-dataset membership rule. The cache owns versioned envelopes and its bounded index. One recommendation service owns ranking, and `CareerRecommendations` renders the server's order and choices inside the automatic tab.

Verification passed 32 backend Jest cases, 30 rendered frontend cases, the existing course-history HTTP check, the new real MongoDB/Redis personalized-result check and a Next production build. Literal DFK orders A/B/C and C/A passed, with ITW isolation and no provider call on recommendation reads. Independent backend and frontend reviews found no actionable defects. No enabled browser surface was available, so actual browser verification was not performed. The separately authorized local Docker rebuild completed on 9 November 2026. The dashboard returned HTTP 200, the API health check confirmed MongoDB, deployed backend file hashes matched the source, and the running frontend bundle contained the new recommendation UI.
