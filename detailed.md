# TVETMARA Besut Skills & Talent Development Dashboard

## 1. Purpose of this document

This document explains the project as it is implemented in the repository. It covers:

- the system purpose and business workflow;
- the three runtime services and their communication paths;
- authentication, cookies, JWTs, and role-based access control;
- frontend routes, components, state, API calls, and user journeys;
- backend routes, middleware, data transformations, uploads, and persistence;
- MongoDB/Mongoose models and important field conventions;
- the Python/FastAPI prediction service and Microsoft Access ETL pipeline;
- model-training and data-preparation scripts;
- tests, CI, containers, local development, and configuration;
- the difference between source files, generated files, runtime files, and data artifacts.

The repository contains both production application code and project-development artifacts. The application source is readable and maintainable. Some files are intentionally machine-generated or binary, so this document describes their role and format rather than reproducing their contents.

---

## 2. System overview

The application is a student-development dashboard for TVETMARA Besut/IKMB. It combines academic records, attendance, Programme Learning Outcome (PLO) scores, certificates, AI risk classification, counselor referrals, appointments, and staff-generated reports.

The system has three main runtime services:

1. **Frontend** — Next.js 15 and React 19 application.
2. **Backend** — Express 5 REST API backed by MongoDB through Mongoose.
3. **ML service** — FastAPI service that loads a serialized scikit-learn model and processes `.mdb` files.

MongoDB is the persistent datastore. The browser normally talks to the frontend. The frontend forwards API requests to the backend, and the backend talks to MongoDB and the ML service.

```text
Browser
  │
  ▼
Next.js frontend :3000 (local) / :8080 host mapping (Compose)
  │  /api/* proxy; injects JWT from httpOnly cookie
  ▼
Express backend :5000
  ├── MongoDB :27017
  └── FastAPI ML service :8000
        ├── risk prediction
        ├── batch prediction
        └── Microsoft Access ETL
```

### 2.1 Main business capabilities

#### Staff monitoring

Admin and counselor users can see student records, academic indicators, PLO performance, risk labels, employability-style scores, top performers, and skill gaps. Admin users additionally manage student data and import new institutional data.

#### AI risk classification

The ML service classifies a student as one of:

- `Bermasalah` — problematic/high concern;
- `Sederhana` — moderate;
- `Cemerlang` — excellent.

The backend presents these model labels to the frontend as user-facing risk labels:

- `Bermasalah` → `Tinggi`;
- `Sederhana` → `Sederhana`;
- `Cemerlang` → `Rendah`.

The model is used for manual prediction, batch prediction after MDB import, and refreshed student skill-gap responses.

#### Counselor workflow

Staff can refer a student for one of three interventions:

- `kaunseling` — attendance counseling;
- `klinik` — academic clinic;
- `softskills` — soft-skills development.

The referral progresses through `pending`, `accepted`, `scheduled`, `completed`, or `rejected`. Counselors can accept or reject pending referrals, schedule accepted referrals, and complete scheduled referrals with notes.

#### Student report workflow

Staff can generate a student report containing a title, message, student metrics, PLO values, employability score, and optionally a PDF letter. Students see their reports in `Laporan Saya`. Opening a report marks it as read.

#### Institutional data import

An administrator uploads a Microsoft Access `.mdb` file. The backend forwards it to FastAPI. FastAPI extracts tables using `mdbtools`, combines the records into student documents, and returns them. The backend then runs batch predictions, upserts students and student accounts, and deletes students absent from the newly imported file.

---

## 3. Runtime architecture and request flow

### 3.1 Frontend-to-backend requests

Browser-side components call paths such as `/api/students` and `/api/reports`. These paths are handled by `src/app/api/[...proxy]/route.js` rather than directly exposing the backend URL to browser code.

The proxy:

1. reads the catch-all route segments;
2. builds `${BACKEND_URL}/api/${path}`;
3. preserves the query string;
4. copies request headers except `host`, `connection`, `content-length`, and `cookie`;
5. reads `ikmbToken` from the server-side cookie store;
6. adds `Authorization: Bearer <token>` when present;
7. forwards the request body as an `ArrayBuffer`, which supports JSON and multipart requests;
8. returns the backend status, body, and response headers;
9. returns HTTP 502 with a Malay error message if the backend cannot be reached.

This design keeps the JWT inaccessible to browser JavaScript. The readable `user` cookie is still used for client-side display and middleware routing, but it does not contain the secret token.

### 3.2 Backend-to-ML requests

The backend calls the ML service in three situations:

- `POST /api/predict/manual` calls ML `POST /predict/risk`;
- `POST /api/data/upload-mdb` sends the uploaded file to ML `POST /etl/process-mdb`;
- after ETL, the backend sends normalized student features to ML `POST /predict/batch`.

The backend translates model labels into dashboard risk labels in `backend/item.model.js`. If a manual prediction request fails, the backend uses a simple attendance/CGPA fallback instead of returning no risk value.

### 3.3 File serving

Express exposes the backend `uploads` directory at `/uploads`. Next.js also has a rewrite for `/uploads/:path*` to the configured backend URL. Stored file paths therefore look like `/uploads/certificates/<generated-name>` or `/uploads/reports/<generated-name>`.

---

## 4. Authentication and authorization

### 4.1 Roles

The `User` schema allows three roles:

| Role | Meaning | Main access |
|---|---|---|
| `admin` | coordinator/administrator | all staff functions, student CRUD, import, manual AI, all reports |
| `counselor` | counselor | staff dashboard, assigned/pending referrals, authored student reports |
| `user` | student | own student record, own uploads, own appointments and reports |

### 4.2 Login sequence

1. The login form submits email and password through the `loginAction` server action.
2. `loginAction` calls backend `POST /api/auth/login`.
3. `backend/auth.model.js` loads users from MongoDB and compares the submitted password with the bcrypt hash.
4. The backend signs a JWT containing `email`, `role`, and `studentId` using `JWT_SECRET`.
5. The frontend stores:
   - `user`: JSON user data, readable by the browser, max age 24 hours;
   - `ikmbToken`: JWT, `httpOnly`, max age 24 hours.
