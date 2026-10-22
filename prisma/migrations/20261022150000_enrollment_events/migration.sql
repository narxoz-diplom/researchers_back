-- Journal of enrollment events for the admin, plus a backfill from the current state of each enrollment.

-- CreateEnum
CREATE TYPE "EnrollmentEventType" AS ENUM ('REQUESTED', 'PAYMENT_SUBMITTED', 'MORE_PAYMENT_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CourseEnrollmentEvent" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "type" "EnrollmentEventType" NOT NULL,
    "actorId" TEXT,
    "amountCents" INTEGER,
    "totalPaidCents" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEnrollmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseEnrollmentEvent_enrollmentId_createdAt_idx" ON "CourseEnrollmentEvent"("enrollmentId", "createdAt");
CREATE INDEX "CourseEnrollmentEvent_type_createdAt_idx" ON "CourseEnrollmentEvent"("type", "createdAt");
CREATE INDEX "CourseEnrollment_status_updatedAt_idx" ON "CourseEnrollment"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "CourseEnrollmentEvent" ADD CONSTRAINT "CourseEnrollmentEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseEnrollmentEvent" ADD CONSTRAINT "CourseEnrollmentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing enrollment was requested; then whatever its current state implies.
INSERT INTO "CourseEnrollmentEvent" ("id", "enrollmentId", "type", "actorId", "createdAt")
SELECT 'bf1' || substr(md5(e."id" || ':requested'), 1, 22), e."id", 'REQUESTED', e."userId", e."createdAt"
FROM "CourseEnrollment" e;

INSERT INTO "CourseEnrollmentEvent" ("id", "enrollmentId", "type", "actorId", "amountCents", "totalPaidCents", "createdAt")
SELECT 'bf2' || substr(md5(e."id" || ':paid'), 1, 22), e."id", 'PAYMENT_SUBMITTED', e."userId", e."paidAmountCents", e."paidAmountCents", e."paidAt"
FROM "CourseEnrollment" e
WHERE e."paidAt" IS NOT NULL;

INSERT INTO "CourseEnrollmentEvent" ("id", "enrollmentId", "type", "note", "createdAt")
SELECT 'bf3' || substr(md5(e."id" || ':more'), 1, 22), e."id", 'MORE_PAYMENT_REQUESTED', e."adminPaymentNote", e."updatedAt"
FROM "CourseEnrollment" e
WHERE e."status" = 'UNDERPAID';

INSERT INTO "CourseEnrollmentEvent" ("id", "enrollmentId", "type", "actorId", "totalPaidCents", "createdAt")
SELECT 'bf4' || substr(md5(e."id" || ':approved'), 1, 22), e."id", 'APPROVED', e."approvedById", e."paidAmountCents", COALESCE(e."approvedAt", e."updatedAt")
FROM "CourseEnrollment" e
WHERE e."status" = 'APPROVED';

INSERT INTO "CourseEnrollmentEvent" ("id", "enrollmentId", "type", "totalPaidCents", "createdAt")
SELECT 'bf5' || substr(md5(e."id" || ':rejected'), 1, 22), e."id", 'REJECTED', e."paidAmountCents", e."updatedAt"
FROM "CourseEnrollment" e
WHERE e."status" = 'REJECTED';

INSERT INTO "CourseEnrollmentEvent" ("id", "enrollmentId", "type", "actorId", "totalPaidCents", "createdAt")
SELECT 'bf6' || substr(md5(e."id" || ':cancelled'), 1, 22), e."id", 'CANCELLED', e."userId", e."paidAmountCents", e."updatedAt"
FROM "CourseEnrollment" e
WHERE e."status" = 'CANCELLED';
