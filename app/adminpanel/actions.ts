"use server";

import { redirect } from "next/navigation";
import { clientIp, endSession, startSession } from "@/lib/auth/current-admin";
import { attemptLogin, LOCK_MINUTES } from "@/lib/auth/login";
import { prisma } from "@/lib/prisma";

export type LoginState = { error: string } | undefined;

/** RF-31, RF-32: login con email y contraseña. Nunca se revela si falló el email o la clave. */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email.trim() || !password) return { error: "Ingresá tu email y tu contraseña." };

  const result = await attemptLogin(prisma, { email, password, ip: await clientIp() });
  if (!result.ok) {
    return {
      error:
        result.reason === "LOCKED"
          ? `Demasiados intentos fallidos. Probá de nuevo en ${LOCK_MINUTES} minutos.`
          : "Email o contraseña incorrectos.",
    };
  }

  await startSession(result.adminId);
  redirect("/adminpanel");
}

export async function logoutAction() {
  await endSession();
  redirect("/adminpanel");
}