6. Admin and counselor users are redirected to `/staff-dashboard`; students are redirected to `/student-dashboard`.

The JWT itself expires after 8 hours according to `authenticateUser`, while the frontend cookies are configured for 24 hours. Backend JWT expiry is therefore the effective authentication limit.

### 4.3 Frontend route protection

`middleware.js` reads and parses the `user` cookie. It:

- redirects authenticated users away from `/` to their dashboard;
- redirects unauthenticated users from protected pages to `/`;
- allows staff roles into `/staff-dashboard` and `/student-profile`;
- allows only `user` into `/student-dashboard`;
- excludes API routes and Next static/image paths from the matcher.

The middleware is a navigation guard. It is not the final security boundary because a client-controlled readable cookie can be changed. The backend remains responsible for validating the JWT and enforcing authorization on every protected API route.

### 4.4 Backend authorization middleware

`backend/middleware/authMiddleware.js` contains:

- `verifyToken` — requires an Authorization header, verifies the JWT, and stores the decoded claims on `req.user`;
- `requireAdmin` — permits only `admin`;
- `requireStaff` — permits `admin` or `counselor`;
- `requireOwnershipOrAdmin` — permits staff or a student whose JWT `studentId` equals the URL `studentId`.

Missing tokens return 403. Invalid or expired tokens return 401. Role or ownership violations return 403.

---

## 5. Frontend implementation

### 5.1 Next.js application shell

`src/app/layout.jsx` is the root layout. It:

- sets the HTML language to Malay (`lang="ms"`);
- loads Plus Jakarta Sans through `next/font/google`;
- imports Tailwind globals;
- loads Phosphor Icons from the unpkg CDN before interactive code;
- defines the application title and description.

`src/app/globals.css` contains the Tailwind directives only. Most visual styling is written directly as Tailwind utility classes in components.

### 5.2 App Router pages

| Route | File | Purpose |
|---|---|---|
| `/` | `src/app/page.jsx` | login page |
| `/staff-dashboard` | `src/app/staff-dashboard/page.jsx` | staff dashboard wrapper |
| `/student-dashboard` | `src/app/student-dashboard/page.jsx` | student dashboard wrapper |
| `/student-profile?id=...` | `src/app/student-profile/page.jsx` | detailed staff view of one student |
| `/api/[...proxy]` | `src/app/api/[...proxy]/route.js` | backend API proxy |

The dashboard pages use `dynamic = 'force-dynamic'` so they are rendered dynamically and do not attempt to cache user-specific state during build.

### 5.3 Login UI

`src/components/auth/LoginForm.jsx` is a client component using React 19 `useActionState` and `useFormStatus`. It provides:

- email and password fields;
- default demo credentials in the form;
- pending-state button text;
- an error message returned by the server action;
- a responsive two-column visual design on large screens;
- the TVETMARA logo and remote AI-themed background image.

### 5.4 Shared components

- `Sidebar.jsx` — responsive navigation drawer, logo, current user identity, role label, initials, and logout button.
- `KpiCard.jsx` — reusable metric card with icon, value, subtitle, and progress bar.
- `JobCard.jsx` — static career recommendation card with match percentage.
- `StudentListGrid.jsx` — searchable/filterable student card grid with course chips and add button.
- `StudentModal.jsx` — add/edit student form. It closes on Escape and outside-backdrop click.
- `GenerateReportModal.jsx` — creates a `StudentReport` with text and optional PDF.
- `ReportFormModal.jsx` — creates a counselor referral with intervention, reason, date, counselor, priority, and optional attachment.

### 5.5 Staff dashboard

`StaffDashboardClient.jsx` is the main staff client component. It loads `/api/students` and builds the following tabs:

#### Overview

Calculates and displays:

- total active students;
- average employability score;
- high-risk count;
- average PLO 1–9 versus a target of 80;
- high-risk student list;
- top five students ordered by CGPA.

It uses a Chart.js bar chart for PLO comparison.

#### AI Prediction

Admin users can enter CGPA, attendance, certification, and nine PLO scores. The component sends the data to `/api/predict/manual` and displays the returned classification.

#### Skills Gap Analysis

The component calculates an institute-wide average for each PLO, calculates the gap to 80, and labels each PLO as:

- `Selamat` when average ≥ 80;
- `Perlu Peningkatan` when average is 60–79;
- `Kritikal` when average < 60.

#### Learning Pathways

Each PLO gap is mapped to a hard-coded recommended pathway such as communication, programming, OSH, project management, innovation, entrepreneurship, leadership, or professional integrity.

#### Student Management

`StudentListGrid` displays students. Staff can open `/student-profile?id=<studentId>` or open the add modal. Admin-only handlers support POST, PUT, and DELETE student operations.

#### Counselor

Embeds `CounselorDashboardClient`, which manages referrals and appointments.

#### Pengurusan Data

Admin users select an `.mdb` file and call `/api/data/upload-mdb`. The UI displays processing state, success/error text, and reloads after a successful import. Counselors do not see this tab.

### 5.6 Counselor dashboard

`CounselorDashboardClient.jsx` loads `/api/reports` and provides:

- counts for pending, scheduled, completed, and total referrals;
- tabs for pending, scheduled, calendar, completed, and all;
- accept/reject controls for pending referrals;
- scheduling modal for accepted referrals;
- completion modal with counselor notes;
- attachment links;
- status and priority badges.

`AppointmentCalendar.jsx` groups scheduled referrals by local calendar date. It supports month navigation, a Monday-first calendar, today selection, appointment chips, selected-day details, and completion callbacks.

### 5.7 Student dashboard

`StudentDashboardClient.jsx` loads the logged-in student and displays:

- current risk status;
- employability estimate;
- attendance and CGPA;
- PLO radar chart versus target 80;
- weakest-PLO insight from the backend;
- upcoming counselor appointments;
- profile image upload;
- certificate upload and deletion;
- generated reports;
- hard-coded career matches based on course code;
- recommended courses based on the weakest PLO.

