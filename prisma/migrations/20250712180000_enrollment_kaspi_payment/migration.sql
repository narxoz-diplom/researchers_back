-- Kaspi manual payment: track amounts and underpaid status
ALTER TYPE "CourseEnrollmentStatus" ADD VALUE IF NOT EXISTS 'UNDERPAID';

ALTER TABLE "CourseEnrollment"
  ADD COLUMN IF NOT EXISTS "paidAmountCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "expectedAmountCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "adminPaymentNote" TEXT;
