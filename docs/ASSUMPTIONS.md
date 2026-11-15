# Assumptions, SKPL issues, and deviations

The SKPL is the source of truth. Where it is silent, ambiguous, or inconsistent, this file records what was
decided. Every item is marked **SKPL** (follows the specification), **ASSUMPTION** (a choice made where the
SKPL is silent), or **DEVIATION** (differs from, or adds to, what the SKPL states).

## 1. Database

| # | Type | Item |
| --- | --- | --- |
| D1 | DEVIATION (addition) | Two tables not in the ERD: `sessions` (revocable server-side sessions; needed for FR-27 and NFR-13) and `audit_logs` (FR-32 and NFR-10 require an activity log, but the ERD has no table for it). |
| D2 | DEVIATION (addition) | Constraints beyond the ERD: `UNIQUE(identity_type, identity_number)`; `CHECK` that ADMIN rows have `username` and no identity/`user_type` and USER rows are the reverse (BR-02, BR-03); `CHECK` that `user_type` matches `identity_type` (BR-04); `CHECK` on score range and `lost_item_id <> found_item_id`; unique `item_matches(lost_item_id, found_item_id)`. |
| D3 | DEVIATION (addition) | `claims.active_item_id` is a stored generated column (the item id while the claim is PENDING, NEED_INFO, or APPROVED, otherwise NULL) with a UNIQUE index. It makes the database enforce "one active claim per report" even for simultaneous requests. |
| D4 | ASSUMPTION | `photo_url` and `evidence_url` store a **storage key** (for example `photos/<uuid>.png`), not a URL. Files are served through authorized routes. The column names are kept from the ERD. |
| D5 | ASSUMPTION | `items.public_description` is kept for ERD fidelity but unused. `description` is shown to signed-in users; `private_identifier` is the hidden field. See P1. |
| D6 | ASSUMPTION | Timestamps are stored in UTC and shown in WITA (Asia/Makassar). `incident_date` is a plain date. |

## 2. Problems found in the SKPL

Each problem is listed with its impact and the resolution used. Items 1 to 4 deserve a decision from the campus.

| # | Problem | Impact | Resolution used |
| --- | --- | --- | --- |
| P1 | FR-08/FR-09 do not list `private_identifier`, yet the ERD has it and BR-11 and FR-33 depend on it. It is unclear whether LOST reports also collect one. | Without it, claims cannot be verified. | **ASSUMPTION**: optional on LOST reports, **required (min 5 chars) on FOUND reports**, shown only to the owner and ADMIN. |
| P2 | BR-05: identity format and verification mechanism are "to be agreed with the campus". | Anyone who knows the format of a NIM/NIDN/NIP can self-register. This is the largest open security gap. | **ASSUMPTION**: lenient format (letters, digits, `.`, `/`, `-`, 4-40 chars; NIM digits only). Self-registration can be turned off with `ALLOW_SELF_REGISTRATION=false` and accounts created by an admin or by import. No verification is claimed. |
| P3 | Claim flow: FR-20 allows "request additional evidence", but no FR lets the claimant answer, and `claims` has one `claim_note` and one `evidence_url`. | NEED_INFO would be a dead end. | **ASSUMPTION**: the claimant sees the admin's request, appends information (and may replace the evidence file), and the claim returns to PENDING. Information is appended to `claim_note` with a date marker. Only the latest evidence file is kept. |
| P4 | The status of a report after a claim decision is not specified. The SKPL says a REJECTED claim does not automatically change the item status, yet `CLAIM_PENDING` exists and only OPEN items can be claimed (BR-09). | Without a rule, a report could stay locked forever. | **ASSUMPTION** (see section 3): submitting a claim moves the report to CLAIM_PENDING; REJECTED or CANCELLED returns it to OPEN. This is the only way a rejected claimant does not block the report, so it is a reading of the SKPL sentence as "does not close or reject the report". |
| P5 | "RETURNED after handover is confirmed" does not say who confirms. | Needed for the final state. | **ASSUMPTION**: ADMIN confirms handover on an APPROVED claim. |
| P6 | Matching: weights are given, but scoring rules for each attribute and the threshold are not. | The numeric result depends entirely on these choices. | **ASSUMPTION** (section 4). Weights are **SKPL** and **not empirically validated**. |
| P7 | The activity diagram shows a similarity score in generic search results, but a score exists only relative to a specific LOST report. | A score in plain search results has no reference. | Scores appear only on the recommendations page and on an owner's report detail. |
| P8 | `identity_type` has `EMPLOYEE_ID` while BR-04 mentions both "ID Dosen internal" and "ID Pegawai internal". | Two names, one enum value. | Both map to `EMPLOYEE_ID`, shown as "ID Pegawai". Allowed pairs: STUDENT-NIM, LECTURER-NIDN/EMPLOYEE_ID, STAFF-NIP/EMPLOYEE_ID. |
| P9 | `users.email` is NOT NULL and unique, but no FR mentions collecting it. | Registration must collect it. | Collected at registration; editable in the profile. |
| P10 | No FR for editing or closing one's own report, though FR-13 says reports can be "updated" and the scope implies users manage their reports. No FR for dismissing a recommendation although `match_status` has DISMISSED. | Needed for a usable product. | **DEVIATION (addition)**: owners can edit and close their own OPEN reports; users can dismiss recommendations. Approval of a claim sets the claimant's related matches to CONFIRMED. |
| P11 | The SKPL document itself has duplicate figure numbers ("Gambar 6" twice) and a table cross-reference that points to the wrong table. | Cosmetic. | Reported only. |
| P12 | The requirements prompt lists a separate "Admin Login" page, but SKPL constraint (d) says a single login page serves both roles. | Conflict. | **SKPL followed**: one `/login` with an account-type switch. |

