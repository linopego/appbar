import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["BARISTA", "CASSIERE", "MANAGER"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export async function POST(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let body: { name?: unknown; email?: unknown; role?: unknown; pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { name, email, role, pin } = body;

  if (typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ ok: false, error: "name è obbligatorio" }, { status: 400 });
  }
  if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: "pin deve essere 4-6 cifre" }, { status: 400 });
  }
  if (typeof role !== "string" || !VALID_ROLES.includes(role as ValidRole)) {
    return NextResponse.json({ ok: false, error: "role non valido" }, { status: 400 });
  }
  if (email !== undefined && email !== null && typeof email !== "string") {
    return NextResponse.json({ ok: false, error: "email non valida" }, { status: 400 });
  }

  const pinHash = await bcrypt.hash(pin, 12);

  try {
    const op = await db.operator.create({
      data: {
        venueId: session.venueId,
        name: name.trim(),
        email: typeof email === "string" ? email.trim() || null : null,
        role: role as ValidRole,
        pinHash,
        active: true,
      },
    });

    await logManagerAction({
      operatorId: session.operatorId,
      action: "OPERATOR_CREATED",
      targetType: "Operator",
      targetId: op.id,
      payload: { name: op.name, role: op.role },
    });

    return NextResponse.json({ ok: true, data: { id: op.id } }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: { code: "EMAIL_EXISTS" } }, { status: 409 });
    }
    throw err;
  }
}
