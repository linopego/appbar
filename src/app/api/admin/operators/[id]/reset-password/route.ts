import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";

// Imposta/reimposta la password di accesso al pannello per un operatore
// MANAGER del PROPRIO venue. La password temporanea viene mostrata una sola
// volta e obbliga il cambio al primo login.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await params;
  const operator = await db.operator.findFirst({
    where: { id, venueId: session.venueId },
  });
  if (!operator) {
    return NextResponse.json({ ok: false, error: "Operatore non trovato" }, { status: 404 });
  }
  if (operator.role !== "MANAGER") {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_MANAGER", message: "Solo gli operatori MANAGER accedono con email e password." } },
      { status: 422 }
    );
  }
  if (!operator.email) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_EMAIL", message: "Aggiungi prima un'email all'operatore." } },
      { status: 422 }
    );
  }

  const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await db.operator.update({
    where: { id: operator.id },
    data: { passwordHash, mustChangePassword: true },
  });

  await logManagerAction({
    operatorId: session.operatorId,
    action: "OPERATOR_PASSWORD_RESET",
    targetType: "Operator",
    targetId: operator.id,
    payload: { operatorName: operator.name },
  });

  return NextResponse.json({ ok: true, data: { tempPassword } });
}
