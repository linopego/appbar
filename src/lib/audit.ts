import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

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
