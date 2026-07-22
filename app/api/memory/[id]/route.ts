import { NextResponse } from "next/server";
import { DEMO_CUSTOMER } from "@/lib/constants";
import { deleteFact, deleteEvent } from "@/lib/memory/store";

export const runtime = "nodejs";

/** Delete a single remembered item by id (fact or event — ids are unique across both). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await deleteFact(DEMO_CUSTOMER, id);
  await deleteEvent(DEMO_CUSTOMER, id);
  return NextResponse.json({ ok: true });
}
