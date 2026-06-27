-- CreateEnum
CREATE TYPE "LessonGenerationJobStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "LessonGenerationJob" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "LessonGenerationJobStatus" NOT NULL DEFAULT 'PROCESSING',
    "content" TEXT,
    "title" TEXT,
    "usageJson" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "ragRequestId" TEXT,
    "ragTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LessonGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonGenerationJob_lessonId_createdAt_idx" ON "LessonGenerationJob"("lessonId", "createdAt");

-- AddForeignKey
ALTER TABLE "LessonGenerationJob" ADD CONSTRAINT "LessonGenerationJob_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