Students are restricted by the backend to their own record. The frontend also filters the returned list using `user.studentId`.

### 5.8 Student profile page

`StudentProfileClient.jsx` is the detailed staff view. It fetches `/api/students/:studentId/skill-gap` and renders:

- identity, course, semester, certificate, attendance, and risk badge;
- personal details including generated student email, phone, identity number, and address;
- academic CGPA progress;
- mixed GPA line/attendance bar history chart;
- PLO radar chart;
- AI employability estimate;
- data-completeness warning when a PLO is zero;
- counselor intervention cards;
- `GenerateReportModal` and `ReportFormModal`.

### 5.9 Frontend helper modules

- `src/lib/auth.js` reads server-side cookies and maps roles to dashboard paths.
- `src/lib/client-auth.js` reads the readable `user` cookie in the browser.
- `src/lib/heuristics.js` contains two simple formulas:
  - employability: `(CGPA / 4) * 40 + attendance * 0.6`, capped at 100;
  - top-performer score: `(CGPA / 4) * 60 + attendance * 0.4`, capped at 100.

These formulas are presentation heuristics. They are separate from the trained risk classifier.

---

## 6. Backend implementation

### 6.1 Express bootstrap

`backend/server.js` creates the Express app and:

- loads environment variables with `dotenv`;
- enables CORS;
- parses JSON;
- serves `/uploads` statically;
- generates Swagger documentation at `/api/docs`;
- connects to MongoDB unless `NODE_ENV=test`;
- exposes `GET /api/health`;
- mounts auth, student, referral, and student-report routers;
- starts port 5000 outside test mode;
- exports the app for Supertest.

### 6.2 Authentication routes

`backend/auth.js` exposes:

| Method | Path | Authorization | Behavior |
|---|---|---|---|
| POST | `/api/auth/login` | public | validates credentials and returns sanitized user plus JWT |
| GET | `/api/auth/users` | admin | returns sanitized users for counselor selection |

`auth.model.js` reads users from MongoDB, normalizes email to lowercase, compares bcrypt hashes, signs JWTs, and removes password fields from returned user objects.

### 6.3 Student routes

`backend/items.js` exposes:

| Method | Path | Authorization | Purpose |
|---|---|---|---|
| GET | `/api/students` | authenticated | staff receive all; student receives own record in an array |
| POST | `/api/students` | admin | create student |
| PUT | `/api/students/:studentId` | admin | update student |
| DELETE | `/api/students/:studentId` | admin | delete student |
| GET | `/api/students/:studentId` | owner/staff | read one normalized student |
| GET | `/api/students/:studentId/skill-gap` | owner/staff | read student, PLO chart, and insight |
| POST | `/api/students/:studentId/certificates` | owner/staff | upload certificate |
| DELETE | `/api/students/:studentId/certificates/:certId` | owner/staff | remove certificate and disk file |
| POST | `/api/students/:studentId/profile-image` | owner/staff | upload profile image |
| POST | `/api/predict/manual` | admin | proxy one prediction to ML |
| POST | `/api/data/upload-mdb` | admin | run MDB import, predictions, and synchronization |

The standard upload middleware stores certificates and profile images under `backend/uploads/certificates`, accepts PDF/JPG/PNG, and limits files to 5 MB. MDB uploads use memory storage and have a 100 MB limit.

### 6.4 Student normalization

MongoDB uses source-oriented names such as `ID_Pelajar`, `Nama`, `CGPA`, and `PLO_1`. The frontend uses concise names such as `id`, `nama`, `cgpa`, and `plo1`. `item.model.js` performs this conversion in `normaliseStudent`.

It also:

- converts numeric strings to numbers;
- maps model statuses to display risk values;
- forces risk to high if attendance < 80 or CGPA < 2.0;
- preserves awards, co-curricular status, certificates, profile image, and academic history;
- maps certificate names to presentation scores.

`getStudentSkillGapById` recalculates the AI risk through the ML service, creates nine target-80 metrics, identifies the weakest PLO, and generates a Malay insight message.

### 6.5 Referral routes

`backend/reports.js` stores counselor referrals in the `Report` model.

Creation is admin-only. The request must include student, intervention type, reason, appointment date, and counselor. The counselor must exist with role `counselor`. The implementation creates the referral directly as `scheduled` because the UI requires a date and counselor at creation time; the schema default remains `pending` for other creation paths.

Counselors can see pending referrals and referrals assigned to their email. Admins can see all. PATCH operations allow counselors to accept/reject pending referrals, schedule their own accepted referrals, and complete their own scheduled referrals. Admins can update status subject to route logic.

`GET /api/reports/mine` returns a student's accepted or scheduled appointments, including attachment paths.

### 6.6 Generated student-report routes

`backend/studentReports.js` handles reports written by staff for students:

- POST is staff-only and accepts text plus optional PDF;
- GET returns all reports for admin, own authored reports for counselors, or student-addressed reports for students;
- GET by ID allows the student owner, author, or admin;
- opening as the student sets `readByStudent` to true;
- DELETE allows an author or admin and removes the stored PDF.

The report type is derived automatically:

| Content | `reportType` |
|---|---|
| message only | `message` |
| PDF only | `letter` |
| message and PDF | `full` |

PDF uploads are limited to 5 MB and stored under `backend/uploads/reports`.

---

## 7. MongoDB models

### 7.1 Student

`backend/models/Student.js` stores the institution's student record. Important fields:

- `ID_Pelajar` — business identifier used by URLs and account links;
- `Nama`, `Kursus`, `Semester` — identity and programme data;
- `Kehadiran_Pct`, `CGPA` — stored as strings because imported source data is string-oriented;
- `Sijil_Profesional` — professional certificate label;
- `PLO_1` through `PLO_9` — PLO scores as strings;
- `Status_Pelajar` — source/model status;
- `No_KP`, `No_Telefon`, `Alamat` — personal information;
- `academicHistory[]` — semester, GPA, CGPA, attendance;
- `uploadedCertificates[]` — metadata and path for uploaded files;
- `profileImage` — uploaded image path.

