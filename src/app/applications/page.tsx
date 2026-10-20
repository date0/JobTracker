import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import ApplicationsManager from "./components/ApplicationsManager";

export const instant = false;

export default async function ApplicationsPage() {
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
          Candidaturas
        </nav>

        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Candidaturas</h1>
            <p className="mt-2 text-sm text-base-content/60">
              Organiza tus postulaciones y da seguimiento a cada proceso de selección.
            </p>
          </div>

          <Link href="/" className="btn btn-outline">
            Volver al dashboard
          </Link>
        </header>

        <ApplicationsManager />
      </div>
    </main>
  );
}
