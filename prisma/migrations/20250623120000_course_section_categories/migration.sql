-- Normalize legacy free-text categories to section codes
UPDATE "Course" SET "category" = 'publication'
WHERE "category" IN ('General', 'Академическое письмо', '') OR "category" IS NULL;

UPDATE "Course" SET "category" = 'methods'
WHERE "category" ILIKE '%метод%';

UPDATE "Course" SET "category" = 'publication'
WHERE "category" NOT IN ('publication', 'methods', 'tools', 'wellness');

ALTER TABLE "Course" ALTER COLUMN "category" SET DEFAULT 'publication';

CREATE INDEX "Course_status_category_idx" ON "Course"("status", "category");
