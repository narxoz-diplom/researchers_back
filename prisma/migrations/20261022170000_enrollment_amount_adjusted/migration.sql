-- The admin can correct the recorded payment to the amount that actually arrived (declared less than sent, or more).
ALTER TYPE "EnrollmentEventType" ADD VALUE 'AMOUNT_ADJUSTED';
