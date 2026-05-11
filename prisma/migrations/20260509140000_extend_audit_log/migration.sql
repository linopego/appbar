-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN_USER', 'OPERATOR', 'SYSTEM');

-- AlterTable: make adminUserId nullable, add operatorId + actorType
ALTER TABLE "AdminAuditLog" ALTER COLUMN "adminUserId" DROP NOT NULL;
ALTER TABLE "AdminAuditLog" ADD COLUMN "operatorId" TEXT;
ALTER TABLE "AdminAuditLog" ADD COLUMN "actorType" "ActorType" NOT NULL DEFAULT 'ADMIN_USER';

-- CreateIndex
CREATE INDEX "AdminAuditLog_operatorId_createdAt_idx" ON "AdminAuditLog"("operatorId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
