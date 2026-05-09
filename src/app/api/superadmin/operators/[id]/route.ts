import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["BARISTA", "CASSIERE", "MANAGER"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  const operator = await db.operator.findUnique({ where: { id } });
  if (!operator) {
    return NextResponse.json({ ok: false, error: "Operatore non trovato" }, { status: 404 });
  }

  let body: { name?: unknown; email?: unknown; role?: unknown; pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const updates: {
    name?: string;
    email?: string | null;
    role?: ValidRole;
    pinHash?: string;
  } = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json({ ok: false, error: "name non valido" }, { status: 400 });
    }
    oldValues.name = operator.name;
    newValues.name = body.name.trim();
    updates.name = body.name.trim();
  }

  if (body.email !== undefined) {
    const emailVal =
      body.email === null
        ? null
        : typeof body.email === "string"
        ? body.email.trim() || null
        : undefined;
    if (emailVal === undefined) {
      return NextResponse.json({ ok: false, error: "email non valida" }, { status: 400 });
    }
    oldValues.email = operator.email;
    newValues.email = emailVal;
    updates.email = emailVal;
  }

  if (body.role !== undefined) {
    if (typeof body.role !== "string" || !VALID_ROLES.includes(body.role as ValidRole)) {
      return NextResponse.json({ ok: false, error: "role non valido" }, { status: 400 });
    }
    oldValues.role = operator.role;
    newValues.role = body.role;
    updates.role = body.role as ValidRole;
  }

  if (body.pin !== undefined) {
    if (typeof body.pin !== "string" || !/^\d{4,6}$/.test(body.pin)) {
      return NextResponse.json({ ok: false, error: "pin deve essere 4-6 cifre" }, { status: 400 });
    }
    updates.pinHash = await bcrypt.hash(body.pin, 12);
    newValues.pinChanged = true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  await db.operator.update({ where: { id }, data: updates });

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: "OPERATOR_UPDATED",
    targetType: "Operator",
    targetId: id,
    payload: { old: oldValues, new: newValues },
  });

  return NextResponse.json({ ok: true });
}
