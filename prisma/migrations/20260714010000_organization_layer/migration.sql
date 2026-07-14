-- Livello Organization sopra Venue: migrazione in 3 fasi nella stessa
-- transazione. I dati esistenti vengono assegnati alla prima organizzazione;
-- gli AdminUser esistenti diventano admin di piattaforma (PLATFORM).

-- ─── Fase 1: struttura (colonne nuove NULLABLE per consentire il backfill) ───

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('PLATFORM', 'ORG_ADMIN');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "feePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeAccountId_key" ON "Organization"("stripeAccountId");

-- AlterTable (organizationId nullable: diventa NOT NULL in fase 3)
ALTER TABLE "Venue" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "role" "AdminRole" NOT NULL DEFAULT 'ORG_ADMIN';
ALTER TABLE "AdminUser" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "AdminAuditLog" ADD COLUMN "organizationId" TEXT;

-- ─── Fase 2: backfill dei dati esistenti ─────────────────────────────────────

-- Prima organizzazione della piattaforma (id fisso e leggibile: usato anche
-- dal seed per l'upsert; il nome è rinominabile in ogni momento con un UPDATE)
INSERT INTO "Organization" ("id", "name", "feePercent", "active", "createdAt", "updatedAt")
VALUES ('org_pegoraro', 'Gruppo Pegoraro', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Tutti i venue esistenti appartengono alla prima organizzazione
UPDATE "Venue" SET "organizationId" = 'org_pegoraro' WHERE "organizationId" IS NULL;

-- Gli AdminUser esistenti diventano admin di piattaforma (nessuna org)
UPDATE "AdminUser" SET "role" = 'PLATFORM', "organizationId" = NULL;

-- ─── Fase 3: vincoli, indici e foreign key ───────────────────────────────────

ALTER TABLE "Venue" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Venue_organizationId_idx" ON "Venue"("organizationId");
CREATE INDEX "AdminUser_organizationId_idx" ON "AdminUser"("organizationId");
CREATE INDEX "AdminAuditLog_organizationId_createdAt_idx" ON "AdminAuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
