-- Unused image/link columns: no app upload or gallery; UI fields removed.
ALTER TABLE "game_nights" DROP COLUMN IF EXISTS "image_path";
ALTER TABLE "news_posts" DROP COLUMN IF EXISTS "image_path";
ALTER TABLE "events" DROP COLUMN IF EXISTS "image_path";
