# School Hub

A full-stack school management system in active development for a single school. It includes an admin dashboard and working modules for students, teachers, classes, attendance, fees, and exams.

> Do not enter real student, guardian, or payment data yet. The current runnable application remains a local MVP until the PostgreSQL and Microsoft Entra migration described in [docs/AZURE_ENTERPRISE_ARCHITECTURE.md](docs/AZURE_ENTERPRISE_ARCHITECTURE.md) is completed.

## Included Features

- Dashboard with enrollment, faculty, attendance, outstanding fees, and upcoming exams
- Create, edit, delete, list, and search flows for each module
- REST JSON API implemented with Node.js
- File-based persistence in `data/db.json`, initialized with sample data on first start
- Administrator login screen with session-protected data APIs and sign out
- Security headers, expiring sessions, failed-login throttling, and production fail-closed checks
- Input validation and automatic fee payment status calculation
- Automated unit tests for core data behavior

## Run Locally

This project needs Node.js 20 or newer. In the Codex workspace, a bundled Node runtime is available:

```powershell
& 'C:\Users\HP\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.js
```

Open `http://127.0.0.1:3000` in your browser.

Sign in using the MVP administrator account:

```text
Email: admin@brightfuture.edu
Password: Admin@123
```

You may override these credentials with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables before starting the server.

With Node.js installed on your system PATH, you can instead use:

```powershell
npm start
```

## Run Tests

```powershell
& 'C:\Users\HP\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test
```

## API Endpoints

- `GET /api/bootstrap` returns the complete application snapshot and dashboard totals.
- `POST /api/auth/login` starts an administrator session.
- `GET /api/auth/session` validates an authenticated session.
- `POST /api/auth/logout` signs out the active session.
- `GET /api/{resource}` lists records for `students`, `teachers`, `classes`, `attendance`, `fees`, or `exams`.
- `POST /api/{resource}` creates a record.
- `PATCH /api/{resource}/{id}` updates a record.
- `DELETE /api/{resource}/{id}` removes a record.

## Next Production Steps

The Azure target architecture and protected data-foundation template are included:

- [SECURITY.md](SECURITY.md)
- [docs/AZURE_ENTERPRISE_ARCHITECTURE.md](docs/AZURE_ENTERPRISE_ARCHITECTURE.md)
- [infra/azure/data-foundation.bicep](infra/azure/data-foundation.bicep)

The next implementation milestone is replacing JSON persistence and local sign-in with PostgreSQL repositories and Microsoft Entra External ID token validation before any cloud deployment containing real data.
