-- CreateEnum
CREATE TYPE "LessonVectorIndexStatus" AS ENUM ('PENDING', 'INDEXING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "LessonIndexTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "vectorIndexStatus" "LessonVectorIndexStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Lesson" ADD COLUMN "vectorIndexJobId" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "vectorIndexedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LessonIndexJob" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonIndexJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonIndexTask" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "status" "LessonIndexTaskStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonIndexTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonVectorIndexError" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ragRequestId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonVectorIndexError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonIndexJob_lessonId_idx" ON "LessonIndexJob"("lessonId");

-- CreateIndex
CREATE INDEX "LessonIndexTask_jobId_idx" ON "LessonIndexTask"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonIndexTask_jobId_taskKey_key" ON "LessonIndexTask"("jobId", "taskKey");

-- CreateIndex
CREATE INDEX "LessonVectorIndexError_lessonId_jobId_idx" ON "LessonVectorIndexError"("lessonId", "jobId");

-- AddForeignKey
ALTER TABLE "LessonIndexJob" ADD CONSTRAINT "LessonIndexJob_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonIndexTask" ADD CONSTRAINT "LessonIndexTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LessonIndexJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonVectorIndexError" ADD CONSTRAINT "LessonVectorIndexError_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing lessons are treated as indexed until the author edits them again
UPDATE "Lesson"
SET "vectorIndexStatus" = 'READY', "vectorIndexedAt" = CURRENT_TIMESTAMP
WHERE length(trim("title")) > 0 OR length(trim("content")) > 0;
