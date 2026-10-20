"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Job = {
  id: number | string;
  title: string;
  company_name: string | null;
  location: string | null;
  work_mode: "onsite" | "hybrid" | "remote" | "unknown";
  employment_type: string | null;
  source_url: string | null;
};

type Application = {
  id: number | string;
  job_id: number | string;
  status: ApplicationStatus;
  applied_at: string | null;
  personal_notes: string | null;
  job_title: string;
  company_name: string | null;
  location: string | null;
  work_mode: "onsite" | "hybrid" | "remote" | "unknown";
  source_url: string | null;
};

type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

type ApplicationEvent = {
  id: number | string;
  event_type:
    | "note"
    | "follow_up"
    | "interview"
    | "status_change"
    | "reminder"
    | "other";
  title: string;
  details: string | null;
  event_at: string | null;
  created_at: string;
};

const statusLabels: Record<ApplicationStatus, string> = {
  saved: "Guardada",
  applied: "Postulado",
  interviewing: "En entrevista",
  offer: "Oferta recibida",
  rejected: "Rechazada",
  withdrawn: "Retirada",
};

const workModeLabels: Record<Job["work_mode"], string> = {
  onsite: "Presencial",
  hybrid: "Híbrido",
  remote: "Remoto",
  unknown: "No especificado",
};

const statusOptions: ApplicationStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