### 7.2 User

`backend/models/User.js` stores login identities:

- unique email;
- bcrypt password hash;
- role enum;
- display name;
- optional `studentId` linking student accounts to `Student.ID_Pelajar`.

### 7.3 Report

`backend/models/Report.js` represents a counselor referral. It stores student snapshot values, intervention type, reason, priority, workflow status, admin email, counselor email, notes, appointment date, attachment metadata, and timestamps.

### 7.4 StudentReport

`backend/models/StudentReport.js` represents a report addressed to a student. It stores student snapshot values, PLO score objects, employability, author identity, title, message, optional PDF, report type, read state, and timestamps.

---

## 8. ML service

### 8.1 FastAPI entry point

`ML/ml.py` creates `FastAPI(title="TVETMARA AI Prediction API V4")` and loads `model_ai_risiko_lengkap_v4.pkl` at import/startup using `joblib`.

If loading fails, the application still starts but prediction endpoints return HTTP 500 stating that the model is not loaded.

### 8.2 Input model

`StudentFeatures` requires:

```json
{
  "CGPA": 3.45,
  "Attendance": 92,
  "PLO_1": 80,
  "PLO_2": 75,
  "PLO_3": 80,
  "PLO_4": 80,
  "PLO_5": 80,
  "PLO_6": 80,
  "PLO_7": 80,
  "PLO_8": 80,
  "PLO_9": 88,
  "Sijil": "Tiada"
}
```

`Sijil` is accepted by the API model but is not included in the numeric DataFrame passed to the current trained model. The model features are CGPA, attendance, PLO 1–9, PLO average, and PLO variance.

### 8.3 ML endpoints

| Method | Path | Behavior |
|---|---|---|
| GET | `/` | health response `AI Server V4 is running` |
| POST | `/predict/risk` | engineers features and returns one prediction |
| POST | `/predict/batch` | predicts a list while preserving order |
| POST | `/etl/process-mdb` | temporarily stores, parses, and deletes an MDB file |

For both prediction endpoints, the service calculates:

- `PLO_Avg` — mean of the nine PLO values;
- `PLO_Variance` — variance of the nine PLO values.

If the loaded model exposes `feature_names_in_`, columns are reordered to match the model's training schema.

### 8.4 MDB ETL

`process_mdb_data` reads the following tables through `mdb-export`:

- `GPA` — latest CGPA and semester GPA/CGPA history;
- `Pelajar` — student name, course, identity number, phone, and address;
- `Daftar_Subjek` — overall and semester attendance;
- `Detail_Result` — PLO marks derived from `LO1`–`LO9` codes;
- `Anugerah` — award flag;
- `Pelajar_Koko_Detail` — co-curricular pass flag.

Subjects that contain an `LO` number above 9 are excluded from PLO mapping because they use an internal CLO numbering scheme. This prevents internal LO7/LO8 values from corrupting institutional PLO7/PLO8 values.

The resulting student object contains current values, normalized PLO strings, `Status_Pelajar: "Pending AI"` initially, and `academicHistory`. The backend later replaces the status with batch model predictions.

The uploaded file is written to a temporary path for `mdbtools` and deleted in a `finally` block.

---

## 9. Data preparation and model training

### 9.1 `backend/db/inspect_mdb_linux.py`

Standalone diagnostic utility. It lists tables from `Ekspot_Senat.mdb`, exports each table, prints columns, row counts, and up to three sample rows. It uses Python's CSV parser so quoted addresses containing commas or newlines are handled safely.

### 9.2 `backend/db/sedut_mdb_tulen.py`

Extracts the original MDB into `data_tvet_muktamad.json`. It combines GPA, student identity, attendance, PLO marks, awards, co-curricular results, and semester history. It is intended for seeding MongoDB.

### 9.3 `backend/db/prepare_ml_data_3mdb.py`

Builds training data from `JJ2025.mdb`, `JD2025.mdb`, and `JJ2026.mdb`:

1. extracts required tables to `mdb_extracted/<source>/`;
2. normalizes IDs and table names;
3. pivots PLO marks;
4. aggregates attendance, marks, credits, failed subjects, dropped subjects, and co-curricular values;
5. selects latest CGPA/GPA;
6. merges awards;
7. generates `Status_Pelajar` labels;
8. backs up an existing CSV;
9. writes `ml_training_data_real.csv`.

The label generator marks a record `Bermasalah` when any of these conditions is true:

- recorded CGPA < 3.00;
- composite score < 70;
- failed subjects > 0;
- dropped subjects > 0;
- attendance < 80.

It marks `Cemerlang` when CGPA ≥ 3.90, attendance ≥ 80, and all active PLOs are at least 80. Remaining records are `Sederhana`.

### 9.4 `backend/db/relabel_option2.py`

Reapplies the same label rules to an existing training CSV. Before overwriting, it creates a timestamped backup such as `ml_training_data_real_before_option2_<timestamp>.csv`.

### 9.5 Training scripts

`ML/train_and_evaluate.py` and `ML/train_and_evaluate_v4.py` train Random Forest classifiers with engineered PLO features and grid-search hyperparameters. V4 additionally detects repeated students and uses `GroupShuffleSplit` to reduce student-level data leakage. It chooses safe cross-validation folds based on minority-class size and writes `model_ai_risiko_lengkap_v4.pkl`.

The tracked `.pkl` files are binary joblib/scikit-learn model artifacts and cannot be meaningfully explained by line-by-line reading. Their operational contract is defined by the feature construction in `ml.py` and the training scripts.

---

## 10. MDB import synchronization

The full admin import path is:

