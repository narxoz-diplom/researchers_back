-- Platform-wide AI settings (admin-managed subscriber chat key).
CREATE TABLE "PlatformAiSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "subscriberChatEncryptedKey" TEXT,
    "subscriberChatKeyHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAiSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformAiSettings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
