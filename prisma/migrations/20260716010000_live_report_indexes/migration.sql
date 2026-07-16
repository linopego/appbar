-- Serata live + corrispettivi: venduto per data di pagamento, consumato per
-- data di consumo — gli indici esistenti coprivano solo createdAt/status
CREATE INDEX "Order_venueId_paidAt_idx" ON "Order"("venueId", "paidAt");
CREATE INDEX "Ticket_venueId_consumedAt_idx" ON "Ticket"("venueId", "consumedAt");
