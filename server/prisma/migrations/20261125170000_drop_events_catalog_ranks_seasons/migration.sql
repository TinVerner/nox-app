-- Scope cut: drop events, catalog, ranks, seasons; keep users/nights/bookings/results/news.
-- Tournament format nights become CLASSIC so schedule filters stay consistent.

DROP TABLE IF EXISTS "event_registrations";
DROP TABLE IF EXISTS "events";
DROP TABLE IF EXISTS "catalog_items";
DROP TABLE IF EXISTS "user_ranks";
DROP TABLE IF EXISTS "rank_definitions";

ALTER TABLE "game_nights" DROP CONSTRAINT IF EXISTS "game_nights_season_id_fkey";
DROP INDEX IF EXISTS "game_nights_season_id_idx";
ALTER TABLE "game_nights" DROP COLUMN IF EXISTS "season_id";

DROP TABLE IF EXISTS "seasons";

UPDATE "game_nights" SET "format" = 'CLASSIC' WHERE "format" = 'TOURNAMENT';
DELETE FROM "point_rules" WHERE "format" = 'TOURNAMENT';
