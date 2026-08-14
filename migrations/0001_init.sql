-- BabyFat V8 initial D1 schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL UNIQUE,
  request_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  booking_status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  payment_deadline TEXT,
  payment_submitted_at TEXT,
  payment_last5 TEXT,
  paid_at TEXT,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  email_norm TEXT NOT NULL,
  line_name TEXT NOT NULL,
  line_joined INTEGER NOT NULL DEFAULT 0,
  region TEXT NOT NULL,
  resort TEXT,
  lesson_date TEXT NOT NULL,
  board TEXT NOT NULL,
  course TEXT NOT NULL,
  duration TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  people_count INTEGER NOT NULL,
  tuition_twd INTEGER NOT NULL DEFAULT 0,
  stay_requested INTEGER NOT NULL DEFAULT 0,
  stay_nights INTEGER NOT NULL DEFAULT 0,
  stay_rooms INTEGER NOT NULL DEFAULT 0,
  stay_twd INTEGER NOT NULL DEFAULT 0,
  stay_status TEXT,
  photo_requested INTEGER NOT NULL DEFAULT 0,
  photo_twd INTEGER NOT NULL DEFAULT 0,
  photo_status TEXT,
  shuttle TEXT,
  shuttle_jpy INTEGER NOT NULL DEFAULT 0,
  shuttle_status TEXT,
  total_twd INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  assigned_coach TEXT,
  notes TEXT,
  privacy_consent INTEGER NOT NULL DEFAULT 0,
  terms_consent INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  sync_status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE INDEX IF NOT EXISTS idx_bookings_email_norm ON bookings(email_norm);
CREATE INDEX IF NOT EXISTS idx_bookings_lesson_date ON bookings(lesson_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);

CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL,
  participant_no INTEGER NOT NULL,
  name TEXT,
  age TEXT,
  level TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(booking_id, participant_no),
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_participants_booking ON participants(booking_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL,
  last5 TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

CREATE TABLE IF NOT EXISTS partnerships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partnership_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  organization TEXT,
  phone TEXT,
  email TEXT NOT NULL,
  line TEXT,
  boards TEXT,
  regions TEXT,
  experience TEXT,
  certificates TEXT,
  availability TEXT,
  social TEXT,
  industry TEXT,
  website TEXT,
  offer TEXT,
  need TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'NEW',
  owner TEXT,
  sync_status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status,next_attempt_at);

INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES
('SEASON_START','2026-12-15',datetime('now')),
('SEASON_END','2027-04-30',datetime('now')),
('PAYMENT_HOURS','24',datetime('now')),
('YUZAWA_GROUP_HALF','2500',datetime('now')),
('YUZAWA_GROUP_FULL','4000',datetime('now')),
('YUZAWA_PRIVATE_HALF','10000',datetime('now')),
('YUZAWA_PRIVATE_FULL','15000',datetime('now')),
('KARUIZAWA_GROUP_HALF','3000',datetime('now')),
('KARUIZAWA_GROUP_FULL','4500',datetime('now')),
('KARUIZAWA_PRIVATE_HALF','12000',datetime('now')),
('KARUIZAWA_PRIVATE_FULL','17000',datetime('now')),
('STAY_ROOM_TWD','6500',datetime('now')),
('PHOTO_TWD','13000',datetime('now')),
('SHUTTLE_KANDATSU_JPY','3500',datetime('now')),
('SHUTTLE_IWAPPARA_JPY','5000',datetime('now')),
('SHUTTLE_ISHIUCHI_JPY','6000',datetime('now')),
('BANK_NAME','',datetime('now')),
('BANK_CODE','',datetime('now')),
('BANK_ACCOUNT','',datetime('now')),
('BANK_HOLDER','',datetime('now')),
('CONTACT_EMAIL','mangowalkers@gmail.com',datetime('now')),
('CONTACT_PHONE','0913172857',datetime('now')),
('LINE_ID','@572opdeh',datetime('now')),
('INSTAGRAM_URL','https://www.instagram.com/babyfat_snowteam/',datetime('now')),
('FACEBOOK_URL','https://www.facebook.com/search/top?q=BabyFat%E9%9B%AA%E8%83%96%E6%95%99%E7%B7%B4%E5%9C%98',datetime('now'));
