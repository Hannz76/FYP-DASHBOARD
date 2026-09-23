# TVETMARA Besut Skills Talent Development Dashboard — Project Summary

**Last Modified:** 2026-09-23
**Repository:** FYP-DASBOARD (Final Year Project)
**Stack:** MERN (MongoDB + Express + React/Next.js + Node.js) + Python FastAPI ML service

---

## 1. Overview — What This System Does

This is a full-stack web application built for **TVETMARA Besut** (a Malaysian technical/vocational training institution). Its purpose is to help staff monitor student performance, predict at-risk students using AI, and manage counselor interventions.

**Three main user-facing capabilities:**

1. **Student Monitoring Dashboard** — Staff (admin/counselor) view all students with their CGPA, attendance, PLO (Programme Learning Outcome) scores, and AI-predicted status (`Cemerlang` = excellent, `Sederhana` = moderate, `Bermasalah` = at-risk).
2. **AI Risk Prediction** — A scikit-learn model predicts each student's status from their academic features. Predictions run automatically after data imports, or manually per-student.
3. **Counselor Report Workflow** — Admins refer at-risk students to counselors for intervention (counseling/clinic/soft-skills sessions). Counselors accept, schedule, and complete these referrals, and can also generate formal reports (with optional PDF letters) that students can view on their own dashboard.

**Data source:** Legacy Microsoft Access (`.mdb`) files exported from the institution's student information system. The ML service parses these files with `mdbtools`, extracts student data, and the backend syncs it into MongoDB.

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | Next.js (App Router) | 15.1.6 | SSR React framework |
| | React | 19 | UI library |
| | Tailwind CSS | 3.4 | Styling |
| | Chart.js + react-chartjs-2 | 4.5 / 5.3 | Data visualization (PLO radar charts, GPA trends) |
| | Vitest + Testing Library | 4.1 | Unit/component tests |
| **Backend** | Express | 5.2 | REST API framework |
| | Mongoose | 9.3 | MongoDB ODM |
| | jsonwebtoken | 9.0 | JWT auth tokens |
| | bcryptjs | 3.0 | Password hashing |
| | multer | 2.2 | File upload handling |
| | swagger-jsdoc + swagger-ui-express | 6.3 / 5.0 | Auto API docs at `/api/docs` |
| | Jest + Supertest | 30 / 7 | API tests |
| **ML Service** | FastAPI | — | Python API framework |
| | scikit-learn (via joblib) | model pickled w/ 1.6.1 | Risk prediction model |
| | pandas / numpy | — | Feature engineering, ETL |
| | mdbtools | system package | Reads `.mdb` (MS Access) files |
| **Database** | MongoDB | 8.x | Primary datastore |
| **DevOps** | Docker / Podman + docker-compose | — | Containerized deployment |
| | GitHub Actions | — | CI (`.github/workflows/ci.yml`) |

---

## 3. Architecture

