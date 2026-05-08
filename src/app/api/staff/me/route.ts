import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/staff";

export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED_STAFF", message: "Non autenticato." } },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true, session });
}
