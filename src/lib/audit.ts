import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ── Admin (super-admin cross-venue) ───────────────────────────────────────

interface LogAdminActionInput {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAdminAction(params: LogAdminActionInput): Promise<void> {
  const data: Prisma.AdminAuditLogUncheckedCreateInput = {
    adminUserId: params.adminUserId,
    actorType: "ADMIN_USER",
    action: params.action,
    ...(params.targetType !== undefined ? { targetType: params.targetType } : {}),
    ...(params.targetId !== undefined ? { targetId: params.targetId } : {}),
    ...(params.payload !== undefined
      ? { payload: params.payload as Prisma.InputJsonValue }
      : {}),
    ...(params.ipAddress !== undefined ? { ipAddress: params.ipAddress } : {}),
    ...(params.userAgent !== undefined ? { userAgent: params.userAgent } : {}),
  };
  await db.adminAuditLog.create({ data });
}

// ── Manager (operator con role MANAGER, venue-scoped) ────────────────────

interface LogManagerActionInput {
  operatorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logManagerAction(params: LogManagerActionInput): Promise<void> {
  const data: Prisma.AdminAuditLogUncheckedCreateInput = {
    operatorId: params.operatorId,
    actorType: "OPERATOR",
    action: params.action,
    ...(params.targetType !== undefined ? { targetType: params.targetType } : {}),
    ...(params.targetId !== undefined ? { targetId: params.targetId } : {}),
    ...(params.payload !== undefined
      ? { payload: params.payload as Prisma.InputJsonValue }
      : {}),
    ...(params.ipAddress !== undefined ? { ipAddress: params.ipAddress } : {}),
    ...(params.userAgent !== undefined ? { userAgent: params.userAgent } : {}),
  };
  await db.adminAuditLog.create({ data });
}
