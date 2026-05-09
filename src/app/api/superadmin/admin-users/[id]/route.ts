import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Utente non trovato" }, { status: 404 });
  }

  let body: { name?: unknown; email?: unknown; active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const updates: { name?: string; email?: string; active?: boolean } = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json({ ok: false, error: "name non valido" }, { status: 400 });
    }
    oldValues.name = user.name;
    newValues.name = body.name.trim();
    updates.name = body.name.trim();
  }

  if (body.email !== undefined) {
    if (typeof body.email !== "string" || body.email.trim() === "") {
      return NextResponse.json({ ok: false, error: "email non valida" }, { status: 400 });
    }
    oldValues.email = user.email;
    newValues.email = body.email.trim().toLowerCase();
    updates.email = body.email.trim().toLowerCase();
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ ok: false, error: "active deve essere booleano" }, { status: 400 });
    }
    if (body.active === false) {
      if (id === session.adminUserId) {
        return NextResponse.json(
          { ok: false, error: { code: "CANNOT_DEACTIVATE_SELF" } },
          { status: 422 }
        );
      }
      const otherActiveAdmins = await db.adminUser.count({
        where: { active: true, id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        return NextResponse.json(
          { ok: false, error: { code: "CANNOT_DEACTIVATE_LAST_ADMIN" } },
          { status: 422 }
        );
      }
    }
    oldValues.active = user.active;
    newValues.active = body.active;
    updates.active = body.active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  try {
    await db.adminUser.update({ where: { id }, data: updates });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: { code: "EMAIL_EXISTS" } }, { status: 409 });
    }
    throw err;
  }

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: "ADMIN_USER_UPDATED",
    targetType: "AdminUser",
    targetId: id,
    payload: { old: oldValues, new: newValues },
  });

  return NextResponse.json({ ok: true });
}
