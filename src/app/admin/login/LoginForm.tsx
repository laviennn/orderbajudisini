"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  return (
    <form action={action} className="mt-8 grid max-w-sm gap-5">
      <div>
        <label htmlFor="email" className="block text-sm">
          Email staf
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
          className="mt-2 min-h-12 w-full border border-border bg-surface px-3"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          aria-describedby={state.error ? "login-error" : undefined}
          className="mt-2 min-h-12 w-full border border-border bg-surface px-3"
        />
      </div>
      {state.error && (
        <p id="login-error" role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="primary-action disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