## 3. Status transitions

```
Claim submitted        claim PENDING          item OPEN -> CLAIM_PENDING        (BR-09)
User cancels           PENDING -> CANCELLED   item CLAIM_PENDING -> OPEN        (FR-28)
Admin approves         PENDING -> APPROVED    item stays CLAIM_PENDING          matches of claimant -> CONFIRMED
Admin rejects          PENDING -> REJECTED    item CLAIM_PENDING -> OPEN        note required
Admin requests info    PENDING -> NEED_INFO   item stays CLAIM_PENDING          note required
Claimant answers       NEED_INFO -> PENDING   (ASSUMPTION)
Admin confirms handover claim APPROVED        item CLAIM_PENDING -> RETURNED    final
Admin moderates        item OPEN <-> CLOSED <-> REJECTED                        reason required; blocked while CLAIM_PENDING and after RETURNED
Owner closes           item OPEN -> CLOSED                                      (ASSUMPTION)
```

Every item status change writes `item_status_histories` and `audit_logs`; every claim decision writes `audit_logs`
(FR-25, FR-31, FR-32, BR-12). The admin's reason is required for REJECTED and NEED_INFO and is enforced in the
service layer, not only in the form.

A user cannot claim their own FOUND report (**ASSUMPTION**). The claimant's own LOST report is not closed
automatically after handover; the owner closes it manually.

## 4. Matching algorithm

`S = 0.30*Category + 0.20*Color + 0.20*Location + 0.15*Date + 0.15*Description`, each term in 0..1, stored as a
percentage (`similarity_score DECIMAL(5,2)`). Weights are **SKPL**. Everything below is **ASSUMPTION**:

| Term | Rule |
| --- | --- |
| Category | 1 if same `category_id`, else 0 |
| Color | Jaccard similarity of normalized base-color sets (Indonesian and English aliases, shade words such as "tua", "muda", "gelap" ignored). Unrecognized colors score 1 only on exact text match. |
| Location | 1 if same `location_id`, else 0 (the `locations` table has no coordinates or hierarchy, so "nearby" cannot be computed) |
| Date | `1 - days/window`, floor 0, window = `MATCH_DATE_WINDOW_DAYS` (default 14). A FOUND date more than 1 day before the LOST date scores 0. |
| Description | Dice coefficient over meaningful words of name + description (accents removed, small Indonesian/English stopword list, words under 3 letters dropped) |

Other choices: threshold `MATCH_THRESHOLD` (default 50 percent, configurable, not validated); only OPEN reports of the
opposite type from a **different user** are compared; at most the 1,000 most recent candidates are scored per run;
matching runs after a report is created, updated, or reopened and never blocks saving the report; a SUGGESTED match that
falls below the threshold after an edit is removed, while DISMISSED and CONFIRMED rows are kept; both owners are notified
only when a pair is first created.

Per BR-10, the interface says on every score that it is not proof of ownership.

## 5. Security and privacy choices

- Public detail pages show `description`, category, location, color, date, photo, and a reporter **type** ("Mahasiswa"),
  never the reporter's name or contact. ADMIN sees the name and email.
- Reports in status REJECTED or CLOSED are visible only to their owner and ADMIN.
- A user who cannot view a report receives the not-found page (no confirmation that it exists). Because loading skeletons
  stream the page, that response has HTTP status 200 with not-found content; tests check the content, not the status code.
- Login error messages are generic and the response time is equalized for unknown identities. Registration necessarily
  reveals whether an email or identity number is already registered.
- No password reset or change, and no email notifications, were requested by the SKPL and are not implemented.

## 6. What is not verified

- Matching weights and threshold have not been tested against real campus reports.
- Rendering was tested in Chromium (desktop 1366 px and mobile 390 px). NFR-15 names Firefox and Edge; they were **not** run.
  Edge uses the Chromium engine, but that is an inference, not a test.
- No assistive-technology test was done. Labels, focus rings, `aria` attributes, and contrast of the palette were designed
  for accessibility, but this is not a WCAG audit.
- Performance (NFR-05) was measured at the service layer with 20,000 synthetic rows on a 1 CPU sandbox, not under concurrent
  load and not including network or render time.
- Backup and restore were exercised once end to end on a test database. Scheduling and off-site copies are the operator's job.
- The default categories and locations are generic samples; replace them with the real campus data in the Admin menu.
- The login throttle is in memory and per process.
- Uploaded images are validated by signature, size, and serving headers; they are not decoded or re-encoded, so a corrupt
  but correctly signed file would be stored and show as a broken image.
- Search uses `LIKE '%word%'`. At much larger volumes use FULLTEXT or a search engine.
- No Content-Security-Policy header is set for application pages (only for served files); basic hardening headers are set.
