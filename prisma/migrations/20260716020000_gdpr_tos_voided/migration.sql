-- GDPR: consenso ai Termini al checkout + stato VOIDED per il diritto all'oblio
ALTER TABLE "Order" ADD COLUMN "tosAcceptedAt" TIMESTAMP(3);
ALTER TYPE "TicketStatus" ADD VALUE 'VOIDED';
