-- BabyFat V8.1 course architecture and booking metadata
ALTER TABLE bookings ADD COLUMN party_type TEXT NOT NULL DEFAULT 'adult';
ALTER TABLE bookings ADD COLUMN season_phase TEXT;
ALTER TABLE bookings ADD COLUMN coach_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bookings ADD COLUMN share_status TEXT;
ALTER TABLE bookings ADD COLUMN share_group_id TEXT;
ALTER TABLE bookings ADD COLUMN bonus_hour_eligible INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN bonus_hour_status TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_course_date ON bookings(course,lesson_date,time_slot,board);
CREATE INDEX IF NOT EXISTS idx_bookings_share_match ON bookings(course,share_status,lesson_date,region,board,time_slot);

INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES
('YUZAWA_SHARE_HALF','8000',datetime('now')),
('YUZAWA_SHARE_FULL','13000',datetime('now')),
('KARUIZAWA_SHARE_HALF','10000',datetime('now')),
('KARUIZAWA_SHARE_FULL','15000',datetime('now')),
('PRIVATE_EXTRA_PERSON','1000',datetime('now')),
('YUZAWA_DUAL_COACH_HALF','10000',datetime('now')),
('YUZAWA_DUAL_COACH_FULL','15000',datetime('now')),
('KARUIZAWA_DUAL_COACH_HALF','12000',datetime('now')),
('KARUIZAWA_DUAL_COACH_FULL','17000',datetime('now')),
('EARLY_LOW_START','2026-12-15',datetime('now')),
('EARLY_LOW_END','2027-01-05',datetime('now')),
('PEAK_START','2027-01-06',datetime('now')),
('PEAK_END','2027-03-05',datetime('now')),
('TAIL_LOW_START','2027-03-06',datetime('now')),
('TAIL_LOW_END','2027-04-30',datetime('now'));
