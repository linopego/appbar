import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function GET(_req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const users = await db.adminUser.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      totpEnabled: true,
      mustChangePassword: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ok: true, data: users });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let body: { email?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { email, name } = body;

  if (typeof email !== "string" || email.trim() === "") {
    return NextResponse.json({ ok: false, error: "email è obbligatoria" }, { status: 400 });
  }
  if (typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ ok: false, error: "name è obbligatorio" }, { status: 400 });
  }

  const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  try {
    const user = await db.adminUser.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        passwordHash,
        mustChangePassword: true,
        totpEnabled: false,
        active: true,
      },
    });

    await logAdminAction({
      adminUserId: session.adminUserId,
      action: "ADMIN_USER_CREATED",
      targetType: "AdminUser",
      targetId: user.id,
      payload: { email: user.email, name: user.name },
    });

    return NextResponse.json({ ok: true, data: { id: user.id, tempPassword } }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: { code: "EMAIL_EXISTS" } }, { status: 409 });
    }
    throw err;
  }
}
