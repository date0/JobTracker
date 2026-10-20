"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectTo: "/login" })}
      className="btn btn-outline btn-error mt-4 w-full"
    >
      Cerrar sesión
    </button>
  );
}