1. Browser selects `.mdb`.
2. Frontend sends multipart data to `/api/data/upload-mdb`.
3. Backend validates admin JWT and `.mdb` extension.
4. Backend keeps the file in memory.
5. Backend sends it to ML `/etl/process-mdb`.
6. ML writes a temporary file and extracts student records.
7. Backend maps every student to ML input fields.
8. Backend calls ML `/predict/batch`.
9. Backend writes each returned prediction into `Status_Pelajar`.
10. Backend deletes MongoDB students whose IDs are absent from the new import.
11. Backend bulk-upserts students by `ID_Pelajar`.
12. Backend bulk-upserts student users using `<ID_Pelajar>@student.ikmb.edu.my`.
13. Student account passwords are reset to the bcrypt hash of `password123` during this operation.
14. Existing uploaded certificate/profile fields are not included in the `$set`, so they remain on existing student documents.

`backend/repredict-status.js` provides a separate refresh operation. It loads all students, sends batches of 500 to `/predict/batch`, and bulk-updates `Status_Pelajar`.

---

## 11. File uploads

| Feature | Endpoint | Limit | Types | Storage |
|---|---|---:|---|---|
| certificate | `/api/students/:studentId/certificates` | 5 MB | PDF/JPG/PNG | `backend/uploads/certificates` |
| profile image | `/api/students/:studentId/profile-image` | 5 MB | PDF/JPG/PNG by shared backend filter | `backend/uploads/certificates` |
| referral attachment | `/api/reports` | 5 MB | PDF/JPG/PNG | `backend/uploads/referrals` |
| student report | `/api/student-reports` | 5 MB | PDF only | `backend/uploads/reports` |
| MDB import | `/api/data/upload-mdb` | 100 MB | `.mdb` | memory only in backend, temporary file in ML |

Stored filenames use a timestamp plus random number and keep the original extension. Metadata stores the original filename and public relative path.

---

## 12. Configuration

### Frontend

`BACKEND_URL` controls server-side backend calls and defaults to `http://127.0.0.1:5000`.

### Backend

Expected variables:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard
JWT_SECRET=<secret>
ML_API_URL=http://127.0.0.1:8000
```

The repository contains `backend/.env.example`, while the working tree may contain local environment files. Secrets and local environment files are ignored by Git and should not be copied into public documentation.

### Compose overrides

Compose uses service DNS names:

- backend → `mongodb://mongodb:27017/ikmb-dashboard`;
- backend → `http://ml-api:8000`;
- frontend → `http://backend:5000`.

Compose maps frontend host port 8080 to container port 3000. Direct local development uses port 3000.

---

## 13. Containers and deployment

### Frontend container

`Containerfile.frontend` has three stages:

1. install dependencies on Node 20 Alpine;
2. build the standalone Next.js output;
3. run the standalone server as a non-root `nextjs` user.

### Backend container

`backend/Containerfile.backend` uses Node 20 Alpine, installs production dependencies, copies the backend, exposes 5000, and starts `server.js`.

### ML container

`ML/Containerfile` uses Python 3.9 slim, installs `mdbtools`, installs Python requirements, copies the service and model files, and starts Uvicorn on 8000.

### Compose

`compose.yml` defines `mongodb`, `backend`, `ml-api`, and `frontend` on the `tvet_net` bridge network. MongoDB persists to `./mongodb_data`. Backend waits five seconds before starting, but this is a fixed delay rather than a readiness health check.

---

## 14. Development commands

### Root frontend

```bash
npm install
npm run dev
npm run build
npm test
```

The root `package.json` contains `dev`, `build`, `start`, `lint`, and `test` scripts.

### Backend

```bash
cd backend
npm install
npm run dev
npm test
npm run seed
```

The backend test command runs Jest with `NODE_ENV=test`, ESM support, and forced exit.

### ML service

```bash
cd ML
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn ml:app --host 0.0.0.0 --port 8000
pytest test_ml.py
```

`start-local-dev.sh` is a convenience script specific to the checked-out machine. It probes ports 5000, 8000, and 3000, starts missing services with `nohup`, and writes logs under `/tmp`.

### Compose

```bash
docker compose -f compose.yml up --build
docker compose -f compose.yml down
```

---

## 15. Testing and CI

### Frontend tests

Vitest uses the `jsdom` environment and the `@` alias to `src`. Tests cover:

- login form rendering;
- generated report modal rendering and closed state;
- referral form loading, validation, multipart submission, and closed state;
- appointment calendar rendering, month navigation, and selected-day completion action.

### Backend tests

Jest and Supertest cover:

- successful and failed login behavior;
- rejection of missing and invalid JWTs for student APIs;
- rejection of missing and invalid JWTs for referrals and student reports.

### ML tests

Pytest uses FastAPI `TestClient` to test health, valid prediction input, and Pydantic validation for missing PLO fields.

### GitHub Actions

`.github/workflows/ci.yml` runs four stages:

1. frontend install, Vitest, and Next build;
2. backend install and Jest;
3. Python setup, mdbtools installation, dependency install, and Pytest;
4. Docker image builds after the first three jobs pass.

The workflow runs on pushes and pull requests targeting `main` or `master`.

---

## 16. Repository structure

```text
.
├── src/                         Next.js frontend source
│   ├── app/                     App Router pages, actions, proxy, CSS
│   ├── components/              shared UI and dashboard clients
│   ├── lib/                     authentication and scoring helpers
│   ├── assets/                  retained SVG asset
│   └── __tests__/               Vitest component tests
├── backend/                     Express API service
│   ├── server.js                app bootstrap
│   ├── auth.js                  auth routes
│   ├── items.js                 student, upload, prediction, MDB routes
│   ├── reports.js                counselor referral routes
│   ├── studentReports.js        student-report routes
│   ├── auth.model.js             authentication data logic
│   ├── item.model.js             student normalization and AI integration
│   ├── middleware/               JWT and role middleware
│   ├── models/                   Mongoose schemas
│   ├── db/                       MDB extraction and ML data preparation
│   └── __tests__/                Jest API tests
├── ML/                          FastAPI service and model artifacts
│   ├── ml.py                     prediction and ETL API
│   ├── train_and_evaluate*.py   model training scripts
│   ├── test_ml.py                ML tests
│   ├── requirements.txt          Python dependencies
│   ├── Containerfile             ML image definition
│   └── *.pkl                     serialized model versions
├── public/                      Next public assets
├── compose.yml                  multi-service orchestration
├── Containerfile.frontend       frontend image
├── next.config.mjs              Next standalone/rewrite/image configuration
├── middleware.js                Next route guard
├── package.json                 frontend scripts/dependencies
├── vitest.config.js             frontend test configuration
├── tailwind.config.js           Tailwind content/theme configuration
├── postcss.config.js            Tailwind and Autoprefixer configuration
├── .github/workflows/ci.yml     CI and image builds
├── README.md                    project-level setup/API summary
├── summary.md                   expanded project summary
└── detailed.md                 this implementation guide
```

