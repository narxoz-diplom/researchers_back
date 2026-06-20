-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "priceCents" INTEGER;

-- AlterTable
ALTER TABLE "LessonVideo" ADD COLUMN "priceCents" INTEGER;

-- CreateTable
CREATE TABLE "LessonPurchase" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoPurchase" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonPurchase_userId_idx" ON "LessonPurchase"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPurchase_lessonId_userId_key" ON "LessonPurchase"("lessonId", "userId");

-- CreateIndex
CREATE INDEX "VideoPurchase_userId_idx" ON "VideoPurchase"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoPurchase_videoId_userId_key" ON "VideoPurchase"("videoId", "userId");

-- AddForeignKey
ALTER TABLE "LessonPurchase" ADD CONSTRAINT "LessonPurchase_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPurchase" ADD CONSTRAINT "LessonPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoPurchase" ADD CONSTRAINT "VideoPurchase_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "LessonVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoPurchase" ADD CONSTRAINT "VideoPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
