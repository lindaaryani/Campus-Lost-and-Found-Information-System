# CampusFind

Lost & Found information system for the ITB STIKOM Bali campus community. Built from the project's
Software Requirements Specification (`SKPL_CAMPUS_FIND.docx`), which is the source of truth.

Users (students, lecturers, staff) report lost or found items, search reports, receive match
recommendations produced by **Weighted Similarity Scoring**, and submit ownership claims.
Administrators verify claims and manage reports, master data, accounts, statistics, and the audit log.

All user-facing text is in Bahasa Indonesia. Code, documentation, and architecture notes are in English.

> Read `docs/ASSUMPTIONS.md` before using this in production. The SKPL leaves several things undefined
> (identity verification, matching rules, claim flow details) and this implementation made documented choices.

## Stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), TypeScript |
| UI | Tailwind CSS 4, shadcn-style components (Radix UI + cva, hand-written), Lucide icons, Plus Jakarta Sans |
| Backend | Server Components, Server Actions, Route Handlers (no separate API server) |
| Database | MySQL 8 via `mysql2` (parameterized queries only) |
| Passwords | Argon2id (`@node-rs/argon2`) |
| Sessions | Random 256-bit token in an HttpOnly cookie; only the SHA-256 hash is stored in the `sessions` table |
| Validation | Zod on the server; native HTML constraints and file checks on the client |

## Quick start

Prerequisites: Node.js 20+ (developed on 22), MySQL 8.

```bash
# 1. Install
npm install

# 2. Create the database and user (as a MySQL admin)
mysql -u root -p -e "
  CREATE DATABASE campusfind CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'campusfind'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
  GRANT ALL ON campusfind.* TO 'campusfind'@'localhost';"

# 3. Configure
cp .env.example .env.local      # then edit DB_PASSWORD and SEED_ADMIN_PASSWORD
                                # quote values containing '#', e.g. SEED_ADMIN_PASSWORD="Abc#12345678"

# 4. Create tables and seed master data + the first ADMIN account
npm run db:init
npm run db:seed

# 5. (optional, development only) demo users and reports
npm run db:seed-demo

# 6. Run
npm run dev                     # http://localhost:3000
```

Production: `npm run build && npm run start`. Set `NODE_ENV=production` (enables `Secure` cookies, so serve over HTTPS).

Sign in at `/login`. The login page serves both roles: pick **Mahasiswa / Dosen / Staf** (identity number + password)
or **Admin** (username + password, created by `db:seed`). Admin accounts cannot self-register.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run db:init` | Run `db/schema.sql` (idempotent) |
| `npm run db:seed` | Seed categories, locations, first ADMIN (`SEED_ADMIN_*`) |
| `npm run db:seed-demo` | Demo users and reports (refuses `NODE_ENV=production`) |
| `npm run db:reset` | Drop all tables and recreate (requires `CONFIRM_RESET=yes`) |
| `npm run test:unit` | Scoring algorithm unit tests |
| `npm run test:db-setup` | Recreate and seed the `campusfind_test` database |
| `npm run test:integration` | Domain services against real MySQL (`DB_NAME=campusfind_test`) |
| `npm run test:perf` | 20,000-row query benchmark (NFR-05) |
| `npm run test:e2e` | Playwright flows; needs a running server (see `docs/TEST-RESULTS.md`) |
| `scripts/backup.sh`, `scripts/restore.sh` | Database + upload backup and restore (NFR-11, NFR-16) |

Integration and perf tests refuse to run unless `DB_NAME` ends with `_test`.

## Configuration

See `.env.example`. Notable settings: `MATCH_THRESHOLD` (percent, default 50, **not empirically validated**),
`MATCH_DATE_WINDOW_DAYS` (default 14), `ALLOW_SELF_REGISTRATION`, `STORAGE_DIR`, `MAX_PHOTO_MB`, `MAX_EVIDENCE_MB`.

## Project structure

```
db/schema.sql                 MySQL schema (SKPL ERD + sessions + audit_logs)
scripts/                      db init/seed/demo, backup/restore
src/
  proxy.ts                    cheap cookie-presence redirect (NOT authorization)
  lib/                        db, session, authz, uploads, validation, audit, config, labels
  modules/                    NFR-12 separation: auth, items, matching, claims, notifications, admin
    matching/scoring.ts       pure Weighted Similarity Scoring (unit-tested)
  app/
    (auth)/                   /login, /register, server actions
    (user)/                   USER pages and actions
    admin/                    ADMIN pages and actions
    api/files/                authorized file serving (photos, claim evidence)
  components/ui/              shadcn-style primitives
  components/shared/          shell, badges, forms, cards, dialogs, tables
tests/                        unit, integration, perf, e2e
docs/                         ASSUMPTIONS, FR-CHECKLIST, TEST-RESULTS, screenshots
```

Domain rules live in `src/modules/*/service.ts`, which take the acting user as an argument and enforce
role and ownership themselves. Server Actions are thin: authorize, validate (Zod), call a service, revalidate.

## Security model

- **Authorization is enforced on the server in three places**: pages (`requireUser`/`requireAdmin`), Server Actions
  (`assertUser`/`assertAdmin`), and services (role/ownership checks). Role and account status are re-read from the
  database on every request. `proxy.ts` is only an optimization.
- **Private data**: `private_identifier` and claim evidence are selected only in owner/admin code paths. List and public
  queries never select `private_identifier`; detail projection returns it only to the owner and ADMIN. Verified in HTML
  and in the RSC payload by tests.
- **Uploads**: type is detected from magic bytes (never from the client's name or MIME), size-limited, stored under a random
  UUID name outside `public/`, and served through authorized routes with `nosniff` and a sandbox CSP.
- **Sessions**: HttpOnly, SameSite=Lax cookie; logout and account suspension delete the server-side session; a new session
  replaces any previous one on login.
- **Login throttling**: 5 failures per identity and 30 per IP per 15 minutes, in memory (single instance).
- **Integrity**: foreign keys, CHECK constraints (role/identity shape, BR-04), and a unique generated column that allows at most
  one active claim per report even under concurrent requests.

## Backup and restore

```bash
./scripts/backup.sh /var/backups/campusfind        # DB dump + uploads, with checksums and rotation (BACKUP_KEEP, default 14)
CONFIRM_RESTORE=yes ./scripts/restore.sh /var/backups/campusfind/campusfind-YYYYMMDD-HHMMSS
```

Scheduling is up to the operator (for example cron). Stop the app before restoring.

## Known limitations

Details in `docs/ASSUMPTIONS.md`. In short: identity verification at registration is not implemented (SKPL BR-05 is open),
no password reset or change, no email notifications, keyword search uses `LIKE` (fine at the 20k-row benchmark, would need
FULLTEXT or a search engine at much larger scale), uploaded images are not decoded or re-encoded, the login throttle is not
shared across instances, and only Chromium-based rendering was tested.