### Generated, local, or binary content

The repository also contains or may contain:

- `.next/` — Next build output;
- `node_modules/` and `backend/node_modules/` — installed dependencies;
- `ML/venv/` — local Python virtual environment;
- `__pycache__/` and `.pyc` — Python bytecode;
- `.pkl` — binary ML models;
- `.mdb`, `.csv`, and extracted tables — institutional data artifacts;
- `backend/uploads/` — runtime student files;
- image and SVG assets;
- lockfiles — machine-generated dependency resolution records.

These files support execution or data processing but are not architectural source modules. `.gitignore` excludes most local, sensitive, generated, and runtime content.

---

## 17. Important implementation observations

These observations describe the current code and help future maintainers avoid assuming that the README and implementation are identical in every detail:

1. The root README describes Docker frontend access on port 3000, while `compose.yml` maps host port 8080 to container port 3000.
2. The root README describes referral creation as `pending`, but the current `reports.js` creation route requires a counselor and date and saves new referrals as `scheduled`.
3. `backend/.env.example` says `PORT=5001`, while the server and Compose configuration use port 5000.
4. The frontend staff manual-prediction form uses lowercase keys such as `cgpa` and `plo1`; `item.model.js` performs the expected conversion to the ML schema.
5. The backend stores several numeric academic values as strings and normalizes them to numbers only when preparing frontend responses or ML payloads.
6. Profile images use the same shared PDF/JPG/PNG upload filter as certificates, even though the frontend image input advertises image files.
7. `next.config.mjs` retains an `/uploads` rewrite, while API calls use the explicit catch-all proxy route.
8. The `Sijil` field is part of the public ML input model but is not currently included as a model feature in the numeric prediction DataFrame.
9. `ML_TEST_RESULTS.md` records three passing ML tests; the current source also includes frontend and backend tests that run independently.

These are documentation facts, not automatic recommendations. They should be considered whenever deployment behavior, API documentation, or future refactoring is changed.

---

## 18. Typical end-to-end scenarios

### Student login and dashboard

1. Student submits credentials.
2. Backend verifies bcrypt password and returns JWT/user.
3. Frontend stores cookies and redirects to `/student-dashboard`.
4. Dashboard calls `/api/students` and `/api/reports/mine`.
5. Dashboard calls the student's skill-gap endpoint.
6. Backend loads student data, asks ML for current risk, creates PLO chart/insight, and returns the response.

### Admin imports a new institutional database

1. Admin opens Pengurusan Data.
2. Admin chooses an `.mdb` file.
3. Frontend sends multipart data through the Next proxy.
4. Backend validates admin JWT and file type.
5. ML extracts and combines the Access tables.
6. Backend predicts all imported students in a batch.
7. Backend deletes missing old students and bulk-upserts imported students/users.
8. Frontend shows success and reloads the dashboard.

### Staff sends a report

1. Staff opens a student profile.
2. Staff opens Jana Laporan.
3. Frontend pre-fills student metrics and calculates employability.
4. Staff enters a message and/or selects a PDF.
5. Backend validates staff authorization, stores the PDF if supplied, derives report type, and saves the document.
6. Student sees the report in Laporan Saya.
7. Opening the report marks it read and allows PDF viewing, download, printing, or sharing.

### Admin refers a student to counseling

1. Staff opens a student profile and selects an intervention.
2. Admin selects reason, appointment, counselor, priority, and optional attachment.
3. Backend validates the counselor and saves the referral.
4. Counselor sees the referral in the queue.
5. Counselor accepts/rejects, schedules, and completes the referral.
6. Student sees accepted/scheduled appointments through `/api/reports/mine`.

---

## 19. Summary

This project is a three-service student analytics platform. Next.js provides role-specific dashboards and a secure server-side API proxy. Express owns authentication, authorization, MongoDB persistence, uploads, student normalization, report workflows, and ML orchestration. FastAPI owns model execution and legacy MDB extraction. Python scripts create training data and model versions from institutional data.

The most important identifiers and contracts are:

- `ID_Pelajar` links imported student records, MongoDB documents, JWT student accounts, URLs, reports, and referrals;
- `ikmbToken` carries backend authentication;
- `user` drives frontend role routing and display;
- `PLO_1`–`PLO_9`, CGPA, and attendance drive analytics;
- `Status_Pelajar` is the model-facing status;
- `dropoutRisk` is the normalized frontend risk label;
- `Report` is the counselor workflow record;
- `StudentReport` is the staff-to-student communication record.

The architecture is understandable as one flow: institutional data enters through MDB ETL, MongoDB stores the normalized records, ML classifies risk, Express protects and exposes the data, and Next.js presents dashboards and intervention workflows for staff and students.

---

## 20. Current implementation update

This section records the implementation that exists in the current working tree. It supplements the original architecture description above and is especially important for the recent UI, appointment, attachment-preview, and role-label changes.

### 20.1 Current source inventory

The current `src` tree contains these functional areas:

