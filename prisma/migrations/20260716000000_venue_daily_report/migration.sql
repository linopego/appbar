-- Email giornaliera dei corrispettivi: attivabile/disattivabile per venue
ALTER TABLE "Venue" ADD COLUMN "dailyReportEnabled" BOOLEAN NOT NULL DEFAULT true;
