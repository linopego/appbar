import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const PAGE_SIZE = 25;
const VALID_ROLES = ["BARISTA", "CASSIERE", "MANAGER"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export async function GET(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const url = req.nextUrl;
  const venueId = url.searchParams.get("venueId");
  const role = url.searchParams.get("role");
  const activeParam = url.searchParams.get("active");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const where: Prisma.OperatorWhereInput = {};

  if (venueId) where.venueId = venueId;
  if (role && VALID_ROLES.includes(role as ValidRole)) {
    where.role = role as ValidRole;
  }
  if (activeParam !== null) {
    where.active = activeParam === "true";
  }

  const [operators, total] = await Promise.all([
    db.operator.findMany({
      where,
      include: { venue: { select: { name: true, slug: true } } },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.operator.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      operators,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let body: { venueId?: unknown; name?: unknown; email?: unknown; role?: unknown; pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { venueId, name, email, role, pin } = body;

  if (typeof venueId !== "string" || venueId.trim() === "") {
    return NextResponse.json({ ok: false, error: "venueId è obbligatorio" }, { status: 400 });
  }
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

  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

  const pinHash = await bcrypt.hash(pin, 12);

  try {
    const op = await db.operator.create({
      data: {
        venueId,
        name: name.trim(),
        email: typeof email === "string" ? email.trim() || null : null,
        role: role as ValidRole,
        pinHash,
        active: true,
      },
    });

    await logAdminAction({
      adminUserId: session.adminUserId,
      action: "OPERATOR_CREATED",
      targetType: "Operator",
      targetId: op.id,
      payload: { name: op.name, role: op.role, venueId },
    });

    return NextResponse.json({ ok: true, data: { id: op.id } }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: { code: "EMAIL_EXISTS" } }, { status: 409 });
    }
    throw err;
  }
}
