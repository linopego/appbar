import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStaff, StaffAuthError } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { checkRateLimit, posConsumeLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils/request";
import { z } from "zod";

const bodySchema = z.object({ qrToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireStaff();
  } catch (err) {
    const code = err instanceof StaffAuthError ? err.message : "UNAUTHORIZED_STAFF";
    return NextResponse.json(
      { ok: false, error: { code, message: "Sessione scaduta." } },
      { status: 401 }
    );
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(posConsumeLimiter, `${session.operatorId}:${ip}`);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Troppi tentativi." } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "INVALID_JSON" } }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR" } },
      { status: 422 }
    );
  }

  const { qrToken } = parsed.data;
  const { operatorId, venueId } = session;

  const result = await db.$transaction(
    async (tx) => {
      const tickets = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          venueId: string;
          expiresAt: Date;
          priceTierId: string;
          consumedAt: Date | null;
          consumedBy: string | null;
        }>
      >`
        SELECT id, status, "venueId", "expiresAt", "priceTierId", "consumedAt", "consumedBy"
        FROM "Ticket"
        WHERE "qrToken" = ${qrToken}
        FOR UPDATE
      `;

      const ticket = tickets[0];

      if (!ticket) {
        return { ok: false as const, code: "TICKET_NOT_FOUND" as const };
      }

      if (ticket.venueId !== venueId) {
        return { ok: false as const, code: "WRONG_VENUE" as const };
      }

      if (ticket.expiresAt < new Date()) {
        return { ok: false as const, code: "EXPIRED" as const };
      }

      if (ticket.status === "CONSUMED") {
        const consumedByOp = ticket.consumedBy
          ? await tx.operator.findUnique({
              where: { id: ticket.consumedBy },
              select: { name: true },
            })
          : null;
        return {
          ok: false as const,
          code: "ALREADY_CONSUMED" as const,
          consumedAt: ticket.consumedAt,
          consumedByName: consumedByOp?.name ?? null,
        };
      }

      if (ticket.status === "REFUNDED") {
        return { ok: false as const, code: "REFUNDED" as const };
      }

      if (ticket.status !== "ACTIVE") {
        return { ok: false as const, code: "INVALID_STATE" as const };
      }

      const now = new Date();
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: "CONSUMED", consumedAt: now, consumedBy: operatorId },
      });

      const tier = await tx.priceTier.findUnique({
        where: { id: ticket.priceTierId },
        select: { name: true, price: true },
      });

      return { ok: true as const, consumedAt: now, tier: tier! };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 5000 }
  );

  switch (result.code ?? (result.ok ? "OK" : "UNKNOWN")) {
    case "OK":
      return NextResponse.json({
        ok: true,
        data: {
          consumedAt: (result as { consumedAt: Date }).consumedAt.toISOString(),
          tier: {
            name: (result as { tier: { name: string; price: { toString(): string } } }).tier.name,
            price: (result as { tier: { name: string; price: { toString(): string } } }).tier.price.toString(),
          },
        },
      });
    case "TICKET_NOT_FOUND":
      return NextResponse.json(
        { ok: false, error: { code: "TICKET_NOT_FOUND" } },
        { status: 404 }
      );
    case "WRONG_VENUE":
      return NextResponse.json(
        { ok: false, error: { code: "WRONG_VENUE" } },
        { status: 400 }
      );
    case "EXPIRED":
      return NextResponse.json(
        { ok: false, error: { code: "EXPIRED" } },
        { status: 400 }
      );
    case "ALREADY_CONSUMED": {
      const r = result as { consumedAt: Date | null; consumedByName: string | null };
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "ALREADY_CONSUMED",
            consumedAt: r.consumedAt?.toISOString() ?? null,
            consumedByName: r.consumedByName,
          },
        },
        { status: 409 }
      );
    }
    case "REFUNDED":
      return NextResponse.json(
        { ok: false, error: { code: "REFUNDED" } },
        { status: 400 }
      );
    default:
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_STATE" } },
        { status: 500 }
      );
  }
}
