-- The author offer asks only for name, IIN, phone and city; bank details, full address and the bio are gone.
ALTER TABLE "AuthorApplication" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';

-- Best effort for existing applications: the city is the first part of the old address ("Алматы қ., ...").
UPDATE "AuthorApplication"
SET "city" = COALESCE(NULLIF(trim(split_part("address", ',', 1)), ''), "address");

ALTER TABLE "AuthorApplication" ALTER COLUMN "city" DROP DEFAULT;

ALTER TABLE "AuthorApplication"
  DROP COLUMN "address",
  DROP COLUMN "bankName",
  DROP COLUMN "iban",
  DROP COLUMN "about";
