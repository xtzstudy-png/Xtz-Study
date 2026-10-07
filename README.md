# XtzStudy

A modern education platform concept for Classes 1 to 10, designed with a child-friendly student portal and a secure admin dashboard.

## Features included

- Admin dashboard with class management, student overview, and announcements
- Student dashboard with class-based learning paths, progress tracking, and recommended courses
- Search results for subjects, chapters, notes, tests, and videos
- Student account registration and role-protected student/admin sign-in
- Password hashing, rate-limited authentication, and HTTP-only signed session cookies
- SQLite user database stored locally in the ignored `data/` directory
- Admin PDF study-material upload with type and size validation, saved files, draft/publish controls, and class-specific student access
- Admin course portal for creating Computer Science (BCA, B.Tech) and Management (BBA, MBA) courses, with draft/publish controls
- Course posts for PYQ, tests, and other resources, with optional validated PDF uploads and published student access
- Responsive educational UI for mobile, tablet, and desktop screens

## Run locally

Copy `.env.example` to `.env` and set a random `JWT_SECRET` (at least 32 bytes),
an `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` (12-72 bytes). The server creates
the initial admin account on first startup. Student accounts are created through
the Student Portal registration form.

```bash
npm install
npm run dev
```

Open the local Vite URL in your browser. The development command starts both
the Vite frontend and the authentication API. Do not commit `.env` or the
`data/` directory.

## Build for production

```bash
npm run build
npm start
```

In production, serve the built frontend and API from the same origin over HTTPS.
Set `NODE_ENV=production` so session cookies are marked secure. The admin seed
credentials are used only when creating the first admin record; changing the
environment password does not overwrite an existing account.
