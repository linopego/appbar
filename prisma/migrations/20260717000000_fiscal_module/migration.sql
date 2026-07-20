-- Modulo fiscale: documento commerciale via provider API, per venue (default spento)
ALTER TABLE "Venue" ADD COLUMN "fiscalEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Venue" ADD COLUMN "fiscalConfig" JSONB;
ALTER TABLE "PriceTier" ADD COLUMN "vatRate" DECIMAL(4,2);

CREATE TYPE "FiscalDocumentType" AS ENUM ('SALE', 'VOID');
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

CREATE TABLE "FiscalDocument" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "refundId" TEXT,
  "venueId" TEXT NOT NULL,
  "type" "FiscalDocumentType" NOT NULL,
  "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "providerDocId" TEXT,
  "protocolNumber" TEXT,
  "pdfUrl" TEXT,
  "total" DECIMAL(10,2) NOT NULL,
  "lines" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FiscalDocument_refundId_key" ON "FiscalDocument"("refundId");
CREATE INDEX "FiscalDocument_venueId_status_idx" ON "FiscalDocument"("venueId", "status");
CREATE INDEX "FiscalDocument_orderId_idx" ON "FiscalDocument"("orderId");
CREATE INDEX "FiscalDocument_status_updatedAt_idx" ON "FiscalDocument"("status", "updatedAt");
-- Idempotenza: UN solo documento di vendita per ordine (indice parziale)
CREATE UNIQUE INDEX "FiscalDocument_orderId_sale_key" ON "FiscalDocument"("orderId") WHERE "type" = 'SALE';

ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