```text
src/
├── app/
│   ├── actions.js
│   ├── globals.css
│   ├── layout.jsx
│   ├── page.jsx
│   ├── api/[...proxy]/route.js
│   ├── staff-dashboard/page.jsx
│   ├── student-dashboard/page.jsx
│   └── student-profile/page.jsx
├── components/
│   ├── auth/LoginForm.jsx
│   ├── dashboard/
│   │   ├── AppointmentCalendar.jsx
│   │   ├── CounselorDashboardClient.jsx
│   │   ├── MergedLaporanTab.jsx
│   │   ├── StaffDashboardClient.jsx
│   │   ├── StudentDashboardClient.jsx
│   │   ├── StudentProfileClient.jsx
│   │   └── StudentReportsTab.jsx
│   ├── ui/
│   │   ├── AttachmentPreview.jsx
│   │   └── dashboard-kit.jsx
│   ├── GenerateReportModal.jsx
│   ├── JobCard.jsx
│   ├── KpiCard.jsx
│   ├── ReportFormModal.jsx
│   ├── Sidebar.jsx
│   ├── StudentDetailModal.jsx
│   ├── StudentListGrid.jsx
│   └── StudentModal.jsx
├── lib/
│   ├── auth.js
│   ├── client-auth.js
│   ├── heuristics.js
│   ├── roles.js
│   └── use-file-preview.js
└── __tests__/
    ├── AppointmentCalendar.test.jsx
    ├── attachment-preview.test.jsx
    ├── dashboard-kit.test.jsx
    ├── GenerateReportModal.test.jsx
    ├── Login.test.jsx
    ├── MergedLaporanTab.test.jsx
    ├── ReportFormModal.test.jsx
    ├── roles.test.js
    └── StudentDetailModal.test.jsx
```

The old `StudentReportsTab.jsx` remains in the repository and still contains the original reports-only implementation. The active student dashboard now renders `MergedLaporanTab.jsx` for the `reports` tab, so `StudentReportsTab.jsx` is currently retained code rather than the active route component.

### 20.2 Merged student “Laporan Saya” experience

The student dashboard uses `MergedLaporanTab` instead of rendering `StudentReportsTab` directly:

```jsx
{activeTab === "reports" && <MergedLaporanTab />}
```

`MergedLaporanTab.jsx` fetches both sources in parallel:

- `GET /api/student-reports` for generated staff reports;
- `GET /api/reports/mine` for accepted/scheduled counselor appointments.

Each result is normalized with an `itemType`:

```text
student report  → itemType: "report"
appointment     → itemType: "appointment"
```

The normalizer also creates:

- `displayTitle` — report title or an intervention label;
- `displayDate` — report `createdAt` or appointment `scheduledDate`.

The merged array is sorted newest-first. Missing or invalid dates sort to the bottom because the sorter treats a missing date as timestamp zero.

The tab provides:

- a record count;
- filter pills for `Semua`, `Laporan`, and `Temujanji`;
- report/appointment counts computed with `useMemo`;
- loading skeleton rows;
- a dashed empty state;
- blue report and purple appointment badges/icons;
- a red `Baharu` badge for unread student reports;
- status badges for appointments;
- a shared `Lihat Butiran` button.

When a student opens an unread generated report, the component calls `GET /api/student-reports/:id`. The backend marks `readByStudent` true. The component then updates its local merged item, removes the unread badge, and opens the returned detail data.

Appointments do not call a student detail endpoint. The student appointment endpoint already returns the fields needed by the modal, and the staff-only `GET /api/reports/:id` route must not be used by a student.

### 20.3 Shared student detail modal

`src/components/StudentDetailModal.jsx` is the shared detail surface for both appointment and report records. It supports two compatible APIs:

1. Explicit mode:
   ```jsx
   <StudentDetailModal
     kind="appointment"
     appointment={appointment}
     onClose={...}
   />
   ```
2. Merged-item mode:
   ```jsx
   <StudentDetailModal item={selectedItem} onClose={...} />
   ```

The component resolves `item.itemType` before falling back to `kind`. This keeps older appointment/report callers working while allowing the merged tab to pass one object.

Appointment details display:

- intervention type;
- scheduled date and time;
- workflow status;
- priority;
- counselor email stored in `counselorId`;
- creating admin email;
- course and student ID;
- referral reason;
- counselor notes when present;
- referral attachment link when present.

Generated report details display:

- student identity and academic snapshot;
- CGPA, attendance, course, semester, risk, employability;
- report message;
- embedded PDF when present;
- download, print, and share controls.

The modal closes through the close button, backdrop click, or Escape. It uses `max-h-[90vh]` and internal overflow scrolling.

### 20.4 Counselor dashboard UI and default view

`CounselorDashboardClient.jsx` still owns referral data and workflow behavior, but its presentation now uses the shared dashboard kit.

The initial state is explicitly:

```jsx
const [activeTab, setActiveTab] = useState("calendar");
```

Therefore, opening the Kaunselor tab first shows the calendar. The parent staff dashboard conditionally mounts the counselor component, so switching away and returning resets the local counselor view to Calendar.

The dashboard now includes:

- four gradient `StatCard`s for pending, scheduled, completed, and total referrals;
- accessible `PillTabs` for pending, scheduled, calendar, completed, and all;
- a white card wrapper around the appointment calendar;
- unified responsive referral rows;
- intervention icons for counseling, clinic, and soft-skills records;
- badges for intervention type, status, and priority;
- the existing accept/reject/schedule/complete actions.

The real backend field is `interventionType`. UI code must not use the hypothetical field name `intervention`. Priority values are `urgent` and `normal`, not `tinggi`, `sederhana`, or `rendah`.

### 20.5 Shared dashboard UI kit

`src/components/ui/dashboard-kit.jsx` defines the current visual primitives:

- `Badge` — tone-based compact badge;
- `StatCard` — gradient icon tile plus metric value;
- `SectionCard` — titled white card with icon header and actions slot;
- `PillTabs` — tablist/tab semantics, `aria-selected`, counts, and focus-visible styling;
- `EmptyState` — consistent dashed empty panel;
- `SkeletonList` — loading placeholders;
- `formatMsDate` — Malay date formatter returning `-` for invalid input.

Tone tokens currently include blue, purple, green, amber, rose, and slate. The kit keeps the counselor and student record UIs consistent with the Overview dashboard without adding another dependency.

### 20.6 Attachment preview system

The two staff modals use one attachment-preview implementation.

#### `src/lib/use-file-preview.js`

`useFilePreview` manages:

