import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  dayRangeInTimezone,
  getCorrispettivi,
  hasMovements,
  yesterdayInTimezone,
} from "@/lib/reports/corrispettivi";
import { sendDailyReportEmail } from "@/lib/email/daily-report";

export const dynamic = "force-dynamic";

// Cron giornaliero (vercel.json, 05:00 UTC ≈ 07:00 Europe/Rome): invia ai
// manager di ogni venue attivo con dailyReportEnabled il riepilogo dei
// corrispettivi del giorno solare precedente, solo se ci sono movimenti.
// Nota: il venue di un'organizzazione disattivata riceve comunque il report —
// il POS resta operativo e il consumato va comunque fiscalizzato.
export async function GET(req: NextRequest) {
  // Vercel Cron autentica con "Authorization: Bearer ${CRON_SECRET}"
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET non configurato" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

  const day = yesterdayInTimezone(new Date());
  const range = dayRangeInTimezone(day);

  const venues = await db.venue.findMany({
    where: { active: true, dailyReportEnabled: true },
    select: {
      id: true,
      name: true,
      operators: {
        where: { role: "MANAGER", active: true, email: { not: null } },
        select: { email: true },
      },
    },
  });

  const results: { venue: string; sent: number; note?: string }[] = [];

  for (const venue of venues) {
    try {
      const report = await getCorrispettivi(venue.id, range);
      if (!hasMovements(report)) {
        results.push({ venue: venue.name, sent: 0, note: "nessun movimento" });
        continue;
      }

      const recipients = venue.operators
        .map((o) => o.email)
        .filter((email): email is string => Boolean(email));
      if (recipients.length === 0) {
        results.push({ venue: venue.name, sent: 0, note: "nessun manager con email" });
        continue;
      }

      let sent = 0;
      for (const to of recipients) {
        try {
          await sendDailyReportEmail({ to, venueName: venue.name, day, report });
          sent += 1;
        } catch (error) {
          console.error(`[Cron corrispettivi] invio fallito per ${venue.name} → ${to}:`, error);
        }
      }
      results.push({ venue: venue.name, sent });
    } catch (error) {
      // Un venue che fallisce non deve fermare gli altri
      console.error(`[Cron corrispettivi] report fallito per ${venue.name}:`, error);
      results.push({ venue: venue.name, sent: 0, note: "errore" });
    }
  }

  return NextResponse.json({ ok: true, day, results });
}
