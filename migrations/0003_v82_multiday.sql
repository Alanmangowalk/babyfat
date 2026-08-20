CREATE TABLE IF NOT EXISTS booking_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL,
  lesson_date TEXT NOT NULL,
  duration TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  assigned_coach TEXT DEFAULT '',
  second_coach TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(booking_id, lesson_date)
);
CREATE INDEX IF NOT EXISTS idx_booking_days_date ON booking_days(lesson_date);
CREATE INDEX IF NOT EXISTS idx_booking_days_booking ON booking_days(booking_id);
