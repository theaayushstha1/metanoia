import { cookies } from "next/headers";
import { EditableMandateSchema, type EditableMandate } from "@/lib/mandate-policy";
import { getIntentMandate } from "@/lib/store";

const COOKIE_NAME = "metanoia_mandate";

function encode(policy: EditableMandate): string {
  return Buffer.from(JSON.stringify(policy), "utf8").toString("base64url");
}

function decode(value?: string): EditableMandate | undefined {
  if (!value) return undefined;
  try {
    return EditableMandateSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    return undefined;
  }
}

export async function getSessionMandatePolicy(): Promise<EditableMandate | undefined> {
  return decode((await cookies()).get(COOKIE_NAME)?.value);
}

export async function getSessionIntentMandate() {
  return getIntentMandate(await getSessionMandatePolicy());
}

export async function setSessionMandatePolicy(policy: EditableMandate): Promise<void> {
  (await cookies()).set(COOKIE_NAME, encode(policy), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

