-- CreateEnum
CREATE TYPE "VideoSource" AS ENUM ('CLOUDINARY', 'YOUTUBE');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "LessonVideo" ADD COLUMN "source" "VideoSource" NOT NULL DEFAULT 'CLOUDINARY';
ALTER TABLE "LessonVideo" ADD COLUMN "youtubeVideoId" TEXT;
ALTER TABLE "LessonVideo" ALTER COLUMN "cloudinaryPublicId" DROP NOT NULL;
ALTER TABLE "LessonVideo" ALTER COLUMN "sizeBytes" DROP NOT NULL;
ALTER TABLE "LessonVideo" ALTER COLUMN "durationSeconds" SET DEFAULT 0;
