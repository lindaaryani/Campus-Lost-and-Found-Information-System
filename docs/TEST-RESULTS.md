# Test results

Run on 2026-11-11 in the development sandbox: Ubuntu 24.04, 1 CPU, 4 GB RAM, Node 22, MySQL 8.0.46, Chromium (headless shell) via Playwright.
Outputs below are the verbatim program output (test names are in Indonesian, matching the code).

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | pass |
| ESLint (`src scripts tests`) | pass, 0 errors, 0 warnings |
| Production build | pass, no warnings |
| Unit tests | 7 pengujian lulus |
| Integration tests | 37 pengujian lulus |
| End-to-end flow | 25 langkah lulus, 0 gagal |
| Performance (20,000 reports) | all queries under 3 s (see below) |
| Backup, destroy, restore | verified once (see below) |

## How to reproduce

```bash
npm run test:unit
npm run test:db-setup && DB_NAME=campusfind_test npm run test:integration
DB_NAME=campusfind_test npm run test:perf
# E2E: build, start the server against the test database, then run the browser flow
npm run build
DB_NAME=campusfind_test npm run start -- -p 3100 &
BASE_URL=http://localhost:3100 CHROMIUM_PATH=/path/to/chrome npm run test:e2e
```

The E2E script expects a clean test database (`npm run test:db-setup`) and a server started with `DB_NAME=campusfind_test`.
Login throttling is in memory: restart the server between runs, or repeated runs with the same identity will be blocked.

## Unit tests (Weighted Similarity Scoring)
```
Weighted Similarity Scoring
  ok - bobot berjumlah 1,00 dan sesuai SKPL
  ok - warna: alias ID/EN dan pewarna diabaikan
  ok - tanggal: sama=1, linear, di luar jendela=0, found sebelum lost=0
  ok - deskripsi: Dice atas kata bermakna
  ok - total: identik pada semua atribut = 100%
  ok - total: hanya kategori+lokasi sama = 50% (0,30+0,20)
  ok - total: kategori beda, selebihnya identik = 70%
7 pengujian lulus.
```

## Integration tests (real MySQL)
```
Autentikasi (FR-01..06, NFR-01)
  ok - password tersimpan sebagai Argon2id
  ok - login USER benar (NIM) berhasil, role dari DB
  ok - login ADMIN via username berhasil
  ok - USER tidak bisa masuk lewat jalur ADMIN, ADMIN tidak lewat jalur USER
  ok - kata sandi salah & identitas tak dikenal => pesan generik sama
  ok - pembatasan percobaan login: blokir setelah 5 kegagalan
  ok - registrasi: identitas & email duplikat ditolak
  ok - DB menolak kombinasi user_type/identity_type yang melanggar BR-04 (CHECK)
  ok - akun SUSPENDED tidak dapat masuk; sesi dicabut
  ok - admin tidak dapat mengubah status akunnya sendiri; non-admin ditolak
Laporan, privasi, pencarian (FR-08..12, FR-33)
  ok - buat LOST & FOUND mirip => pencocokan otomatis tersimpan + notifikasi kedua pemilik
  ok - riwayat status awal tercatat (FR-25)
  ok - private_identifier TIDAK bocor ke pengguna lain (detail & daftar)
  ok - pemilik & admin dapat melihat private_identifier
  ok - pencarian: kata kunci, filter, wildcard LIKE diperlakukan literal
  ok - filter rentang tanggal (FR-11) membatasi hasil
  ok - laporan REJECTED tidak terlihat pengguna lain tetapi terlihat pemilik/admin
  ok - update laporan memicu pencocokan ulang; skor di bawah ambang menghapus rekomendasi SUGGESTED
  ok - hanya pemilik yang dapat mengubah/menutup laporan
  ok - kategori/lokasi nonaktif tidak bisa dipakai laporan baru; data master tidak dihapus
Klaim (FR-17..20, FR-28, FR-29, BR-07, BR-09)
  ok - ajukan klaim: item OPEN -> CLAIM_PENDING, riwayat & audit tercatat
  ok - klaim ganda pada item yang sama & klaim atas laporan sendiri ditolak
  ok - klaim atas laporan LOST ditolak (BR-09)
  ok - race condition: 5 klaim serentak pada item OPEN => tepat 1 berhasil (NFR-17)
  ok - hanya pengaju yang dapat membatalkan; batal => item OPEN kembali (FR-28)
  ok - non-admin tidak dapat memutuskan klaim (BR-07)
  ok - admin meminta bukti tambahan; pengaju melengkapi; kembali PENDING
  ok - data klaim/ciri khusus hanya dapat dibaca admin lewat service admin
  ok - admin menyetujui => match CONFIRMED, item tetap CLAIM_PENDING, notifikasi ke pengaju
  ok - serah terima: item RETURNED, status final; riwayat lengkap & audit keputusan (FR-25, FR-32, BR-12)
  ok - penolakan klaim membuka kembali laporan
Notifikasi, statistik
  ok - notifikasi: tandai dibaca hanya milik sendiri (FR-30)
  ok - rekomendasi dapat diabaikan hanya oleh pemilik salah satu laporan
  ok - statistik konsisten dengan data (FR-26)
Upload aman (NFR-14)
  ok - PNG asli diterima; disimpan dengan nama acak, dapat dibaca kembali
  ok - berkas palsu (teks/HTML/SVG berekstensi gambar) ditolak berdasar isi
  ok - PDF ditolak untuk foto tetapi diterima untuk bukti klaim; ukuran berlebih ditolak
37 pengujian lulus.
```

