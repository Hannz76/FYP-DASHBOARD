# Run the TVETMARA Besut dashboard

## Start with Docker Compose

1. Copy `.env.example` to `.env`.
2. Generate a secret with `openssl rand -hex 32` and set `JWT_SECRET` in `.env`.
3. Add your OpenWeb Ninja key to `JSEARCH_API_KEY` to enable job searches. Add `GEMINI_API_KEY` if you use AI responses.
4. Start your host MongoDB instance. The current Compose configuration requires its Unix socket at `/tmp/mongodb-27017.sock`.
5. Run `docker compose config --quiet` to validate the configuration.
6. Run `docker compose up -d --build` to build and start the current source code.
7. Open [localhost:8080](http://localhost:8080).

Compose runs the frontend, backend, ML API, and Redis. MongoDB runs on the host. Changing `JWT_SECRET` takes effect when you recreate the backend container and requires users to sign in again.

## Start the services locally

1. Copy `.env.example` to `.env.local` for Next.js. Its local backend URL is `http://127.0.0.1:5000`.
2. Copy `backend/.env.example` to `backend/.env` and set a private `JWT_SECRET`.
3. Start MongoDB and Redis locally, then check their URLs in `backend/.env`.
4. In `ML`, install `requirements.txt` in a Python virtual environment and run `uvicorn ml:app --host 127.0.0.1 --port 8000`.
5. In `backend`, run `npm ci`, then `npm run dev`.
6. In the project root, run `npm ci`, then `npm run dev`.
7. Open [localhost:3000](http://localhost:3000).

Use Node.js 20.19 or later. Job searches require a valid provider key and Redis. Saved jobs use MongoDB and remain after the daily search-cache reset.

## Check files before uploading

1. Run `python3 scripts/check-repository.py`.
2. Run `git diff --check`.
3. Review `git status --short` and `git diff --cached --stat` before committing.
4. Commit the source code, environment examples, dependency lockfiles, and runtime ML models.
5. Keep actual environment files, uploads, database exports, training datasets, and generated build files local.

The repository check inspects tracked files and new files that Git does not ignore. It reports credential locations without printing their values. It does not certify Git history or arbitrary binary files.

Files removed from Git tracking remain in older commits. Removing previously committed student data or credentials from history requires a separate history cleanup. If credentials were published, replace them as well.
