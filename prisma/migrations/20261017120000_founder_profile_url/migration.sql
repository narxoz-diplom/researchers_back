-- Founder: optional video and link to a personal page
ALTER TABLE "Founder" ALTER COLUMN "videoUrl" DROP NOT NULL;
ALTER TABLE "Founder" ADD COLUMN "profileUrl" TEXT;
