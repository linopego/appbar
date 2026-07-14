-- Macchina a stati del rimborso: PROCESSING (claim in corso) e FAILED (Stripe fallito, rientrabile)
-- Nota PG >= 12: ADD VALUE è consentito in transazione purché il nuovo valore
-- non venga usato nella stessa transazione (qui non lo usiamo).
ALTER TYPE "RefundStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "RefundStatus" ADD VALUE 'FAILED';

-- Ultimo errore Stripe quando status = FAILED
ALTER TABLE "Refund" ADD COLUMN "errorMessage" TEXT;
