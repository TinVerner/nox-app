-- Вечера, созданные через сайт, сохранялись без сезона и не попадали в рейтинг сезона.
-- Прошедшие вечера получают и закрытый сезон (история), будущие — только незакрытый.
UPDATE "game_nights" AS n
SET "season_id" = s."id"
FROM "seasons" AS s
WHERE n."season_id" IS NULL
  AND ((n."starts_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Minsk')::date BETWEEN s."starts_on" AND s."ends_on"
  AND (s."status" <> 'CLOSED' OR n."starts_at" < (now() AT TIME ZONE 'UTC'));
