-- =====================================================================
-- CampusFind - skema MySQL 8 (utf8mb4)
-- Sumber: ERD SKPL (8 entitas) + 2 tabel pendukung (sessions, audit_logs)
--
-- Tabel dari SKPL : users, categories, locations, items, item_matches,
--                   claims, notifications, item_status_histories
-- Tabel tambahan  : sessions    -> sesi server-side yang dapat dicabut (FR-27, NFR-13)
--                   audit_logs  -> jejak audit aktivitas (FR-32, NFR-10); ERD tidak
--                                  memiliki tabel ini sehingga halaman "Log Aktivitas"
--                                  tidak dapat dibangun hanya dari tabel SKPL.
-- Skrip ini idempotent: aman dijalankan ulang (CREATE TABLE IF NOT EXISTS).
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username        VARCHAR(60)  NULL,
  identity_type   ENUM('NIM','NIDN','NIP','EMPLOYEE_ID') NULL,
  identity_number VARCHAR(40)  NULL,
  user_type       ENUM('STUDENT','LECTURER','STAFF') NULL,
  full_name       VARCHAR(120) NOT NULL,
  email           VARCHAR(150) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  phone_number    VARCHAR(20)  NULL,
  role            ENUM('ADMIN','USER') NOT NULL,
  account_status  ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_identity (identity_type, identity_number),
  KEY idx_users_role_status (role, account_status),
  -- BR-01..BR-04: ADMIN wajib username & tanpa identitas/user_type; USER sebaliknya.
  CONSTRAINT chk_users_role_shape CHECK (
    (role = 'ADMIN' AND username IS NOT NULL AND identity_type IS NULL
       AND identity_number IS NULL AND user_type IS NULL)
    OR
    (role = 'USER' AND identity_type IS NOT NULL AND identity_number IS NOT NULL
       AND user_type IS NOT NULL)
  ),
  -- BR-04: mahasiswa=NIM; dosen=NIDN/ID internal; staf=NIP/ID internal.
  CONSTRAINT chk_users_identity_by_type CHECK (
    user_type IS NULL
    OR (user_type = 'STUDENT'  AND identity_type = 'NIM')
    OR (user_type = 'LECTURER' AND identity_type IN ('NIDN','EMPLOYEE_ID'))
    OR (user_type = 'STAFF'    AND identity_type IN ('NIP','EMPLOYEE_ID'))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- categories & locations (data master, FR-22: dinonaktifkan, bukan dihapus)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  category_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(80)  NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS locations (
  location_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_name VARCHAR(120) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (location_id),
  UNIQUE KEY uq_locations_name (location_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- items (laporan Lost / Found)
--   photo_url         : KUNCI penyimpanan berkas (mis. "photos/ab12.jpg"), bukan URL publik.
--                       Berkas disajikan lewat route terotorisasi.
--   private_identifier: ciri khusus untuk verifikasi; TIDAK PERNAH dikirim ke publik (FR-33).
--   public_description: dipertahankan sesuai ERD; belum dipakai di v1 (lihat docs/ASSUMPTIONS.md).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  item_id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id            BIGINT UNSIGNED NOT NULL,
  category_id        BIGINT UNSIGNED NOT NULL,
  location_id        BIGINT UNSIGNED NOT NULL,
  item_type          ENUM('LOST','FOUND') NOT NULL,
  item_name          VARCHAR(150) NOT NULL,
  color              VARCHAR(60)  NULL,
  description        TEXT NULL,
  incident_date      DATE NOT NULL,
  photo_url          VARCHAR(500) NULL,
  public_description TEXT NULL,
  private_identifier TEXT NULL,
  item_status        ENUM('OPEN','CLAIM_PENDING','RETURNED','CLOSED','REJECTED') NOT NULL DEFAULT 'OPEN',
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  KEY idx_items_list (item_type, item_status, incident_date),
  KEY idx_items_owner (user_id, created_at),
  KEY idx_items_category (category_id),
  KEY idx_items_location (location_id),
  KEY idx_items_name (item_name),
  CONSTRAINT fk_items_user     FOREIGN KEY (user_id)     REFERENCES users(user_id),
  CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
  CONSTRAINT fk_items_location FOREIGN KEY (location_id) REFERENCES locations(location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- item_matches (BR-08: satu pasangan = satu LOST + satu FOUND)
--   similarity_score disimpan sebagai PERSEN 0.00 - 100.00.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_matches (
  match_id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lost_item_id     BIGINT UNSIGNED NOT NULL,
  found_item_id    BIGINT UNSIGNED NOT NULL,
  similarity_score DECIMAL(5,2) NOT NULL,
  match_status     ENUM('SUGGESTED','CONFIRMED','DISMISSED') NOT NULL DEFAULT 'SUGGESTED',
  matched_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id),
  UNIQUE KEY uq_match_pair (lost_item_id, found_item_id),
  KEY idx_match_found (found_item_id),
  CONSTRAINT fk_match_lost  FOREIGN KEY (lost_item_id)  REFERENCES items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_match_found FOREIGN KEY (found_item_id) REFERENCES items(item_id) ON DELETE CASCADE,
  CONSTRAINT chk_match_score CHECK (similarity_score >= 0 AND similarity_score <= 100),
  CONSTRAINT chk_match_distinct CHECK (lost_item_id <> found_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- claims
--   active_item_id (generated): bernilai item_id selama klaim masih "aktif"
--   (PENDING/NEED_INFO/APPROVED), NULL jika tidak. UNIQUE => maksimal SATU klaim
--   aktif per laporan, ditegakkan oleh database (NFR-09, NFR-17) walau ada race condition.
--   evidence_url: kunci penyimpanan berkas bukti, disajikan hanya ke pengaju & ADMIN.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claims (
  claim_id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id        BIGINT UNSIGNED NOT NULL,
  claimant_id    BIGINT UNSIGNED NOT NULL,
  reviewed_by    BIGINT UNSIGNED NULL,
  claim_note     TEXT NOT NULL,
  evidence_url   VARCHAR(500) NULL,
  claim_status   ENUM('PENDING','NEED_INFO','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  admin_note     TEXT NULL,
  submitted_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at    TIMESTAMP NULL,
  active_item_id BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN claim_status IN ('PENDING','NEED_INFO','APPROVED') THEN item_id ELSE NULL END) STORED,
  PRIMARY KEY (claim_id),
  UNIQUE KEY uq_claims_one_active_per_item (active_item_id),
  KEY idx_claims_claimant (claimant_id, submitted_at),
  KEY idx_claims_status (claim_status, submitted_at),
  KEY idx_claims_item (item_id),
  CONSTRAINT fk_claims_item     FOREIGN KEY (item_id)     REFERENCES items(item_id),
  CONSTRAINT fk_claims_claimant FOREIGN KEY (claimant_id) REFERENCES users(user_id),
  CONSTRAINT fk_claims_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  item_id         BIGINT UNSIGNED NULL,
  claim_id        BIGINT UNSIGNED NULL,
  title           VARCHAR(150) NOT NULL,
  message         TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user  FOREIGN KEY (user_id)  REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_item  FOREIGN KEY (item_id)  REFERENCES items(item_id) ON DELETE SET NULL,
  CONSTRAINT fk_notif_claim FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- item_status_histories (FR-25, FR-31)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_status_histories (
  history_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id     BIGINT UNSIGNED NOT NULL,
  changed_by  BIGINT UNSIGNED NOT NULL,
  old_status  VARCHAR(30) NULL,
  new_status  VARCHAR(30) NOT NULL,
  change_note TEXT NULL,
  changed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (history_id),
  KEY idx_hist_item (item_id, changed_at),
  CONSTRAINT fk_hist_item FOREIGN KEY (item_id)    REFERENCES items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_hist_user FOREIGN KEY (changed_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- sessions (tambahan) - token acak disimpan sebagai hash SHA-256
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  session_id CHAR(64) NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (session_id),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- audit_logs (tambahan) - aktivitas penting: status laporan, keputusan klaim,
-- tindakan administratif (FR-32, NFR-10, BR-12)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id    BIGINT UNSIGNED NULL,
  action      VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id   BIGINT UNSIGNED NULL,
  details     JSON NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_audit_time (created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_actor (actor_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
