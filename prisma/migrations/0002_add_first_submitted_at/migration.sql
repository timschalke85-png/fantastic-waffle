-- Tiebreak #3 (earliest first submission): a nullable timestamp stamped once on
-- the first prediction save that writes real content. Existing rows get NULL.
ALTER TABLE "participants" ADD COLUMN "first_submitted_at" TIMESTAMPTZ(6);
