import { NextResponse } from "next/server";
import { getSessionCustomerId } from "@/lib/session";
import { deleteFact, deleteEvent } from "@/lib/memory/store";

export const runtime = "nodejs";

/** Delete a single remembered item by id (fact or event — ids are unique across both). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const customerId = await getSessionCustomerId();
  await deleteFact(customerId, id);
  await deleteEvent(customerId, id);
  return NextResponse.json({ ok: true });
}
