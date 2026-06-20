-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_isPublished_orderNumber_idx" ON "Category"("isPublished", "orderNumber");

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Course_categoryId_idx" ON "Course"("categoryId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Category" ("id", "name", "slug", "orderNumber", "isPublished", "createdAt", "updatedAt")
VALUES ('seed-category-general', 'Общее', 'general', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "Category" ("id", "name", "slug", "orderNumber", "isPublished", "createdAt", "updatedAt")
SELECT
    'seed-category-' || md5("category"),
    "category",
    'cat-' || md5("category"),
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "category" FROM "Course" WHERE "category" IS NOT NULL AND "category" <> 'General'
) AS distinct_categories
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Course" c
SET "categoryId" = cat."id"
FROM "Category" cat
WHERE md5(c."category") = substring(cat."slug" from 5)
   OR (c."category" = 'General' AND cat."slug" = 'general');

UPDATE "Course"
SET "categoryId" = 'seed-category-general'
WHERE "categoryId" IS NULL;

ALTER TABLE "Course" DROP COLUMN "category";
