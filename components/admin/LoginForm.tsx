"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/adminpanel/actions";
import { TextField } from "@/components/booking/form-fields";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  // Controlados para que el email no se borre cuando el login falla.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-5">
      {state?.error && (
        <p role="alert" className="border border-primary p-3">
          {state.error}
        </p>
      )}
      <TextField
        id="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="username"
        value={email}
        onChange={setEmail}
      />
      <TextField
        id="password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <button type="submit" className="btn-filled" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
