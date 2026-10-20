"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Company = {
  id: number | string;
  name: string;
};

type Job = {
  id: number | string;
  company_id: number | string | null;
  company_name?: string | null;
  title: string;
  description: string | null;
  source_url: string | null;
  source_site?: string | null;
  location: string | null;
  work_mode: "onsite" | "hybrid" | "remote" | "unknown";
  employment_type: string | null;
};

const workModeLabels: Record<Job["work_mode"], string> = {
  onsite: "Presencial",
  hybrid: "Híbrido",
  remote: "Remoto",
  unknown: "No especificado",
};

export default function JobsManager() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState<Job["work_mode"]>("unknown");
  const [employmentType, setEmploymentType] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [jobsResponse, companiesResponse] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/companies"),
      ]);

      const jobsData = await jobsResponse.json();
      const companiesData = await companiesResponse.json();

      if (!jobsResponse.ok || !jobsData.success) {
        throw new Error(
          jobsData.error || "No se pudieron cargar las vacantes.",
        );
      }

      if (!companiesResponse.ok || !companiesData.success) {
        throw new Error(
          companiesData.error || "No se pudieron cargar las empresas.",
        );
      }

      setError("");
      setJobs(jobsData.jobs ?? []);
      setCompanies(companiesData.companies ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar la información.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // La función realiza fetch asíncrono antes de actualizar el estado.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Carga inicial asíncrona de datos.
    void loadData();
  }, [loadData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          company_id: companyId || null,
          source_url: sourceUrl,
          location,
          work_mode: workMode,
          employment_type: employmentType,
          description,
        }),
      });

      const data: { success: boolean; error?: string } = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo registrar la vacante.");
      }

      setTitle("");
      setCompanyId("");
      setSourceUrl("");
      setLocation("");
      setWorkMode("unknown");
      setEmploymentType("");
      setDescription("");
      setMessage("Vacante registrada correctamente.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar la vacante.",
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    return [
      job.title,
      job.company_name ?? "",
      job.location ?? "",
      job.employment_type ?? "",
    ].some((value) => value.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-6">
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Registrar vacante</h2>
          <p className="text-sm text-base-content/60">
            Guarda una oferta de empleo y conserva su enlace original.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="job-title" className="label">
                <span className="label-text font-medium">
                  Título de la vacante *
                </span>
              </label>
              <input
                id="job-title"
                className="input input-bordered w-full"
                placeholder="Ej. Senior DevOps Engineer"
                maxLength={255}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="job-company" className="label">
                <span className="label-text font-medium">Empresa</span>
              </label>
              <select
                id="job-company"
                className="select select-bordered w-full"
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
              >
                <option value="">Sin empresa asociada</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              {companies.length === 0 && (
                <p className="mt-1 text-xs text-base-content/60">
                  Puedes registrar empresas primero desde el apartado Empresas.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="job-url" className="label">
                <span className="label-text font-medium">
                  Enlace de la oferta
                </span>
              </label>
              <input
                id="job-url"
                type="url"
                className="input input-bordered w-full"
                placeholder="https://careers.ejemplo.com/job/123"
                maxLength={2048}
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="job-location" className="label">
                  <span className="label-text font-medium">Ubicación</span>
                </label>
                <input
                  id="job-location"
                  className="input input-bordered w-full"
                  placeholder="Ej. Remoto, México"
                  maxLength={255}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="job-mode" className="label">
                  <span className="label-text font-medium">Modalidad</span>
                </label>
                <select
                  id="job-mode"
                  className="select select-bordered w-full"
                  value={workMode}
                  onChange={(event) =>
                    setWorkMode(event.target.value as Job["work_mode"])
                  }
                >
                  <option value="unknown">No especificado</option>
                  <option value="remote">Remoto</option>
                  <option value="hybrid">Híbrido</option>
                  <option value="onsite">Presencial</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="job-type" className="label">
                <span className="label-text font-medium">Tipo de empleo</span>
              </label>
              <input
                id="job-type"
                className="input input-bordered w-full"
                placeholder="Ej. Tiempo completo, contrato"
                maxLength={100}
                value={employmentType}
                onChange={(event) => setEmploymentType(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="job-description" className="label">
                <span className="label-text font-medium">Descripción</span>
              </label>
              <textarea
                id="job-description"
                className="textarea textarea-bordered min-h-32 w-full"
                placeholder="Responsabilidades, requisitos y notas de la oferta..."
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
              {saving ? "Guardando..." : "Registrar vacante"}
            </button>
          </form>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Directorio de vacantes</h2>
              <p className="mt-1 text-sm text-base-content/60">
                {filteredJobs.length} de {jobs.length}{" "}
                {jobs.length === 1 ? "vacante" : "vacantes"}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void loadData()}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <input
            type="search"
            className="input input-bordered mt-4 w-full"
            placeholder="Buscar por título, empresa, ubicación o tipo..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar vacantes"
          />

          {loading ? (
            <p className="py-8 text-center text-sm text-base-content/60">
              Cargando vacantes...
            </p>
          ) : filteredJobs.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-base-300 px-5 py-10 text-center">
              <div className="mb-3 text-3xl">▣</div>
              <h3 className="font-semibold">
                {jobs.length === 0
                  ? "Aún no hay vacantes registradas"
                  : "No se encontraron coincidencias"}
              </h3>
              <p className="mt-2 text-sm text-base-content/60">
                {jobs.length === 0
                  ? "Utiliza el formulario para guardar tu primera oferta."
                  : "Prueba con otro término de búsqueda."}
              </p>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-base-300">
              {filteredJobs.map((job) => (
                <li key={job.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{job.title}</h3>
                      {job.company_name && (
                        <p className="mt-1 text-sm text-base-content/75">
                          {job.company_name}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="badge badge-ghost">
                          {workModeLabels[job.work_mode] ??
                            workModeLabels.unknown}
                        </span>
                        {job.employment_type && (
                          <span className="badge badge-ghost">
                            {job.employment_type}
                          </span>
                        )}
                        {job.location && (
                          <span className="badge badge-ghost">
                            {job.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {job.source_url && (
                      <a
                        href={job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary shrink-0 text-sm"
                      >
                        Ver oferta ↗
                      </a>
                    )}
                  </div>
                  {job.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-base-content/70">
                      {job.description}
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
