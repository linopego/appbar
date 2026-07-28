import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createStaffSession, requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";

const bodySchema = z.object({
  password: z
    .string()
    .min(8, "La password deve avere almeno 8 caratteri")
    .max(128, "Password troppo lunga"),
});

// Cambio password del manager (obbligatorio dopo una password temporanea).
export async function POST(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const operator = await db.operator.update({
    where: { id: session.operatorId },
    data: { passwordHash, mustChangePassword: false },
    select: {
      id: true,
      name: true,
      role: true,
      venue: { select: { id: true, slug: true } },
    },
  });

  // Hardening: rigenera la sessione COMPLETA da dati freschi del DB, così
  // l'atterraggio su /admin non dipende mai da un cookie parziale o stantio.
  await createStaffSession({
    operatorId: operator.id,
    venueId: operator.venue.id,
    venueSlug: operator.venue.slug,
    role: operator.role,
    name: operator.name,
  });

  await logManagerAction({
    operatorId: session.operatorId,
    action: "MANAGER_PASSWORD_CHANGED",
    targetType: "Operator",
    targetId: session.operatorId,
  });

  return NextResponse.json({ ok: true, redirectTo: "/admin" });
}
