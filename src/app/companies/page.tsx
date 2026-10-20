import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import CompaniesManager from "./components/CompaniesManager";

export const instant = false;

export default async function CompaniesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-base-200 p-5 text-base-content sm:p-8 xl:p-10">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-6 text-sm text-base-content/55">
          <Link href="/" className="hover:text-primary">
            Dashboard
          </Link>
          {" / "}
          Empresas
        </nav>

        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
            <p className="mt-2 text-sm text-base-content/60">
              Organiza las empresas de tu interés y consulta sus oportunidades.
            </p>
          </div>

          <Link href="/" className="btn btn-outline">
            Volver al dashboard
          </Link>
        </header>

        <CompaniesManager />
      </div>
    </main>
  );
}
