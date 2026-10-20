import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import ResumeEditor from "./components/ResumeEditor";
import ResumeJobAnalyzer from "./components/ResumeJobAnalyzer";

export const instant = false;

export default async function ResumePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-base-200 p-5 text-base-content sm:p-8 xl:p-10">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-6 text-sm text-base-content/55">
          <Link href="/" className="hover:text-primary">
            Dashboard
          </Link>
          {" / "}Mi currículum
        </nav>

        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Mi currículum
            </h1>
            <p className="mt-2 text-sm text-base-content/60">
              Mantén tu experiencia y habilidades en un CV maestro que podrás
              adaptar a distintas vacantes.
            </p>
          </div>

          <Link href="/" className="btn btn-outline">
            Volver al dashboard
          </Link>
        </header>

        <ResumeEditor />

        <div className="mt-8">
          <ResumeJobAnalyzer />
        </div>
      </div>
    </main>
  );
}
