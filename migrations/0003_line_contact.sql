-- BabyFat V8.1.1 optional LINE ID + LINE contact status
ALTER TABLE bookings ADD COLUMN line_id TEXT;
ALTER TABLE bookings ADD COLUMN line_contact_status TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION';
