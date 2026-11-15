# Implementation checklist: FR-01 to FR-33, NFR, BR

Legend for **Verified by**: `U` unit test, `I` integration test (real MySQL), `E` end-to-end browser test (Chromium),
`P` performance run, `M` manual/visual review only. "UI not E2E" means the service logic is tested but the button flow
in the browser was not exercised by an automated test. Test names are in `tests/`.

## Functional requirements

| FR | Requirement (short) | Implementation | Verified by |
| --- | --- | --- | --- |
| FR-01 | Choose account type ADMIN or USER | `/login` account switch (Mahasiswa, Dosen, Staf, Admin) in `(auth)/login/login-form.tsx` | E (admin login via the same page) |
| FR-02 | Authenticate USER by identity_type, identity_number, password | `modules/auth/service.ts: authenticate` | I, E |
| FR-03 | Three USER types | `users.user_type` enum + CHECKs; register/login forms | I (DB CHECK rejects invalid pairs), E |
| FR-04 | Authenticate ADMIN by username and password | `authenticate` (ADMIN branch) | I, E |
| FR-05 | Check account status and role before access | `lib/session.ts` (joins `account_status='ACTIVE'`), `lib/authz.ts` | I (suspended blocked, sessions revoked), E |
| FR-06 | Redirect by role | `loginAction`, `app/page.tsx`, role layouts | E |
| FR-07 | View and update own profile | `/profil`, `updateProfile` | E (update persists; duplicate email rejected) |
| FR-08 | Create LOST report | `/laporan/hilang/baru`, `createItem` | I, E |
| FR-09 | Create FOUND report | `/laporan/ditemukan/baru`, `createItem` | I, E |
| FR-10 | Upload item photo | `lib/uploads.ts`, `ItemForm` | I (signature, size, type), E |
| FR-11 | Search and filter by keyword, category, location, date, type | `/cari`, `/barang-hilang`, `/barang-ditemukan`, `listItems`, `FilterBar` | I, E, P |
| FR-12 | Item detail with private information restricted | `/barang/[id]`, `getItemDetail` projection | I, E (HTML and RSC payload checked for leaks) |
| FR-13 | Find opposite-type active reports after create or update | `runMatchingForItem` called from create, update, reopen | I |
| FR-14 | Compute Weighted Similarity Score | `modules/matching/scoring.ts` | U (7 tests), I |
| FR-15 | Store results in `item_matches` | `runMatchingForItem` upsert | I |
| FR-16 | View recommendations for own reports | `/rekomendasi`, item detail, dashboard; `listMatchesForUser` | I, E |
| FR-17 | Claim an eligible FOUND report | `/barang/[id]/klaim`, `submitClaim` | I (incl. race: 5 simultaneous claims, 1 wins), E |
| FR-18 | Claim note and supporting evidence | `ClaimForm`, `saveUpload(evidence)` | I, E (PDF evidence) |
| FR-19 | ADMIN lists and views claims | `/admin/klaim`, `/admin/klaim/[id]` | E |
| FR-20 | ADMIN approves, rejects, or requests more evidence | `decideClaim`, `confirmHandover` | I (all three decisions), E (request info, approve, handover) |
| FR-21 | Notify users about matches, claim status, report status changes | `notify()` in matching, claims, items services; `/notifikasi` | I, E |
| FR-22 | ADMIN adds, views, edits, deactivates categories and locations | `/admin/kategori`, `/admin/lokasi`, `modules/admin/master.ts` | I (create, duplicate, update, deactivate, reactivate), E (add, duplicate, deactivate) |
| FR-23 | ADMIN views, moderates, updates report status | `/admin/laporan`, `adminChangeItemStatus` | I, E |
| FR-24 | ADMIN views and manages accounts and status | `/admin/pengguna`, `changeAccountStatus` | I, E (suspension ends the session) |
| FR-25 | Record every status change with time and actor | `item_status_histories` via `recordStatusChange` | I |
| FR-26 | ADMIN statistics | `/admin/statistik`, `modules/admin/stats.ts` | I (totals consistent), E (page loads) |
| FR-27 | Logout | `logoutAction` | E |
| FR-28 | Cancel a claim while PENDING | `cancelClaim`, `/klaim` | I; UI not E2E |
| FR-29 | Claim history with status and outcome | `/klaim`, `listClaimsForUser` | I, E |
| FR-30 | Mark notifications as read | `markRead`, `markAllRead` | I; E for "mark all" (single-item button UI not E2E) |
| FR-31 | ADMIN views a report's status history | `/admin/laporan/[id]`, `getItemHistory` | I, E |
| FR-32 | Audit of status changes and claim decisions | `audit_logs` via `writeAudit`; `/admin/log` | I, E |
| FR-33 | Restrict private item info and claim evidence | DTO projection, `/api/files/evidence/[claimId]`, photo route | I, E (other users get 404 for evidence; no leak in HTML/RSC) |

