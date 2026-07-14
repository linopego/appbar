-- Login email+password per gli operatori MANAGER (il PIN resta per tutti):
-- passwordHash bcrypt opzionale + flag di cambio obbligatorio al primo login.

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Operator" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
