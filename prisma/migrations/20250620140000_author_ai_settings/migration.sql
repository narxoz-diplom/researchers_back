-- CreateTable
CREATE TABLE "AuthorAiSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "keyHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorAiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonChatUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonChatUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorAiSettings_userId_key" ON "AuthorAiSettings"("userId");

-- CreateIndex
CREATE INDEX "LessonChatUsage_userId_idx" ON "LessonChatUsage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonChatUsage_userId_periodStart_key" ON "LessonChatUsage"("userId", "periodStart");

-- AddForeignKey
ALTER TABLE "AuthorAiSettings" ADD CONSTRAINT "AuthorAiSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonChatUsage" ADD CONSTRAINT "LessonChatUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