Additions that are not FRs (documented in `ASSUMPTIONS.md`): `/register`, owner edit/close, dismiss recommendation, NEED_INFO reply.

## Non-functional requirements

| NFR | Status | Evidence / note |
| --- | --- | --- |
| NFR-01 Secure password hashing | Done | Argon2id; hash prefix `$argon2id$` asserted in `I` |
| NFR-02 Server-side role/ownership checks | Done | pages, actions, services; `I` and `E` attempt cross-role and cross-owner access |
| NFR-03 Privacy of private info and evidence | Done | see FR-33 |
| NFR-04 Client and server validation | Done | Zod on the server; native `required`/`min`/`max`/`pattern`, date limits, and file type/size checks on the client. Client checks are a convenience; the server is authoritative. |
| NFR-05 Lists and search within 3 s | Done (measured) | `P`: at 20,000 rows all queries peaked under 130 ms at the service layer. See `TEST-RESULTS.md`. |
| NFR-06 Informative errors | Done | `app/error.tsx`, `not-found.tsx`, field and form messages. Infrastructure outages were not fault-injected. |
| NFR-07 Modern browsers, desktop and mobile | Done for Chromium | `E` at 1366 px and 390 px; no horizontal overflow on 8 key pages |
| NFR-08 Consistent UI, labels, hints, clear errors | Done | one design system; `E` asserts every form control has a label |
| NFR-09 Data integrity (PK, FK, unique, business rules) | Done | `db/schema.sql`; DB-level CHECK and unique tests in `I` |
| NFR-10 Audit | Done | `audit_logs`, `item_status_histories` |
| NFR-11 Backup | Done (script) | `scripts/backup.sh`; scheduling by the operator |
| NFR-12 Modular code | Done | `src/modules/{auth,items,matching,claims,notifications,admin}` |
| NFR-13 Session ends on logout | Done | `E` replays the old cookie after logout and is redirected to login |
| NFR-14 File format and size limits | Done | magic-byte detection, size caps; `I` rejects HTML/SVG disguised as images, oversize files |
| NFR-15 Chrome, Firefox, Edge | Partial | only Chromium tested |
| NFR-16 Recovery procedure | Done (script) | `scripts/restore.sh`; `backup, destroy, restore` cycle verified (users, items, claims, audit rows and files restored) |
| NFR-17 Consistent storage across operations | Done | transactions with row locks; unique generated column; race test in `I` |

## Business rules

| BR | Where enforced |
| --- | --- |
| BR-01 Two roles | `users.role` enum; `requireUser`/`requireAdmin` |
| BR-02 USER has `user_type` | DB CHECK |
| BR-03 ADMIN has username, no `user_type` | DB CHECK |
| BR-04 Identity by type | DB CHECK, Zod `checkIdentity` |
| BR-05 Identity format/verification agreed with campus | **Open**; see `ASSUMPTIONS.md` P2 |
| BR-06 Only active USERs report and claim | session requires ACTIVE; `createItem` and `submitClaim` re-check role |
| BR-07 Only active ADMIN manages master data and decides claims | `assertAdmin` + service role checks |
| BR-08 A match links one LOST and one FOUND | `item_matches` columns, unique pair, CHECK |
| BR-09 Claim only on FOUND with status OPEN | `submitClaim` with row lock |
| BR-10 Score is not proof | stated in UI on recommendation views |
| BR-11 Private evidence never on public pages | projection + route authorization |
| BR-12 Status changes and claim decisions recorded | histories + audit log |
