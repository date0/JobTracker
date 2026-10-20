"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Company = {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  created_at?: string;
};

type CompaniesResponse = {
  success: boolean;
  companies?: Company[];
  error?: string;
};

export default function CompaniesManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCompanies = useCallback(async () => {
    try {
      const response = await fetch("/api/companies");
      const data: CompaniesResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudieron cargar las empresas.");
      }

      setError("");
      setCompanies(data.companies ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar las empresas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // La función realiza fetch asíncrono antes de actualizar el estado.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Carga inicial asíncrona de datos.
    void loadCompanies();
  }, [loadCompanies]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, website, description }),
      });

      const data: {
        success: boolean;
        company?: Company;
        error?: string;
      } = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo registrar la empresa.");
      }

      setName("");
      setWebsite("");
      setDescription("");
      setMessage("Empresa registrada correctamente.");
      await loadCompanies();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar la empresa.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Registrar empresa</h2>
          <p className="text-sm text-base-content/60">
            Agrega una empresa al directorio compartido de JobTracker.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="company-name" className="label">
                <span className="label-text font-medium">Nombre *</span>
              </label>
              <input
                id="company-name"
                type="text"
                className="input input-bordered w-full"
                placeholder="Ej. Microsoft"
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="company-website" className="label">
                <span className="label-text font-medium">Sitio web</span>
              </label>
              <input
                id="company-website"
                type="url"
                className="input input-bordered w-full"
                placeholder="https://www.ejemplo.com"
                maxLength={2048}
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="company-description" className="label">
                <span className="label-text font-medium">Descripción</span>
              </label>
              <textarea
                id="company-description"
                className="textarea textarea-bordered min-h-24 w-full"
                placeholder="Información relevante sobre la empresa..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-error/10 p-3 text-sm text-error"
              >
                {error}
              </p>
            )}

            {message && (
              <p
                role="status"
                className="rounded-lg bg-success/10 p-3 text-sm text-success"
              >
                {message}
              </p>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando..." : "Registrar empresa"}
            </button>
          </form>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Directorio de empresas</h2>
              <p className="mt-1 text-sm text-base-content/60">
                {companies.length}{" "}
                {companies.length === 1
                  ? "empresa registrada"
                  : "empresas registradas"}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void loadCompanies()}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-base-content/60">
              Cargando empresas...
            </p>
          ) : companies.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-base-300 px-5 py-10 text-center">
              <div className="mb-3 text-3xl">▤</div>
              <h3 className="font-semibold">Aún no hay empresas registradas</h3>
              <p className="mt-2 text-sm text-base-content/60">
                Utiliza el formulario para agregar la primera empresa.
              </p>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-base-300">
              {companies.map((company) => (
                <li key={company.id} className="py-4 first:pt-0 last:pb-0">
                  <h3 className="font-semibold">{company.name}</h3>
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block break-all text-sm text-primary hover:underline"
                    >
                      {company.website}
                    </a>
                  )}
                  {company.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-base-content/70">
                      {company.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