export default function ApplicationsManager() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [eventsByApplication, setEventsByApplication] = useState<
    Record<string, ApplicationEvent[]>
  >({});
  const [expandedHistory, setExpandedHistory] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>("saved");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [eventType, setEventType] = useState<
    "note" | "follow_up" | "interview" | "reminder" | "other"
  >("note");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [savingEventFor, setSavingEventFor] = useState<string | null>(null);
  const loadData = useCallback(async () => {
    try {
      const [applicationsResponse, jobsResponse] = await Promise.all([
        fetch("/api/applications"),
        fetch("/api/applications/available-jobs"),
      ]);

      const applicationsData = await applicationsResponse.json();
      const jobsData = await jobsResponse.json();

      if (!applicationsResponse.ok || !applicationsData.success) {
        throw new Error(
          applicationsData.error || "No se pudieron cargar las candidaturas.",
        );
      }

      if (!jobsResponse.ok || !jobsData.success) {
        throw new Error(
          jobsData.error || "No se pudieron cargar las vacantes disponibles.",
        );
      }

      setError("");
      setApplications(applicationsData.applications ?? []);
      setJobs(jobsData.jobs ?? []);
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
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          status,
          personal_notes: notes,
        }),
      });

      const data: { success: boolean; error?: string } = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo registrar la candidatura.");
      }

      setJobId("");
      setStatus("saved");
      setNotes("");
      setMessage("Candidatura registrada correctamente.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar la candidatura.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(
    applicationId: number | string,
    newStatus: ApplicationStatus,
  ) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data: { success: boolean; error?: string } = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo actualizar el estado.");
      }

      setApplications((current) =>
        current.map((application) =>
          String(application.id) === String(applicationId)
            ? { ...application, status: newStatus }
            : application,
        ),
      );

      setMessage("Estado de la candidatura actualizado correctamente.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al actualizar el estado.",
      );
    }
  }

  async function toggleApplicationHistory(applicationId: number | string) {
    const id = String(applicationId);

    if (expandedHistory.includes(id)) {
      setExpandedHistory((current) => current.filter((item) => item !== id));
      return;
    }

    setExpandedHistory((current) =>
      current.includes(id) ? current : [...current, id],
    );

    if (eventsByApplication[id]) {
      return;
    }

    try {
      const response = await fetch(`/api/applications/${applicationId}/events`);

      const data: {
        success: boolean;
        error?: string;
        events?: ApplicationEvent[];
      } = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo cargar el historial.");
      }

      setEventsByApplication((current) => ({
        ...current,
        [id]: data.events ?? [],
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al consultar el historial.",
      );

      setExpandedHistory((current) => current.filter((item) => item !== id));
    }
  }

  async function handleEventSubmit(
    event: FormEvent<HTMLFormElement>,
    applicationId: number | string,
  ) {
    event.preventDefault();

    const id = String(applicationId);
    setSavingEventFor(id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/applications/${applicationId}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: eventType,
            title: eventTitle,
            details: eventDetails,
            event_at: eventDate || null,
          }),
        },
      );

      const data: {
        success: boolean;
        error?: string;
      } = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el evento.");
      }

      const historyResponse = await fetch(
        `/api/applications/${applicationId}/events`,
      );

      const historyData: {
        success: boolean;
        error?: string;
        events?: ApplicationEvent[];
      } = await historyResponse.json();

      if (!historyResponse.ok || !historyData.success) {
        throw new Error(
          historyData.error ||
            "El evento se guardó, pero no se pudo actualizar el historial.",
        );
      }

      setEventsByApplication((current) => ({
        ...current,
        [id]: historyData.events ?? [],
      }));

      setEventType("note");
      setEventTitle("");
      setEventDetails("");
      setEventDate("");
      setMessage("Evento registrado correctamente.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar el evento.",
      );
    } finally {
      setSavingEventFor(null);
    }
  }
  const filteredApplications = applications.filter((application) => {
    const term = search.trim().toLowerCase();

    if (!term) return true;

    return [
      application.job_title,
      application.company_name ?? "",
      application.location ?? "",
      application.personal_notes ?? "",
      statusLabels[application.status],
    ].some((value) => value.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-6">
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Registrar candidatura</h2>
          <p className="text-sm text-base-content/60">
            Selecciona una vacante guardada y comienza a dar seguimiento a tu
            postulación.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="application-job" className="label">
                <span className="label-text font-medium">Vacante *</span>
              </label>
              <select
                id="application-job"
                className="select select-bordered w-full"
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                required
              >
                <option value="">Selecciona una vacante</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                    {job.company_name ? ` — ${job.company_name}` : ""}
                  </option>
                ))}
              </select>

              {jobs.length === 0 && (
                <p className="mt-1 text-xs text-base-content/60">
                  No hay vacantes disponibles para agregar. Registra una vacante
                  desde el apartado Vacantes o verifica si ya está en tus
                  candidaturas.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="application-status" className="label">
                <span className="label-text font-medium">Estado inicial</span>
              </label>
              <select
                id="application-status"
                className="select select-bordered w-full"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ApplicationStatus)
                }
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {statusLabels[option]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="application-notes" className="label">
                <span className="label-text font-medium">Notas personales</span>
              </label>
              <textarea
                id="application-notes"
                className="textarea textarea-bordered min-h-28 w-full"
                placeholder="Ej. Contacto de RH, fecha de postulación o puntos por preparar..."
                maxLength={65535}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
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

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || jobs.length === 0}
            >
              {saving ? "Guardando..." : "Registrar candidatura"}
            </button>
          </form>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Mis candidaturas</h2>
              <p className="mt-1 text-sm text-base-content/60">
                {filteredApplications.length} de {applications.length}{" "}
                {applications.length === 1 ? "candidatura" : "candidaturas"}
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
            placeholder="Buscar por vacante, empresa, estado o notas..."
            aria-label="Buscar candidaturas"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {loading ? (
            <p className="py-8 text-center text-sm text-base-content/60">
              Cargando candidaturas...
            </p>
          ) : filteredApplications.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-base-300 px-5 py-10 text-center">
              <div className="mb-3 text-3xl">↗</div>
              <h3 className="font-semibold">
                {applications.length === 0
                  ? "Aún no tienes candidaturas"
                  : "No se encontraron coincidencias"}
              </h3>
              <p className="mt-2 text-sm text-base-content/60">
                {applications.length === 0
                  ? "Selecciona una vacante en el formulario para registrar tu primera candidatura."
                  : "Prueba con otro término de búsqueda."}
              </p>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-base-300">
              {filteredApplications.map((application) => (
                <li key={application.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{application.job_title}</h3>

                      {application.company_name && (
                        <p className="mt-1 text-sm text-base-content/75">
                          {application.company_name}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={`status-${application.id}`}
                          className="text-sm font-medium"
                        >
                          Estado:
                        </label>

                        <select
                          id={`status-${application.id}`}
                          className="select select-bordered select-sm"
                          value={application.status}
                          onChange={(event) =>
                            void handleStatusChange(
                              application.id,
                              event.target.value as ApplicationStatus,
                            )
                          }
                          aria-label={`Cambiar estado de ${application.job_title}`}
                        >
                          {statusOptions.map((option) => (
                            <option key={option} value={option}>
                              {statusLabels[option]}
                            </option>
                          ))}
                        </select>
                        <span className="badge badge-ghost">
                          {workModeLabels[application.work_mode] ??
                            workModeLabels.unknown}
                        </span>

                        {application.location && (
                          <span className="badge badge-ghost">
                            {application.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {application.source_url && (
                      <a
                        href={application.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary shrink-0 text-sm"
                      >
                        Ver oferta ↗
                      </a>
                    )}
                  </div>

                  {application.personal_notes && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-base-content/70">
                      {application.personal_notes}
                    </p>
                  )}
                  <div className="mt-4">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        void toggleApplicationHistory(application.id)
                      }
                      aria-expanded={expandedHistory.includes(
                        String(application.id),
                      )}
                    >
                      {expandedHistory.includes(String(application.id))
                        ? "Ocultar historial"
                        : "Ver historial"}
                    </button>
                  </div>
                  {expandedHistory.includes(String(application.id)) && (
                    <div className="mt-4 rounded-xl border border-base-300 bg-base-200/50 p-4">
                      <h4 className="font-semibold">
                        Historial de seguimiento
                      </h4>
                      <form
                        onSubmit={(event) =>
                          void handleEventSubmit(event, application.id)
                        }
                        className="mt-4 space-y-3 rounded-lg border border-base-300 bg-base-100 p-4"
                      >
                        <h5 className="font-medium">Agregar evento</h5>

                        <div>
                          <label
                            className="label"
                            htmlFor={`event-type-${application.id}`}
                          >
                            <span className="label-text">Tipo de evento</span>
                          </label>
                          <select
                            id={`event-type-${application.id}`}
                            className="select select-bordered w-full"
                            value={eventType}
                            onChange={(event) =>
                              setEventType(
                                event.target.value as
                                  | "note"
                                  | "follow_up"
                                  | "interview"
                                  | "reminder"
                                  | "other",
                              )
                            }
                          >
                            <option value="note">Nota</option>
                            <option value="follow_up">Seguimiento</option>
                            <option value="interview">Entrevista</option>
                            <option value="reminder">Recordatorio</option>
                            <option value="other">Otro</option>
                          </select>
                        </div>

                        <div>
                          <label
                            className="label"
                            htmlFor={`event-title-${application.id}`}
                          >
                            <span className="label-text">Título *</span>
                          </label>
                          <input
                            id={`event-title-${application.id}`}
                            className="input input-bordered w-full"
                            placeholder="Ej. Contactar al reclutador"
                            maxLength={200}
                            value={eventTitle}
                            onChange={(event) =>
                              setEventTitle(event.target.value)
                            }
                            required
                          />
                        </div>

                        <div>
                          <label
                            className="label"
                            htmlFor={`event-details-${application.id}`}
                          >
                            <span className="label-text">Detalles</span>
                          </label>
                          <textarea
                            id={`event-details-${application.id}`}
                            className="textarea textarea-bordered w-full"
                            placeholder="Agrega notas o información adicional..."
                            value={eventDetails}
                            onChange={(event) =>
                              setEventDetails(event.target.value)
                            }
                          />
                        </div>

                        <div>
                          <label
                            className="label"
                            htmlFor={`event-date-${application.id}`}
                          >
                            <span className="label-text">
                              Fecha y hora (opcional)
                            </span>
                          </label>
                          <input
                            id={`event-date-${application.id}`}
                            type="datetime-local"
                            className="input input-bordered w-full"
                            value={eventDate}
                            min="2000-01-01T00:00"
                            max="2100-12-31T23:59"
                            onChange={(event) =>
                              setEventDate(event.target.value)
                            }
                          />
                          <p className="mt-1 text-xs text-base-content/60">
                            Para recordatorios, indica cuándo debes realizar el
                            seguimiento.
                          </p>
                        </div>

                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={savingEventFor === String(application.id)}
                        >
                          {savingEventFor === String(application.id)
                            ? "Guardando..."
                            : "Guardar evento"}
                        </button>
                      </form>

                      {!eventsByApplication[String(application.id)] ? (
                        <p className="mt-2 text-sm text-base-content/60">
                          Cargando historial...
                        </p>
                      ) : eventsByApplication[String(application.id)].length ===
                        0 ? (
                        <p className="mt-2 text-sm text-base-content/60">
                          Aún no hay eventos registrados para esta candidatura.
                        </p>
                      ) : (
                        <ol className="mt-3 space-y-3">
                          {eventsByApplication[String(application.id)].map(
                            (event) => (
                              <li
                                key={event.id}
                                className="border-l-2 border-primary/40 pl-3"
                              >
                                <p className="font-medium">{event.title}</p>

                                {event.details && (
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-base-content/70">
                                    {event.details}
                                  </p>
                                )}

                                <p className="mt-1 text-xs text-base-content/55">
                                  {event.event_at
                                    ? new Date(
                                        event.event_at.replace(" ", "T") +
                                          (event.event_at.endsWith("Z")
                                            ? ""
                                            : ""),
                                      ).toLocaleString("es-MX")
                                    : new Date(event.created_at).toLocaleString(
                                        "es-MX",
                                      )}
                                </p>
                              </li>
                            ),
                          )}
                        </ol>
                      )}
                    </div>
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