- selected `File` state;
- an object URL for display;
- validation error state;
- selection and clear callbacks;
- object URL cleanup on replacement and unmount.

The default accepted MIME types are PDF, JPEG, and PNG. The hook also accepts a matching extension when the browser reports an empty or unusual MIME type. The default limit is 5 MB.

It exports `formatFileSize`, which formats bytes as B, KB, or MB.

#### `src/components/ui/AttachmentPreview.jsx`

The shared preview displays:

- original filename;
- formatted file size;
- `Buka` link for browser fallback;
- `Buang` action;
- PDF iframe preview;
- image preview using `object-contain`.

#### Set Temujanji

`ReportFormModal.jsx` uses the default hook configuration for PDF/JPG/PNG. The browser field remains named `file` in `FormData`, matching backend `upload.single("file")`.

The modal now has a three-region layout:

1. fixed header;
2. independently scrollable body with `overflow-y-auto overscroll-contain`;
3. fixed footer containing `Batal` and `Hantar Rujukan`.

The modal also locks document body scrolling while open, supports `90dvh` where available, and uses a static intervention-style map. This avoids Tailwind classes such as `bg-${color}-50`, which Tailwind cannot reliably discover during compilation.

#### Jana Laporan

`GenerateReportModal.jsx` uses `useFilePreview({ acceptTypes: ["application/pdf"] })`. It keeps the backend field name `file`, adds the same PDF preview, and resets the file on opening or removal. Its outer panel has internal overflow scrolling and the same body scroll lock.

### 20.7 Current role-label behavior

`src/lib/roles.js` is the frontend role-label source of truth:

| Stored role | Display label | UI group |
|---|---|---|
| `admin` | `Penyelaras` | `staff` |
| `counselor` | `Penyelaras` | `staff` |
| `user` | `Pelajar` | `student` |

`Sidebar.jsx` uses `getRoleLabel(currentUser?.role)`. This fixes the previous fallback where every non-admin role displayed as `Pelajar`.

This is presentation-only. The stored MongoDB role and JWT claim remain `counselor`, and backend authorization still distinguishes `admin` from `counselor`. Report author attribution intentionally continues to display `Kaunselor` where the UI is describing who authored a report; the sidebar is the place where counselor is grouped under the staff-facing `Penyelaras` label.

`isStaff` is also available from the same module for future frontend guards, but existing route protection still uses its established explicit `admin`/`counselor` checks.

### 20.8 Current modal scroll behavior

The repository now treats modal overflow as a reusable UI requirement:

- `ReportFormModal` — fixed header/body/footer layout;
- `GenerateReportModal` — internal panel scroll plus `overscroll-contain`;
- counselor schedule modal — max-height and internal scroll;
- counselor completion modal — max-height and internal scroll;
- `StudentModal` — already uses max-height and internal scroll;
- `StudentDetailModal` — already uses max-height and internal scroll.

The body scroll lock is implemented in the two large staff form modals. The smaller counselor action modals rely on their constrained panel scroll because their interaction is short and localized.

---

## 21. Current test coverage

The current frontend suite contains nine test files and 35 passing tests in the working tree. In addition to the earlier login, report, referral, and calendar coverage, current tests cover:

- `MergedLaporanTab.test.jsx` — merging, normalization, sorting, missing dates, badges, and modal opening;
- `StudentDetailModal.test.jsx` — appointment and report detail rendering;
- `attachment-preview.test.jsx` — shared PDF/image preview, oversized-file rejection, both modals, and modal scroll regression;
- `dashboard-kit.test.jsx` — `aria-selected`, tab changes, section/empty primitives, date guards, and badge rendering;
- `roles.test.js` — counselor/admin staff labels, student label, unknown-role fallback, and staff grouping.

The attachment tests stub `URL.createObjectURL` and `URL.revokeObjectURL` because jsdom does not provide browser object-URL behavior by default.

The test command remains:

```bash
npm test
```

The latest verified frontend result is:

```text
Test Files  9 passed (9)
Tests       35 passed (35)
```

The backend suite remains three Jest suites with eight tests. The ML suite remains the three FastAPI/Pytest checks described earlier. The latest frontend build also succeeds after the modal and dashboard UI changes.

---

## 22. Current file-by-file change map

The most recently updated application files have these responsibilities:

| File | Current responsibility |
|---|---|
| `src/components/dashboard/MergedLaporanTab.jsx` | Fetch and filter merged reports/appointments; unread handling; shared detail modal |
| `src/components/dashboard/CounselorDashboardClient.jsx` | Staff referral workflow, Calendar-first tabs, responsive referral UI |
| `src/components/ReportFormModal.jsx` | Create referral, select counselor, upload attachment, scroll-safe form |
| `src/components/GenerateReportModal.jsx` | Create student report, optional PDF, scroll-safe form |
| `src/components/StudentDetailModal.jsx` | Shared appointment/report detail display |
| `src/components/ui/dashboard-kit.jsx` | Shared dashboard visual primitives and date formatting |
| `src/components/ui/AttachmentPreview.jsx` | PDF/image preview and file controls |
| `src/lib/use-file-preview.js` | File validation, object URL lifecycle, file-size formatting |
| `src/lib/roles.js` | Frontend role labels and staff grouping |
| `src/components/Sidebar.jsx` | Uses centralized role labels for the logged-in user badge |
| `src/__tests__/attachment-preview.test.jsx` | Preview, validation, and modal-scroll regression tests |
| `src/__tests__/dashboard-kit.test.jsx` | Shared dashboard UI primitive tests |
| `src/__tests__/roles.test.js` | Role label/group tests |

The backend contracts used by these features remain:

- referral upload field: `file`;
- report upload field: `file`;
- appointment date: `scheduledDate`;
- appointment intervention: `interventionType`;
- appointment counselor: `counselorId`;
- counselor notes: `counselorNotes`;
- generated report file path: `filePath`.

These names are important because several early UI proposals used aliases such as `attachment`, `appointmentDate`, `intervention`, `notes`, and `pdfPath`. The current implementation does not use those aliases.
