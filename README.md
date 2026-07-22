# NFC MediCard

A secure clinical data portal built to accompany the NFC MediCard FYP report. Three role-based
portals (Patient, Doctor, Admin) built on:

- **Frontend:** React (Vite) + Tailwind CSS + React Router + Recharts, with dark mode, a
  mobile-responsive nav drawer, toast notifications, and PDF record export.
- **Backend:** Node.js + Express + Supabase (service role client)
- **Data/Auth/Storage:** [Supabase](https://supabase.com) — Postgres database, Supabase Auth, and
  Supabase Storage. Fully hosted, so there's nothing to run locally besides your own Node
  processes (no Java, no emulators).
- **NFC scanning:** real hardware support via the **Web NFC API** on Android Chrome (tap a
  physical card, no app install needed), with a **QR code fallback** (any phone camera) for
  iOS/desktop, and manual Card UID entry as a last resort. All three paths hit the same backend
  lookup.
- **Testing/CI:** Vitest + Supertest backend test suite, run automatically on every push via
  GitHub Actions (`.github/workflows/ci.yml`).

## Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) project

## 1. Set up the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (or use an existing one).
2. Open the **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql),
   and run it. This creates all the tables (`profiles`, `patients`, `doctors`,
   `medical_history`, `lab_results`, `radiology`, `messages`, `appointments`, `vitals`,
   `audit_log`) with Row Level Security enabled and no client-facing policies — all access goes
   through the backend's service-role key.
   - Already ran an older version of this schema? Just run
     [`supabase/migration_002_audit_and_unread.sql`](supabase/migration_002_audit_and_unread.sql)
     instead to pick up the new `audit_log` table and the `messages.read` column.
3. Go to **Settings → API** and copy three values: the **Project URL**, the **anon / public key**,
   and the **service_role key** (keep this one secret — it's never used in the frontend).
4. Under **Authentication → Providers**, make sure **Email** sign-in is enabled (it is by default).
5. Under **Authentication → Settings**, make sure **"Confirm email"** is turned **ON**. Patients and
   doctors registered through the app (admin/doctor "Add Patient", "Register New Card") are created
   unconfirmed and sent a real verification email — they can't log in until they click it. Demo
   accounts from `npm run seed` are still pre-confirmed regardless of this setting, so seeding and
   local testing aren't affected either way.
   - Supabase's built-in email sending is rate-limited on the free tier (a handful of emails per
     hour) and may land in spam. If a real email doesn't arrive, you can manually confirm a user
     from **Authentication → Users** → select the user → "Confirm email" as a fallback.

Storage buckets (`lab-results`, `radiology`) are created automatically the first time the backend
starts — no manual setup needed.

## 2. Configure environment variables

```bash
cd server && cp .env.example .env
```
Edit `server/.env` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

