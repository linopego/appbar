import { NextResponse } from "next/server";
import { destroyStaffSession } from "@/lib/auth/staff";

export async function POST() {
  await destroyStaffSession();
  return NextResponse.json({ ok: true });
}
