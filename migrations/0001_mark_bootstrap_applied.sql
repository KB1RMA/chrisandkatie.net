-- Production migration: Mark bootstrap migration as applied
-- Production schema already has all tables from manual setup via 20260223_* migrations
-- This no-op marks the bootstrap state as complete in the migration history
-- so that future migrations can be applied normally
SELECT 1;
