-- Founder personal page: long bio and photo gallery
ALTER TABLE "Founder" ADD COLUMN "bio" TEXT;
ALTER TABLE "Founder" ADD COLUMN "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[];
