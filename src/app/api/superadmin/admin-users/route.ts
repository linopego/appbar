import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { adminUserRoleOrgSchema } from "@/lib/validators/admin-user";

export async function GET() {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const users = await db.adminUser.findMany({
    where: orgScopeWhere(session).adminUser,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      organizationId: true,
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

const createAdminUserSchema = z
  .object({
    email: z.string().trim().min(1, "email è obbligatoria").email("email non valida"),
    name: z.string().trim().min(1, "name è obbligatorio"),
  })
  .and(adminUserRoleOrgSchema);

export async function POST(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const parsed = createAdminUserSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" },
      { status: 400 }
    );
  }
  const { email, name, role, organizationId } = parsed.data;

  // Solo un admin PLATFORM può creare altri admin PLATFORM
  if (role === "PLATFORM" && session.role !== "PLATFORM") {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN_ROLE", message: "Solo un admin di piattaforma può creare admin PLATFORM" } },
      { status: 403 }
    );
  }

  // Un ORG_ADMIN può creare admin solo per la propria organizzazione
  if (session.role === "ORG_ADMIN" && organizationId !== session.organizationId) {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN_ORG", message: "Puoi creare admin solo per la tua organizzazione" } },
      { status: 403 }
    );
  }

  // L'organizzazione indicata deve esistere
  if (organizationId) {
    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return NextResponse.json({ ok: false, error: { code: "ORG_NOT_FOUND" } }, { status: 422 });
    }
  }

  const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  try {
    const user = await db.adminUser.create({
      data: {
        email: email.toLowerCase(),
        name,
        role,
        organizationId,
        passwordHash,
        mustChangePassword: true,
        totpEnabled: false,
        active: true,
      },
    });

    await logAdminAction({
      adminUserId: session.adminUserId,
      organizationId: organizationId ?? undefined,
      action: "ADMIN_USER_CREATED",
      targetType: "AdminUser",
      targetId: user.id,
      payload: { email: user.email, name: user.name, role, organizationId },
    });

    return NextResponse.json({ ok: true, data: { id: user.id, tempPassword } }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: { code: "EMAIL_EXISTS" } }, { status: 409 });
    }
    throw err;
  }
}
