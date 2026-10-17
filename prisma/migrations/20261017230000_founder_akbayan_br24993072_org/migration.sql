-- Data: Akbayan Bekarystankyzy — project BR24993072 is carried out at Satbayev University.
UPDATE "Founder"
SET
  "bio" = replace(
    "bio",
    $txt$ресурсын әзірлеу» — ғылыми қызметкер.$txt$,
    $txt$ресурсын әзірлеу» — Satbayev University, ғылыми қызметкер.$txt$
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'akbayan-bekarystankyzy'
  AND "bio" LIKE $txt$%ресурсын әзірлеу» — ғылыми қызметкер.%$txt$;