The system is **three decoupled HTTP services** plus a database:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Browser    │────────▶│  Frontend   │────────▶│  Backend    │
│  (user)     │         │  Next.js    │  /api/* │  Express    │
└─────────────┘         │  :3000      │  proxy  │  :5000      │
                        └─────────────┘         └──────┬──────┘
                                                       │
                                            ┌──────────┼──────────┐
                                            ▼                     ▼
                                      ┌─────────────┐      ┌─────────────┐
                                      │  MongoDB    │      │  ML Service │
                                      │  :27017     │      │  FastAPI    │
                                      │  ikmb-      │      │  :8000      │
                                      │  dashboard  │      └─────────────┘
                                      └─────────────┘
```

**Communication flows:**

1. **Browser → Frontend:** Normal Next.js page requests. Auth state stored in cookies.
2. **Frontend → Backend:** All API calls go through a **catch-all proxy** at `src/app/api/[...proxy]/route.js`. The proxy reads the JWT from the `ikmbToken` httpOnly cookie and injects it as an `Authorization: Bearer <token>` header before forwarding to the backend. This keeps the token inaccessible to browser JavaScript (XSS protection).
3. **Backend → MongoDB:** Mongoose ODM for all persistence.
4. **Backend → ML Service:** Two cases:
   - Manual prediction: `POST /api/predict/manual` → ML `/predict/risk`
   - MDB upload pipeline: backend forwards the file to ML `/etl/process-mdb`, gets back parsed students, then calls `/predict/batch` to get AI status for each.
5. **Frontend file access:** Uploaded files (certificates, report PDFs, profile images) are served by the backend at `/uploads/*` and also proxied through Next.js.

---

## 4. User Roles & Access Control

Three roles, stored on the `User` model (`role` field, enum: `['admin', 'counselor', 'user']`):

| Capability | admin | counselor | user (student) |
|---|---|---|---|
| View all students | ✅ | ✅ | ❌ (own record only) |
| Create/edit/delete students | ✅ | ❌ | ❌ |
| Upload MDB data file | ✅ | ❌ | ❌ |
| Manual AI prediction | ✅ | ❌ | ❌ |
| List all users | ✅ | ❌ | ❌ |
| Create counselor referral (`Report`) | ✅ | ❌ | ❌ |
| View/accept/schedule/complete referrals | ✅ (all) | ✅ (pending + own) | ❌ |
| Generate student report (`StudentReport`) | ✅ | ✅ | ❌ |
| View student reports | ✅ (all) | ✅ (own authored) | ✅ (received) |
| Upload own certificates / profile image | ✅ | ✅ | ✅ (own record) |

**Default seeded accounts** (all password `password123`):

| Email | Role | displayName |
|---|---|---|
| `admin@ikmb.edu.my` | admin | Admin IKMB |
| `counselor@ikmb.edu.my` | counselor | Kaunselor IKMB |
| `user@ikmb.edu.my` | user | (student) |

Student accounts are auto-created on MDB import with email pattern `{ID_Pelajar}@student.ikmb.edu.my` and default password `password123` (bcrypt-hashed).

**Auth mechanism:**
- Login (`POST /api/auth/login`) returns `{ user, token }`.
- The Next.js server action `loginAction` stores `user` (JSON) in a readable cookie and `token` in an **httpOnly** cookie named `ikmbToken` (both 24h maxAge).
- `middleware.js` (Next.js edge middleware) enforces route-level RBAC: staff routes (`/staff-dashboard`, `/student-profile`) require admin/counselor; `/student-dashboard` requires user role; already-logged-in users visiting `/` get redirected to their dashboard.
- Backend `verifyToken` middleware validates the JWT on every protected route. Role checks use `requireAdmin`, `requireStaff`, or `requireOwnershipOrAdmin` (student can only access own record; staff can access any).

---

## 5. Complete API Reference

Base URL: `http://localhost:5000`. All protected routes need `Authorization: Bearer <JWT>`. Swagger UI: `http://localhost:5000/api/docs`.

### 5.1 System
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Returns `{ status: "ok", source: "mongodb-database" }` |

### 5.2 Auth (`backend/auth.js`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Body `{ email, password }`. Returns `{ message, user, token }`. Errors: 400 missing fields, 401 bad credentials. |
| GET | `/api/auth/users` | admin | Sanitized list of all users (no passwords). |

### 5.3 Students (`backend/items.js`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/students` | any | Students see only their own record (array of 1); staff see all. |
| POST | `/api/students` | admin | Create student. |
| GET | `/api/students/:studentId` | owner/staff | Single student by `ID_Pelajar`. |
| PUT | `/api/students/:studentId` | admin | Update student. |
| DELETE | `/api/students/:studentId` | admin | Delete student. |
| GET | `/api/students/:studentId/skill-gap` | owner/staff | Skill-gap analysis (PLO-based). |

### 5.4 Certificates & Profile Image (`backend/items.js`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/students/:studentId/certificates` | owner/staff | Multipart upload. Accepts PDF/JPG/PNG, max **5MB**. Saves to `backend/uploads/certificates/`, appends to `uploadedCertificates[]`. Fields: `file`, `name`, `issuer`. |
| DELETE | `/api/students/:studentId/certificates/:certId` | owner/staff | Removes DB subdocument AND deletes file from disk. |
| POST | `/api/students/:studentId/profile-image` | owner/staff | Same multer config; sets `profileImage` path on the student. (Stored in the same certificates folder.) |

### 5.5 AI Prediction & MDB Import (`backend/items.js`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/predict/manual` | admin | Body = `StudentFeatures` JSON (see §7.2). Proxies to ML `/predict/risk`. |
| POST | `/api/data/upload-mdb` | admin | Multipart `.mdb` file, max **100MB** (memory storage). Full pipeline: forward to ML ETL → batch AI prediction → upsert Students → upsert student User accounts → delete students missing from new file (sync). Response: `{ message: "Berjaya! N rekod pelajar telah dikemas kini." }` |

### 5.6 Counselor Referrals — `Report` (`backend/reports.js`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/reports` | admin | Create referral. Required body: `studentId`, `studentName`, `interventionType`, `reason`. Optional: `course`, `cgpa`, `attendance`, `riskLevel`, `priority` (`urgent`/`normal`). Sets `adminEmail` from JWT, status defaults `pending`. |
| GET | `/api/reports` | staff | Admin sees all; counselor sees `pending` OR assigned-to-them. Sorted newest first. |
| GET | `/api/reports/:id` | staff | Single referral. Counselor blocked if not pending and not theirs. |
| PATCH | `/api/reports/:id` | staff | State machine — see §6.1. |

### 5.7 Generated Student Reports — `StudentReport` (`backend/studentReports.js`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/student-reports` | staff | Multipart. Required: `studentId`, `studentName`, `title`. Optional: `message`, `file` (PDF only, max **5MB** → `backend/uploads/reports/`), `course`, `cgpa`, `attendance`, `riskLevel`, `semester`, `ploScores` (JSON string), `employability`. `reportType` auto-derived: `message` / `letter` / `full`. |
| GET | `/api/student-reports` | any | Admin: all. Counselor: only own authored. Student: only reports addressed to them. |
| GET | `/api/student-reports/:id` | owner/author/admin | Auto-marks `readByStudent: true` when the student opens it. |
| DELETE | `/api/student-reports/:id` | author/admin | Deletes record AND its PDF from disk if present. |

---

## 6. Counselor Report Workflow (State Machines)

### 6.1 Referral (`Report`) — admin → counselor

```
                 admin creates
                      │
                      ▼
                  ┌────────┐  counselor rejects  ┌───────────┐
                  │pending │────────────────────▶│ rejected  │
                  └───┬────┘                     └───────────┘
                      │ counselor accepts (sets counselorId = own email)
                      ▼
                  ┌──────────┐  counselor sets scheduledDate
                  │ accepted │────────────────────▶┌───────────┐
                  └──────────┘                     │ scheduled │
                                                   └─────┬─────┘
                                                         │ counselor completes (+ notes)
                                                         ▼
                                                   ┌───────────┐
                                                   │ completed │
                                                   └───────────┘
```

**PATCH rules enforced in `reports.js`:**
- Admin can only reset status to `pending` or `rejected`.
- Counselor on a `pending` report: `accepted` (claims it — sets `counselorId`) or `rejected`.
- Counselor on **their own** report: `scheduled` (requires `scheduledDate`), `completed` (optional `counselorNotes`).
- `counselorNotes` editable any time before completion.

**Fields:** `studentId`, `studentName`, `course`, `cgpa`, `attendance`, `riskLevel`, `interventionType` (`kaunseling` | `klinik` | `softskills`), `reason`, `priority` (`urgent` | `normal`), `status`, `adminEmail`, `counselorId`, `counselorNotes`, `scheduledDate`, timestamps.

### 6.2 Generated Report (`StudentReport`) — staff → student

One-shot creation (no state machine). Staff picks a student, writes a title + optional message + optional PDF letter, submits. The student sees it under "Laporan Saya" on their dashboard; opening it flips `readByStudent`.

`reportType` is derived automatically: message-only → `message`, file-only → `letter`, both → `full`.

---

## 7. AI/ML Pipeline

### 7.1 Model
- File: `ML/model_ai_risiko_lengkap_v4.pkl` (joblib-serialized scikit-learn pipeline, "V4").
- Loaded once at FastAPI startup; if load fails, `/predict/*` endpoints return 500.
- Trained on real MDB-extracted data (see `backend/db/prepare_ml_data_3mdb.py`); ground-truth labels generated by rule-based function (`relabel_option2.py`):
  - **Bermasalah** if CGPA < 3.00 OR composite score < 70 OR any failed subject OR any dropped subject OR attendance < 80%.
  - **Cemerlang** if CGPA ≥ 3.90 AND attendance ≥ 80% AND all PLOs ≥ 80.
  - Otherwise **Sederhana**.

### 7.2 Prediction Input — `StudentFeatures`
```json
{
  "CGPA": 3.45, "Attendance": 92.0,
  "PLO_1": 80, "PLO_2": 75, "...": "...", "PLO_9": 88,
  "Sijil": "Tiada"
}
```
The service engineers two extra features before predicting: `PLO_Avg` (mean) and `PLO_Variance`. Column order is aligned to `model.feature_names_in_` when available.

### 7.3 ML Endpoints (`ML/ml.py`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | Health: `{ status: "AI Server V4 is running" }` |
| POST | `/predict/risk` | Single prediction → `{ success, prediction, raw_output }` |
| POST | `/predict/batch` | Body `{ students: [...] }` → `{ success, predictions: [...] }` (same order) |
| POST | `/etl/process-mdb` | Multipart `.mdb` → `{ success, data: [studentDocs...] }` ready for MongoDB upsert |

### 7.4 MDB ETL Details (what `/etl/process-mdb` extracts)

Reads these Access tables via `mdb-export` / `mdb-tables`:

| MDB Table | What it provides |
|---|---|
| `GPA` | Latest CGPA + per-semester GPA/CGPA history (`academicHistory[]`) |
| `Pelajar` | Name, course code (cleaned of `*`/whitespace), No_KP, phone, address (merged Alamat+Poskod+Bandar) |
| `Daftar_Subjek` | Attendance % (overall average AND per-semester, matched into `academicHistory`) |
| `Detail_Result` | PLO scores — `Kod_Ujian` matched against `LO(\d+)`; only LO1–LO9 kept |
| `Anugerah` | Award flag (`Anugerah: true` if student appears) |
| `Pelajar_Koko_Detail` | Co-curricular pass (`Koko_Lulus: true` if `Result == 'LULUS'`) |

**Important edge case:** subjects whose `Kod_Ujian` references **LO > 9** use an internal CLO numbering scheme (e.g. DUA20102 with LO11) and are **auto-excluded** from PLO mapping — otherwise their LO7/LO8 would corrupt PLO_7/PLO_8.

### 7.5 Post-import Backend Sync (`POST /api/data/upload-mdb`)

1. ML returns parsed students → backend maps them into batch-prediction payload → ML `/predict/batch` → each student's `Status_Pelajar` set from prediction.
2. Students **not** present in the new file are **deleted** (`deleteMany` with `$nin`) — full sync semantics.
3. Each student upserted by `ID_Pelajar`; each gets a matching `User` (`{id}@student.ikmb.edu.my`, hashed `password123`, role `user`).
4. `backend/repredict-status.js` is a standalone script that re-runs batch prediction over **all** students already in MongoDB (chunks of 500) — useful after model upgrades.

### 7.6 Training Scripts (`backend/db/`)
- `inspect_mdb_linux.py` — dump MDB schema + sample rows.
- `sedut_mdb_tulen.py` — extract `Ekspot_Senat.mdb` → `data_tvet_muktamad.json` (seeding).
- `prepare_ml_data_3mdb.py` — merge JJ2025/JD2025/JJ2026.mdb → `ml_training_data_real.csv` with rule-based labels.
- `relabel_option2.py` — re-apply labeling rules to an existing CSV (with timestamped backup).
- `ML/train_and_evaluate.py`, `ML/train_and_evaluate_v4.py` — model training; `ML/test_ml.py` — sanity tests.

---

## 8. Database Schemas (Mongoose)

### 8.1 `Student` (`backend/models/Student.js`)
| Field | Type | Notes |
|---|---|---|
| `ID_Pelajar` | String | Business key (e.g. `20201234`) — used everywhere instead of `_id` |
| `Nama`, `Kursus` | String | Name, course code |
| `Semester` | Number | Current semester |
| `Kehadiran_Pct`, `CGPA` | String | Stored as strings ("92", "3.45") |
| `Sijil_Profesional` | String | Professional cert name or "Tiada" |
| `PLO_1` … `PLO_9` | String | Averaged PLO scores ("0" if none) |
| `Status_Pelajar` | String | AI prediction (`Cemerlang`/`Sederhana`/`Bermasalah`/`Pending AI`) |
| `No_KP`, `No_Telefon`, `Alamat` | String | Personal info (default `''`) |
| `academicHistory[]` | subdocs | `{ semester:Number, gpa:String, cgpa:String, attendance:String }` |
| `uploadedCertificates[]` | subdocs | `{ name, issuer, fileName, filePath, uploadDate }` |
| `profileImage` | String | Path under `/uploads/...` |

### 8.2 `User` (`backend/models/User.js`)
`email` (unique), `password` (bcrypt), `role` (`admin`|`counselor`|`user`, default `user`), `displayName`, `studentId` (links to `Student.ID_Pelajar`, null for staff).

### 8.3 `Report` (`backend/models/Report.js`) — see §6.1.
### 8.4 `StudentReport` (`backend/models/StudentReport.js`) — see §6.2. `ploScores` is `[{ label, value }]`, `employability` is a Number.

---

## 9. Frontend Structure (`/src`)

### 9.1 Routes (App Router)
| Path | File | Access | Purpose |
|---|---|---|---|
| `/` | `src/app/page.jsx` | public | Login page |
| `/staff-dashboard` | `src/app/staff-dashboard/page.jsx` | admin, counselor | Main staff dashboard (tabs incl. Kaunselor) |
| `/student-dashboard` | `src/app/student-dashboard/page.jsx` | user | Student's own view incl. "Laporan Saya" |
| `/student-profile` | `src/app/student-profile/page.jsx` | staff | Detailed per-student profile |
| `/api/[...proxy]` | `src/app/api/[...proxy]/route.js` | — | Catch-all backend proxy (see §3) |

### 9.2 Key Components (`src/components/`)
- `auth/LoginForm.jsx` — login form wired to `loginAction`.
- `Sidebar.jsx`, `KpiCard.jsx`, `JobCard.jsx` — layout/stats.
- `StudentListGrid.jsx`, `StudentModal.jsx` — student browsing.
- `dashboard/StaffDashboardClient.jsx` — admin dashboard client logic.
- `dashboard/CounselorDashboardClient.jsx` — counselor tab (referrals queue).
- `dashboard/StudentDashboardClient.jsx` — student view.
- `dashboard/StudentProfileClient.jsx` — full profile w/ charts.
- `dashboard/StudentReportsTab.jsx` — "Laporan Saya" (student's received reports).
- `GenerateReportModal.jsx` — staff form to create a `StudentReport` (message + optional PDF).
- `ReportFormModal.jsx` — admin form to create a counselor referral (`Report`).

### 9.3 Lib & Actions
- `src/app/actions.js` — `loginAction` / `logoutAction` server actions (set/clear cookies, redirect by role).
- `src/lib/auth.js` — server-side auth helpers (read cookies).
- `src/lib/client-auth.js` — client-side auth helpers.
- `src/lib/heuristics.js` — client-side risk/display heuristics.

### 9.4 Proxy Deep-Dive (`src/app/api/[...proxy]/route.js`)
Handles GET/POST/PUT/PATCH/DELETE. Strips `host`, `connection`, `content-length`, `cookie` headers, adds `Authorization: Bearer <ikmbToken>` if the cookie exists, forwards body as-is (supports multipart via arrayBuffer), mirrors response status + headers. Returns 502 JSON if backend unreachable.

**Why this exists:** JWT lives in an httpOnly cookie (XSS-safe), so browser JS can't attach it — the server-side proxy does it instead. Replaced the old `next.config.mjs` rewrites approach.

---

## 10. Backend Structure (`/backend`)

| File | Purpose |
|---|---|
| `server.js` | Express bootstrap: CORS, JSON, `/uploads` static, Swagger at `/api/docs`, mounts routers, connects Mongoose (skipped when `NODE_ENV=test`), exports `app` for tests |
| `auth.js` | `/api/auth/*` routes (login, list users) |
| `auth.model.js` | `authenticateUser`, `getPublicLoginUsers` |
| `items.js` | Students CRUD, certificates, profile image, manual predict, MDB upload |
| `item.model.js` | DB helpers (`getAllStudents`, `getStudentById`, `getStudentSkillGapById`, `createStudent`, `updateStudent`, `deleteStudent`, `getRealAIPrediction`) |
| `reports.js` | Counselor referral routes |
| `studentReports.js` | Generated student report routes (+ PDF upload) |
| `middleware/authMiddleware.js` | `verifyToken`, `requireAdmin`, `requireStaff`, `requireOwnershipOrAdmin` |
| `models/` | `Student`, `User`, `Report`, `StudentReport` |
| `seed.js` / `seed-admin.js` | Seed default admin/counselor/user accounts (`npm run seed`) |
| `repredict-status.js` | Re-run AI batch prediction over all DB students |
| `db/` | Python ETL/training-data scripts (see §7.6) + `data_tvet_muktamad.json` |
| `uploads/` | Runtime file storage: `certificates/`, `reports/` (auto-created) |
| `__tests__/` | Jest: `auth.test.js`, `items.test.js`, `reports.test.js` (8 tests total) |

---

## 11. File Uploads Reference

| Upload | Endpoint field | Max size | Allowed types | Stored at |
|---|---|---|---|---|
| Certificate | `file` | 5 MB | PDF, JPG, PNG | `backend/uploads/certificates/` |
| Profile image | `file` | 5 MB | PDF, JPG, PNG (same filter) | `backend/uploads/certificates/` |
| Report letter | `file` | 5 MB | **PDF only** | `backend/uploads/reports/` |
| MDB data file | `file` | 100 MB | `.mdb` | memory only (streamed to ML, never saved) |

Filenames: `{timestamp}-{random}{ext}`. Served at `/uploads/**` via Express static.

---

## 12. Environment Variables

**`backend/.env`:**
```bash
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard
JWT_SECRET=super_secret_tvetmara_fyp_key_2026
ML_API_URL=http://127.0.0.1:8000
```

**`.env.local` (frontend root):**
```bash
BACKEND_URL=http://127.0.0.1:5000
```

**Compose overrides** (`compose.yml`): backend gets `MONGO_URI=mongodb://mongodb:27017/...` and `ML_API_URL=http://ml-api:8000`; frontend gets `BACKEND_URL=http://backend:5000`.

---

## 13. Docker Deployment

`compose.yml` services (all on `tvet_net` bridge network):

| Service | Container | Host port | Build |
|---|---|---|---|
| `mongodb` | `tvet_mongodb` | 27017 | `mongo:latest`, volume `./mongodb_data:/data/db:Z` |
| `backend` | `tvet_backend` | 5000 | `backend/Containerfile.backend` (node:20-alpine, `npm install --production`) |
| `ml-api` | `tvet_ml_api` | 8000 | `ML/Containerfile` (Python + mdbtools) |
| `frontend` | `tvet_frontend` | **8080 → 3000** | `Containerfile.frontend` (3-stage: deps → build → standalone runner, non-root `nextjs` user) |

Run: `docker-compose up --build` → frontend at `http://localhost:8080`.

---

## 14. Local Development Setup

Prereqs: Node 20+, Python 3.x + venv, MongoDB running, (optional) `mdbtools` for MDB features.

```bash
# Backend
cd backend && npm install
cp .env.example .env   # or create per §12
node seed-admin.js && npm run seed
npm run dev            # nodemon on :5000

# ML service
cd ML && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn ml:app --host 0.0.0.0 --port 8000

# Frontend
npm install
npm run dev            # Next.js on :3000
```

Or use the repo script: `./start-local-dev.sh` (starts all three with nohup; logs in `/tmp/{backend,ml,frontend}.log`).

**Tests:**
```bash
npm test               # frontend Vitest (3 files, 5 tests)
cd backend && npm test # backend Jest (3 files, 8 tests)
```

**Known local caveats:**
- `mdbtools` must be installed on the host for MDB upload to work outside Docker (Arch/CachyOS: build from source — not in official repos).
- The v4 pickle was made with scikit-learn 1.6.1; newer versions emit `InconsistentVersionWarning` but still load.

---

## 15. CI

`.github/workflows/ci.yml` — runs lint + frontend tests + backend tests + `next build` on push/PR. (See file for exact job matrix.)

---

## 16. Complete File Tree (annotated)

```
.
├── compose.yml                   # 4-service orchestration
├── Containerfile.frontend        # 3-stage Next.js standalone build
├── middleware.js                 # Next.js edge RBAC redirects
├── next.config.mjs               # standalone output, image config
├── package.json                  # frontend deps + scripts
├── tailwind.config.js / postcss.config.js / .eslintrc.json
├── vitest.config.js / jsconfig.json
├── start-local-dev.sh            # one-shot local startup
├── .github/workflows/ci.yml
│
├── src/
│   ├── middleware (see root middleware.js)
│   ├── app/
│   │   ├── layout.jsx / page.jsx         # shell + login
│   │   ├── actions.js                    # login/logout server actions
│   │   ├── api/[...proxy]/route.js       # JWT-injecting backend proxy
│   │   ├── staff-dashboard/page.jsx
│   │   ├── student-dashboard/page.jsx
│   │   └── student-profile/page.jsx
│   ├── components/
│   │   ├── auth/LoginForm.jsx
│   │   ├── Sidebar.jsx / KpiCard.jsx / JobCard.jsx
│   │   ├── StudentListGrid.jsx / StudentModal.jsx
│   │   ├── GenerateReportModal.jsx       # staff → StudentReport
│   │   ├── ReportFormModal.jsx           # admin → Report referral
│   │   └── dashboard/
│   │       ├── StaffDashboardClient.jsx
│   │       ├── CounselorDashboardClient.jsx
│   │       ├── StudentDashboardClient.jsx
│   │       ├── StudentProfileClient.jsx
│   │       └── StudentReportsTab.jsx
│   ├── lib/  auth.js · client-auth.js · heuristics.js
│   └── __tests__/  Login · GenerateReportModal · ReportFormModal (Vitest)
│
├── backend/
│   ├── server.js · auth.js · auth.model.js
│   ├── items.js · item.model.js
│   ├── reports.js · studentReports.js
│   ├── middleware/authMiddleware.js
│   ├── models/  Student · User · Report · StudentReport
│   ├── seed.js · seed-admin.js · repredict-status.js
│   ├── db/  inspect_mdb_linux.py · sedut_mdb_tulen.py ·
│   │        prepare_ml_data_3mdb.py · relabel_option2.py ·
│   │        data_tvet_muktamad.json
│   ├── uploads/  certificates/ · reports/     (runtime)
│   ├── __tests__/  auth · items · reports     (Jest)
│   ├── Containerfile.backend · package.json · .env
│
└── ML/
    ├── ml.py                           # FastAPI: predict + MDB ETL
    ├── model_ai_risiko_lengkap_v4.pkl  # production model
    ├── train_and_evaluate.py / train_and_evaluate_v4.py
    ├── test_ml.py
    ├── requirements.txt · Containerfile
    └── venv/                           # local only
```

---

## 17. Quick Reference

| What | Where |
|---|---|
| Frontend | http://localhost:3000 (dev) / :8080 (docker) |
| Backend API | http://localhost:5000 |
| Swagger docs | http://localhost:5000/api/docs |
| ML service | http://localhost:8000 |
| Admin login | `admin@ikmb.edu.my` / `password123` |
| Counselor login | `counselor@ikmb.edu.my` / `password123` |
| Student login pattern | `{ID_Pelajar}@student.ikmb.edu.my` / `password123` |
| Run all tests | `npm test && (cd backend && npm test)` |
| Start everything | `./start-local-dev.sh` |

---

*This document describes the system as of 2026-09-23, including the counselor report workflow, httpOnly-cookie proxy auth, and v4 ML pipeline.*
