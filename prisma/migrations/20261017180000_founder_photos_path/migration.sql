-- Photos moved from /founders/... to /images/founders/... : a static folder at
-- /founders/<id>/ shadowed the personal page URL /founders/<id> in nginx.
UPDATE "Founder"
SET
  "previewUrl" = regexp_replace("previewUrl", '^/founders/', '/images/founders/'),
  "gallery" = ARRAY(
    SELECT regexp_replace(url, '^/founders/', '/images/founders/')
    FROM unnest("gallery") WITH ORDINALITY AS g(url, n)
    ORDER BY n
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "previewUrl" LIKE '/founders/%'
   OR EXISTS (SELECT 1 FROM unnest("gallery") AS url WHERE url LIKE '/founders/%');