```bash
cd ../client && cp .env.example .env
```
Edit `client/.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the **anon** key,
not the service role key).

## 3. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

## 4. Seed demo data

From `/server`, with your `.env` filled in:

```bash
npm run seed
```

This creates demo accounts and sample clinical data directly in your Supabase project. Demo logins
(password for all: `password123`):

| Role    | Email                  | Notes                          |
|---------|-------------------------|---------------------------------|
| Admin   | admin@medicard.dev      |                                  |
| Doctor  | doctor@medicard.dev     | Dr. Sarah Jenkins — Cardiology  |
| Doctor  | doctor2@medicard.dev    | Dr. Robert Chan — Endocrinology |
| Patient | patient@medicard.dev    | Card UID: `04A3B2C1`            |
| Patient | patient2@medicard.dev   | Card UID: `07D8E9F0`            |

## 5. Run the app (2 terminals)

**Terminal 1 — Backend** (from `/server`):
```bash
npm run dev
```
Runs on http://localhost:4001.

**Terminal 2 — Frontend** (from `/client`):
```bash
npm run dev
```
Runs on http://localhost:5173. Log in with any of the demo accounts above.

## Trying the NFC flow

- **On Android Chrome** (real hardware): the Doctor "Scan NFC Card" and Admin "Register New Card"
  pages detect Web NFC support automatically and show a **"Tap NFC Card"** button — tap a real
  card and it looks the patient up (or starts registration) by the card's actual hardware UID.
- **Everywhere else** (desktop, iOS): falls back to manual entry —
  - **Doctor → Scan NFC Card**: enter `04A3B2C1` to pull up the seeded patient's full record.
  - **Admin → Register New Card**: enter any new UID (e.g. `AABBCCDD`) to register a brand-new
    patient and bind it to that "card".
- **Admin/Doctor → Add Patient / Register Patient**: register a patient with no card at all — a
  card can be issued to them later.

## Feature tour

- **Dark mode** — toggle in the sidebar (🌙/☀️), persisted per-browser.
- **Mobile nav** — hamburger-triggered drawer with backdrop on small screens.
- **PDF export** — "Export PDF" button on the Doctor's patient detail page and the Patient's own
  Profile page, generates a full record summary client-side (`jspdf`).
- **Audit log** — Admin → Audit Log shows who did what (registrations, NFC scans/registrations,
  record/lab/imaging additions) and when.
- **Unread message badge** — Patient nav shows an unread count for messages from doctors,
  auto-clears when the Messages page is opened.
- **Doctor dashboard chart** — weekly record-logging activity, backed by `/api/doctor/stats`.
- **Search/filter** — on Medical History, Lab Results, and Imaging (patient + doctor views).
- **Appointment calendar** — Patient and Doctor both have an "Appointments" page with a month-view
  calendar; appointments are created from a doctor's "Update Record" form.
- **QR code fallback** — Admin's card registration screen generates a printable QR code for the
  physical card; Doctor's scan page can read it back with the device camera.
- **Email verification** — patients/doctors registered through the app must confirm their email
  before they can log in (seeded demo accounts are exempt for convenience).

## Running tests

From `/server`:
```bash
npm test
```
Runs the Vitest + Supertest suite (auth middleware, patient CRUD, NFC lookup) against a mocked
Supabase client — no real database or network access needed. The same command runs automatically
on every push/PR via GitHub Actions.

## Project structure

```
nfc-medicard/
├── .github/workflows/ci.yml              # Runs backend tests + frontend build on push/PR
├── supabase/
│   ├── schema.sql                        # Full schema + RLS (fresh setup)
│   └── migration_002_audit_and_unread.sql # Incremental migration (existing projects)
├── server/                  # Express API (Supabase service-role client)
│   ├── test/                # Vitest + Supertest suite, mocked Supabase client
│   └── src/
│       ├── routes/          # patients, medical-history, lab-results, radiology,
│       │                    # messages, nfc, appointments, admin, doctor, audit, users
│       ├── middleware/auth.js   # verifies Supabase JWTs
│       ├── lib/              # supabase client, storage upload helper, audit log helper
│       └── seed.js
└── client/                  # React app
    └── src/
        ├── pages/{patient,doctor,admin}/
        ├── components/{MonthCalendar,QrCodeCard,QrScannerView}.jsx
        ├── context/{AuthContext,ThemeContext,ToastContext,UnreadContext}.jsx
        └── lib/{supabase.js,api.js,webNfc.js,exportPdf.js}
```

## Security model

All data access goes through the Express backend, which uses the Supabase **service role** key
(bypasses Row Level Security). The frontend only ever holds the **anon** key, used solely for
Supabase Auth (sign-in), and calls the backend with the resulting access token in the
`Authorization: Bearer <token>` header. The backend's own middleware (`requireAuth` /
`requireRole`) enforces who can see and modify what. Key mutating actions (registrations, NFC
scans, record/lab/imaging additions) are recorded to `audit_log` for accountability.

## Deploying the app online (Vercel + Railway)

This deploys the frontend to **Vercel** (free) and the backend to **Railway** (free tier), both
connected to a GitHub repo so every push auto-deploys.

### 0. Push this project to GitHub

```bash
git init   # if not already a repo
git add .
git commit -m "Initial commit"
```
Create a new empty repository on [github.com/new](https://github.com/new), then:
```bash
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

### 1. Deploy the backend to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** →
   select this repo.
2. Railway will try to build from the repo root — set the **Root Directory** to `server` in the
   service settings (Settings → Source → Root Directory).
3. Under **Variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLIENT_ORIGIN` — set this after step 2 below, to your Vercel URL (comma-separate if you add
     a custom domain later, e.g. `https://app.vercel.app,https://yourdomain.com`)
   - Railway sets `PORT` automatically — no need to add it.
4. Deploy. Once live, copy the generated `https://<something>.up.railway.app` URL — that's your
   `VITE_API_URL` base for the frontend (append `/api`).

### 2. Deploy the frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the same GitHub repo.
2. Set **Root Directory** to `client`.
3. Framework preset should auto-detect as Vite. Build command `npm run build`, output `dist`
   (defaults are correct).
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` — `https://<your-railway-app>.up.railway.app/api`
5. Deploy. Copy the resulting `https://<something>.vercel.app` URL.

### 3. Close the loop

Go back to Railway and set `CLIENT_ORIGIN` to the Vercel URL from step 2 (this is what CORS checks
against), then redeploy the backend service so the change takes effect.

Your site is now live at the Vercel URL — share that with anyone to let them use the app.

## Known limitations / next steps

- Web NFC scanning only works on Android Chrome/Edge over HTTPS (or localhost) — iOS and desktop
  browsers automatically use the manual UID fallback, which is the same code path either way.
- Storage buckets are created **public** for simplicity (matches the original demo behavior). For
  a real deployment with sensitive clinical files, switch to private buckets and generate
  short-lived signed URLs per request instead (`supabase.storage.from(bucket).createSignedUrl()`).
- No automated test suite yet; verified via manual end-to-end testing.
