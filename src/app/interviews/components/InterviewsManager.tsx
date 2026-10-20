"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type ApplicationOption = {
  id: number;
  job_title: string;
  company_name: string | null;
};

type Interview = {
  id: number;
  application_id: number;
  scheduled_at: string;
  duration_minutes: number | null;
  interview_type: "virtual" | "onsite" | "phone";
  meeting_url: string | null;
  location: string | null;
  interviewer_name: string | null;
  interviewer_contact: string | null;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  result:
  | "pending"
  | "awaiting_response"
  | "next_round"
  | "offer_received"
  | "rejected"
  | "withdrawn";
  preparation_notes: string | null;
  questions_to_ask: string | null;
  post_interview_notes: string | null;
  job_title: string;
  company_name: string | null;
};

const typeLabels = {
  virtual: "Virtual",
  onsite: "Presencial",
  phone: "Telefónica",
};

const statusLabels = {
  scheduled: "Programada",
  completed: "Completada",
  cancelled: "Cancelada",
  rescheduled: "Reprogramar",
};

const resultLabels = {
  pending: "Pendiente de resultado",
  awaiting_response: "Esperando respuesta",
  next_round: "Avanza a siguiente ronda",
  offer_received: "Oferta recibida",
  rejected: "No seleccionado",
  withdrawn: "Proceso abandonado",
};

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function InterviewsManager() {
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingInterviewId, setEditingInterviewId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<
    "scheduled" | "completed" | "cancelled" | "rescheduled"
  >("scheduled");
  const [interviewResult, setInterviewResult] = useState<
  "pending"
  | "awaiting_response"
  | "next_round"
  | "offer_received"
  | "rejected"
  | "withdrawn"
>("pending");

  const [applicationId, setApplicationId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("60");
  const [interviewType, setInterviewType] = useState<
    "virtual" | "onsite" | "phone"
  >("virtual");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerContact, setInterviewerContact] = useState("");
  const [preparationNotes, setPreparationNotes] = useState("");
  const [questionsToAsk, setQuestionsToAsk] = useState("");
  const [postInterviewNotes, setPostInterviewNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [applicationsResponse, interviewsResponse] = await Promise.all([
        fetch("/api/applications"),
        fetch("/api/interviews"),
      ]);

      const applicationsData = await applicationsResponse.json();
      const interviewsData = await interviewsResponse.json();

      if (!applicationsResponse.ok) {
        throw new Error(
          applicationsData.error ?? "No se pudieron cargar las candidaturas",
        );
      }

      if (!interviewsResponse.ok) {
        throw new Error(
          interviewsData.error ?? "No se pudieron cargar las entrevistas",
        );
      }

      setApplications(applicationsData.applications ?? []);
      setInterviews(interviewsData.interviews ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleEdit(interview: Interview) {
    setEditingInterviewId(interview.id);
    setEditingStatus(interview.status);
    setInterviewResult(interview.result);
    setApplicationId(String(interview.application_id));

    const rawDate = interview.scheduled_at;
    const hasTimezone =
      rawDate.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(rawDate);

    let normalizedDate: string;

    if (hasTimezone) {
      const date = new Date(rawDate);

      const pad = (value: number) => String(value).padStart(2, "0");

      normalizedDate =
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } else {
      normalizedDate = rawDate.replace(" ", "T").slice(0, 16);
    }

    setScheduledAt(normalizedDate);

    setDuration(
      interview.duration_minutes == null
        ? ""
        : String(interview.duration_minutes),
    );
    setInterviewType(interview.interview_type);
    setMeetingUrl(interview.meeting_url ?? "");
    setLocation(interview.location ?? "");
    setInterviewerName(interview.interviewer_name ?? "");
    setInterviewerContact(interview.interviewer_contact ?? "");
    setPreparationNotes(interview.preparation_notes ?? "");
    setQuestionsToAsk(interview.questions_to_ask ?? "");
    setPostInterviewNotes(interview.post_interview_notes ?? "");
    setError("");
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingInterviewId(null);
    setEditingStatus("scheduled");
    setInterviewResult("pending");
    setApplicationId("");
    setScheduledAt("");
    setDuration("60");
    setInterviewType("virtual");
    setMeetingUrl("");
    setLocation("");
    setInterviewerName("");
    setInterviewerContact("");
    setPreparationNotes("");
    setQuestionsToAsk("");
    setPostInterviewNotes("");
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        editingInterviewId === null
          ? "/api/interviews"
          : `/api/interviews/${editingInterviewId}`,
        {
          method: editingInterviewId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application_id: applicationId,
            scheduled_at: scheduledAt,
            duration_minutes: duration,
            interview_type: interviewType,
            meeting_url: meetingUrl,
            location,
            interviewer_name: interviewerName,
            interviewer_contact: interviewerContact,
            preparation_notes: preparationNotes,
            questions_to_ask: questionsToAsk,
            post_interview_notes: postInterviewNotes,
            status: editingStatus,
            result: interviewResult,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo registrar la entrevista");
      }

      const wasEditing = editingInterviewId !== null;

      handleCancelEdit();
      setMessage(
        wasEditing
          ? "Entrevista actualizada correctamente."
          : "Entrevista registrada correctamente.",
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-xl">
            {editingInterviewId === null ? "Agendar entrevista" : "Editar entrevista"}
          </h2>
          <p className="text-sm text-base-content/60">
            Relaciona la entrevista con una de tus candidaturas.
          </p>

          {applications.length === 0 && !loading && (
            <div className="alert mt-3">
              Primero registra una candidatura para poder agendar una entrevista.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-control w-full">
                <span className="label-text mb-2">Candidatura *</span>
                <select
                  className="select select-bordered w-full"
                  value={applicationId}
                  onChange={(event) => setApplicationId(event.target.value)}
                  required
                  disabled={loading || applications.length === 0}
                >
                  <option value="">Selecciona una candidatura</option>
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>
                      {application.job_title} — {application.company_name ?? "Empresa sin nombre"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control w-full">
                <span className="label-text mb-2">Fecha y hora *</span>
                <input
                  type="datetime-local"
                  className="input input-bordered w-full"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  min="2000-01-01T00:00"
                  max="2100-12-31T23:59"
                  required
                />
              </label>

              <label className="form-control w-full">
                <span className="label-text mb-2">Duración (minutos)</span>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  min="1"
                  max="1440"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </label>

              <label className="form-control w-full">
                <span className="label-text mb-2">Modalidad *</span>
                <select
                  className="select select-bordered w-full"
                  value={interviewType}
                  onChange={(event) =>
                    setInterviewType(
                      event.target.value as "virtual" | "onsite" | "phone",
                    )
                  }
                >
                  <option value="virtual">Virtual</option>
                  <option value="onsite">Presencial</option>
                  <option value="phone">Telefónica</option>
                </select>
              </label>

              {editingInterviewId !== null && (
                <label className="form-control w-full">
                  <span className="label-text mb-2">Estado de la entrevista *</span>
                  <select
                    className="select select-bordered w-full"
                    value={editingStatus}
                    onChange={(event) =>
                      setEditingStatus(
                        event.target.value as
                          | "scheduled"
                          | "completed"
                          | "cancelled"
                          | "rescheduled",
                      )
                    }
                  >
                    <option value="scheduled">Programada</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelada</option>
                    <option value="rescheduled">Reprogramada</option>
                  </select>
                </label>
              )}

              {editingInterviewId !== null && (
                <label className="form-control w-full">
                  <span className="label-text mb-2">Resultado del proceso</span>
                  <select
                    className="select select-bordered w-full"
                    value={interviewResult}
                    onChange={(event) =>
                      setInterviewResult(
                        event.target.value as
                          | "pending"
                          | "awaiting_response"
                          | "next_round"
                          | "offer_received"
                          | "rejected"
                          | "withdrawn",
                      )
                    }
                  >
                    <option value="pending">Pendiente de resultado</option>
                    <option value="awaiting_response">Esperando respuesta</option>
                    <option value="next_round">Avanza a siguiente ronda</option>
                    <option value="offer_received">Oferta recibida</option>
                    <option value="rejected">No seleccionado</option>
                    <option value="withdrawn">Proceso abandonado</option>
                  </select>
                </label>
              )}

              {interviewType === "virtual" && (
                <label className="form-control w-full md:col-span-2">
                  <span className="label-text mb-2">Enlace de videollamada</span>
                  <input
                    type="url"
                    className="input input-bordered w-full"
                    placeholder="https://..."
                    value={meetingUrl}
                    onChange={(event) => setMeetingUrl(event.target.value)}
                  />
                </label>
              )}

              {interviewType === "onsite" && (
                <label className="form-control w-full md:col-span-2">
                  <span className="label-text mb-2">Ubicación</span>
                  <input
                    className="input input-bordered w-full"
                    placeholder="Dirección de la entrevista"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                  />
                </label>
              )}

              <label className="form-control w-full">
                <span className="label-text mb-2">Entrevistador</span>
                <input
                  className="input input-bordered w-full"
                  value={interviewerName}
                  onChange={(event) => setInterviewerName(event.target.value)}
                  maxLength={200}
                  placeholder="Nombre del contacto"
                />
              </label>

              <label className="form-control w-full">
                <span className="label-text mb-2">Contacto</span>
                <input
                  className="input input-bordered w-full"
                  value={interviewerContact}
                  onChange={(event) =>
                    setInterviewerContact(event.target.value)
                  }
                  maxLength={320}
                  placeholder="Correo o teléfono"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="form-control">
                <span className="label-text mb-2">Preparación</span>
                <textarea
                  className="textarea textarea-bordered min-h-32"
                  value={preparationNotes}
                  onChange={(event) => setPreparationNotes(event.target.value)}
                  placeholder="Temas técnicos, logros que destacar..."
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">Preguntas para hacer</span>
                <textarea
                  className="textarea textarea-bordered min-h-32"
                  value={questionsToAsk}
                  onChange={(event) => setQuestionsToAsk(event.target.value)}
                  placeholder="Preguntas para el entrevistador..."
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">Notas posteriores</span>
                <textarea
                  className="textarea textarea-bordered min-h-32"
                  value={postInterviewNotes}
                  onChange={(event) =>
                    setPostInterviewNotes(event.target.value)
                  }
                  placeholder="Comentarios después de la entrevista..."
                />
              </label>
            </div>

            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}

            {message && (
              <p role="status" className="text-sm text-success">
                {message}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || loading || applications.length === 0}
              >
                {saving
                  ? "Guardando..."
                  : editingInterviewId === null
                    ? "Registrar entrevista"
                    : "Guardar cambios"}
              </button>
              {editingInterviewId !== null && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Agenda de entrevistas</h2>
          <p className="mt-1 text-sm text-base-content/60">
            Consulta las entrevistas asociadas a tus candidaturas.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : interviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-base-300 bg-base-100 p-8 text-center">
            <h3 className="font-semibold">Todavía no hay entrevistas</h3>
            <p className="mt-2 text-sm text-base-content/60">
              Registra tu primera entrevista utilizando el formulario.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {interviews.map((interview) => (
              <article
                key={interview.id}
                className="card border border-base-300 bg-base-100 shadow-sm"
              >
                <div className="card-body gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="card-title text-lg">
                        {interview.job_title}
                      </h3>
                      <p className="text-sm text-base-content/60">
                        {interview.company_name ?? "Empresa sin nombre"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-outline">
                        {statusLabels[interview.status]}
                      </span>
                      <span className="badge badge-secondary badge-outline">
                        {resultLabels[interview.result]}
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleEdit(interview)}
                      >
                        Editar
                      </button>
                    </div>
                  </div>

                  <p className="font-medium">{formatDate(interview.scheduled_at)}</p>

                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-primary badge-outline">
                      {typeLabels[interview.interview_type]}
                    </span>
                    {interview.duration_minutes && (
                      <span className="badge badge-ghost">
                        {interview.duration_minutes} minutos
                      </span>
                    )}
                  </div>

                  {interview.interviewer_name && (
                    <p className="text-sm">
                      <span className="font-medium">Entrevistador:</span>{" "}
                      {interview.interviewer_name}
                    </p>
                  )}

                  {interview.interviewer_contact && (
                    <p className="text-sm">
                      <span className="font-medium">Contacto:</span>{" "}
                      {interview.interviewer_contact}
                    </p>
                  )}

                  {interview.meeting_url && (
                    <a
                      href={interview.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary break-all"
                    >
                      Abrir enlace de videollamada
                    </a>
                  )}

                  {interview.location && (
                    <p className="text-sm">
                      <span className="font-medium">Ubicación:</span>{" "}
                      {interview.location}
                    </p>
                  )}

                  {interview.preparation_notes && (
                    <div>
                      <h4 className="text-sm font-semibold">Preparación</h4>
                      <p className="whitespace-pre-wrap text-sm text-base-content/75">
                        {interview.preparation_notes}
                      </p>
                    </div>
                  )}

                  {interview.questions_to_ask && (
                    <div>
                      <h4 className="text-sm font-semibold">
                        Preguntas para hacer
                      </h4>
                      <p className="whitespace-pre-wrap text-sm text-base-content/75">
                        {interview.questions_to_ask}
                      </p>
                    </div>
                  )}

                  {interview.post_interview_notes && (
                    <div>
                      <h4 className="text-sm font-semibold">Notas posteriores</h4>
                      <p className="whitespace-pre-wrap text-sm text-base-content/75">
                        {interview.post_interview_notes}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
