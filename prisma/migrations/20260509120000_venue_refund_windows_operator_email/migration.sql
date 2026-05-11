-- AlterTable
ALTER TABLE "Venue" ADD COLUMN "refundBlockedWindows" JSONB,
ADD COLUMN "refundBlockedTimezone" TEXT NOT NULL DEFAULT 'Europe/Rome';

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN "email" TEXT;
