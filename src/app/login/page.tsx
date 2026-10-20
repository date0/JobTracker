"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: "/",
      });

      if (result?.error) {
        setError("Correo electrónico o contraseña incorrectos.");
        return;
      }

      if (result?.ok) {
        window.location.href = "/";
        return;
      }

      setError("No fue posible iniciar sesión. Inténtalo de nuevo.");
    } catch {
      setError("Ocurrió un error al conectar. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-base-200 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-8 shadow-xl">
        <Link
          href="/"
          className="text-3xl font-bold tracking-tight text-primary"
        >
          JobTracker
        </Link>

        <h1 className="mt-8 text-2xl font-semibold text-base-content">
          Bienvenido de nuevo
        </h1>
        <p className="mt-2 text-sm text-base-content/70">
          Inicia sesión para gestionar tus oportunidades profesionales.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="label">
              <span className="label-text font-medium">Correo electrónico</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              className="input input-bordered w-full"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              <span className="label-text font-medium">Contraseña</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Tu contraseña"
              className="input input-bordered w-full"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-base-content/60">
          Acceso privado a tu espacio de JobTracker.
        </p>
      </section>
    </main>
  );
}