## End-to-end (Chromium, desktop 1366 px and mobile 390 px)
```
Skema siap. 10 tabel tersedia.
Akun ADMIN dibuat: username "admin".
login HTTP 200
> campusfind@0.1.0 test:e2e
> tsx tests/e2e.ts
Akses & autentikasi
  ok - pengguna anonim dialihkan ke /login dari halaman terlindungi
  ok - API berkas menolak anonim (401) tanpa membocorkan data
  ok - registrasi Staf (penemu) & Mahasiswa (kehilangan) + validasi form
  ok - login salah ditolak dengan pesan generik; login benar masuk
Laporan, pencocokan, privasi
  ok - Mahasiswa membuat laporan kehilangan (dengan foto) via UI
  ok - Staf membuat laporan temuan mirip => rekomendasi muncul untuk penemu
  ok - pengguna lain TIDAK melihat ciri khusus (HTML + RSC payload) tetapi melihat data publik
  ok - Mahasiswa melihat rekomendasi & notifikasi kecocokan
  ok - pencarian & filter berfungsi (kategori, kata kunci tanpa hasil)
  ok - ubah profil (FR-07): data tersimpan; email duplikat ditolak
Klaim & verifikasi admin
  ok - Mahasiswa mengajukan klaim dengan bukti PDF
  ok - pengguna lain tidak bisa mengklaim barang yang sedang diklaim; bukti klaim hanya untuk pengaju/admin
  ok - USER tidak dapat membuka area ADMIN (dialihkan ke dashboard)
  ok - ADMIN login lewat halaman yang sama (tab Admin)
  ok - ADMIN melihat ciri khusus rahasia & bukti pada detail klaim
  ok - ADMIN meminta bukti tambahan (catatan wajib) => pengaju melengkapi
  ok - ADMIN menyetujui klaim lalu mengonfirmasi serah terima => RETURNED
  ok - riwayat status & log aktivitas mencatat seluruh alur
Administrasi
  ok - halaman admin termuat: pengguna, laporan, kategori, lokasi, statistik
  ok - ADMIN menambah kategori; nama duplikat ditolak; kategori nonaktif tidak muncul di form
  ok - ADMIN memoderasi laporan: tolak => hilang dari publik; buka kembali
  ok - akun ditangguhkan: sesi langsung tidak berlaku & tidak bisa login
  ok - logout menghapus sesi: cookie lama tidak dapat dipakai lagi
Responsif (390px) & aksesibilitas dasar
  ok - tampilan mobile: tidak ada overflow horizontal & menu drawer berfungsi
  ok - semua input memiliki label; tidak ada galat JS/HTTP 5xx selama alur
25 langkah lulus, 0 gagal.
```

## Performance (NFR-05)

Service-layer timings (COUNT + one page of 12 rows), median and max of 5 runs, 20,000 synthetic reports. Excludes network and rendering, single connection, no concurrent load.
```
Data sintetis: 20000 laporan dimasukkan dalam 0.6 s
Total baris items: 20000
Waktu respons layanan (mencakup COUNT + halaman 12 baris):
  Daftar publik, halaman 1, tanpa filter                     median    53 ms  (maks 55 ms)
  Daftar publik, halaman 500                                 median    54 ms  (maks 59 ms)
  Daftar Barang Ditemukan (type=FOUND)                       median    44 ms  (maks 48 ms)
  Pencarian kata kunci 'dompet'                              median    75 ms  (maks 84 ms)
  Pencarian dua kata 'tas hitam'                             median    66 ms  (maks 67 ms)
  Pencarian kata tanpa hasil 'xyzabc'                        median    59 ms  (maks 60 ms)
  Filter kategori + lokasi + rentang tanggal                 median     6 ms  (maks 7 ms)
  Laporan saya (mine)                                        median    29 ms  (maks 30 ms)
  Daftar admin semua laporan                                 median    76 ms  (maks 77 ms)
  Pencocokan 1 laporan baru vs <=1.000 kandidat                 33 ms  (pasangan baru: 0)
Semua pengukuran < 3 detik pada 20.000 laporan.
```

## Backup and restore (NFR-11, NFR-16)

On a populated test database: backup, then truncate claims, items, users, audit_logs and delete uploaded files, then restore.
```
users/items/claims/audit_logs  before = 8 / 6 / 5 / 31
                               after destroying = 0 / 0 / 0 / 0
                               after restore    = 8 / 6 / 5 / 31   (uploaded files restored; SHA256SUMS verified)
```

## Defects found and fixed by these tests

- Claim decisions accepted an empty reason at the service layer (only the form checked it). Now enforced in the service.
- Success toast disappeared when the action removed its own trigger (for example after approving a claim). Toast is now sent from the action wrapper.
- Logout never submitted: the dropdown menu unmounted the form before submit. Fixed.
- Heading colors ignored Tailwind utilities (unlayered base CSS), making the login headline unreadable. Moved base styles into `@layer base`.
- Backup/restore scripts let `.env.local` override an explicitly set `DB_NAME`. Fixed so the environment wins.

## Not covered by automated tests

Cancel-claim button flow, single-notification "mark as read" button, owner edit/close buttons, Firefox/Edge rendering, assistive technology, concurrent load, and real campus data.

Screenshots from the E2E run are in `docs/screenshots/`.
