-- Scope cut: drop sanctions; booking no longer gated by sanction blocks.
-- Clear any leftover notifications that existed only for sanctions.

DELETE FROM "notifications" WHERE "notification_type" = 'SANCTION';

DROP TABLE IF EXISTS "sanctions";
