"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, registerUser, RegisterError } from "@/modules/auth/service";
import { createSession, destroyCurrentSession } from "@/lib/session";
import { formToObject, loginSchema, registerSchema, validate } from "@/lib/validation";
import type { ActionState } from "@/lib/types";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** FR-01/02/04/05/06: login USER & ADMIN. Role & status ditentukan server dari database. */
export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  const v = validate(loginSchema, raw);
  if (!v.ok) return v.state;
  const res = await authenticate(v.data, await clientIp());
  if (!res.ok) {
    const values = { ...raw }; delete values.password;
    return { ok: false, message: res.message, values };
  }
  await createSession(res.userId);
  redirect(res.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  const v = validate(registerSchema, raw);
  if (!v.ok) return v.state;
  try {
    const { confirmPassword: _c, ...input } = v.data;
    void _c;
    const userId = await registerUser(input);
    await createSession(userId);
  } catch (e) {
    if (e instanceof RegisterError) {
      const values = { ...raw }; delete values.password; delete values.confirmPassword;
      return { ok: false, message: e.message, values, fieldErrors: e.field ? { [e.field]: [e.message] } : undefined };
    }
    throw e;
  }
  redirect("/dashboard");
}

/** FR-27: logout menghapus sesi di server. */
export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}
