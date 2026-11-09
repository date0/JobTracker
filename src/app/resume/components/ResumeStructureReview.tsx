"use client";

import { useState } from "react";

type ResumeTextField = {
  original_text: string | null;
  normalized_text: string | null;
};

type ResumeResponsibility = {
  id: string;
  original_text: string;
  normalized_text: string | null;
};

type ResumeExperience = {
  id: string;
  company: string | null;
  position: string | null;
  start_date: string | null;
  end_date: string | null;
  employment_status: "current" | "ended" | "unknown";
  original_date_text: string | null;
  original_text: string | null;
  responsibilities: ResumeResponsibility[];
};

type ResumeSkill = {
  id: string;
  name: string;
  source_text: string;
};

type ResumeEducation = {
  id: string;
  original_text: string;
  degree: string | null;
  institution: string | null;
  graduation_year: string | null;
};

type ResumeCertification = {
  id: string;
  original_text: string;
  name: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  credential_id: string | null;
};

type ResumeStructure = {
  schema_version: 1;
  contact: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;
    linkedin: string | null;
    portfolio: string | null;
  };
  professional_title: ResumeTextField;
  professional_summary: ResumeTextField;
  experience: ResumeExperience[];
  technical_skills: ResumeSkill[];
  education: ResumeEducation[];
  certifications: ResumeCertification[];
};

type PreviewResponse = {
  success: boolean;
  source_hash?: string;
  structure?: ResumeStructure;
  warnings?: Array<{
    field: string;
    line: number;
    message: string;
    source_text: string;
  }>;
  unparsed?: Array<{
    field: string;
    line: number;
    source_text: string;
    reason: string;
  }>;
  previous_version_found?: boolean;
  error?: string;
  code?: string;
};

type ConfirmResponse = {
  success: boolean;
  already_confirmed?: boolean;
  version?: number;
  source_hash?: string;
  message?: string;
  error?: string;
  code?: string;
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-base-300 bg-base-100 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {count !== undefined && (
          <span className="badge badge-ghost">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Value({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <div>
      <p className="text-xs font-medium text-base-content/50">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</p>
    </div>
  );
}

export default function ResumeStructureReview() {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmResponse | null>(
    null,
  );

  async function generatePreview() {
    setLoading(true);
    setError("");
    setPreview(null);
    setConfirmation(null);

    try {
      const response = await fetch("/api/resume/structure/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as PreviewResponse;

      if (!response.ok || !data.success || !data.structure) {
        throw new Error(
          data.error || "No se pudo generar la vista previa.",
        );
      }

      setPreview(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar la vista previa.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmPreview() {
    if (!preview?.source_hash || confirming || confirmation) {
      return;
    }

    setConfirming(true);
    setError("");

    try {
      const response = await fetch("/api/resume/structure/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_hash: preview.source_hash,
        }),
      });

      const data = (await response.json()) as ConfirmResponse;

      if (!response.ok || !data.success) {
        if (response.status === 409 && data.code === "SOURCE_CHANGED") {
          setPreview(null);
          setConfirmation(null);
          throw new Error(
            "El CV maestro cambió desde que generaste la vista previa. Genera una nueva antes de confirmar.",
          );
        }

        throw new Error(
          data.error || "No se pudo confirmar la estructura del CV.",
        );
      }

      setConfirmation(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo confirmar la estructura del CV.",
      );
    } finally {
      setConfirming(false);
    }
  }

  const structure = preview?.structure;

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-6 p-6 sm:p-8">
        <div>
          <h2 className="text-xl font-bold">
            Estructura semántica del CV
          </h2>
          <p className="mt-2 text-sm text-base-content/60">
            Convierte tu CV maestro en información estructurada,
            conservando los textos originales y los identificadores
            de tus experiencias, responsabilidades y habilidades.
          </p>
        </div>

        <div className="rounded-xl border border-info/30 bg-info/5 p-4 text-sm">
          <p className="font-semibold">Vista previa sin guardar</p>
          <p className="mt-1 text-base-content/70">
            Generar la vista previa no modifica tu CV maestro ni
            guarda una nueva versión de su estructura.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={generatePreview}
              disabled={loading || confirming}
            >
              {loading ? "Analizando CV..." : "Generar vista previa"}
            </button>

            {preview?.source_hash && !confirmation && (
              <button
                type="button"
                className="btn btn-success"
                onClick={confirmPreview}
                disabled={loading || confirming}
              >
                {confirming
                  ? "Guardando estructura..."
                  : "Confirmar y guardar estructura"}
              </button>
            )}
          </div>
        </div>

        {loading && (
          <p role="status" className="text-sm text-base-content/60">
            Interpretando las secciones del CV...
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-error/10 p-3 text-sm text-error"
          >
            {error}
          </p>
        )}

        {confirmation?.success && (
          <div
            role="status"
            className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm"
          >
            <p className="font-semibold">
              {confirmation.already_confirmed
                ? "Esta estructura ya estaba confirmada."
                : "Estructura confirmada y guardada correctamente."}
            </p>
            {confirmation.version !== undefined && (
              <p className="mt-1">
                Versión guardada: {confirmation.version}
              </p>
            )}
          </div>
        )}

        {structure && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-success">
                Vista previa generada
              </span>
              <span className="badge badge-outline">
                Esquema v{structure.schema_version}
              </span>
              <span className="badge badge-outline">
                {preview?.previous_version_found
                  ? "Se encontró una estructura anterior"
                  : "Primera estructura"}
              </span>
            </div>

            <Section title="Datos de contacto">
              <div className="grid gap-4 sm:grid-cols-2">
                <Value label="Nombre" value={structure.contact.full_name} />
                <Value label="Teléfono" value={structure.contact.phone} />
                <Value label="Correo" value={structure.contact.email} />
                <Value label="Estado" value={structure.contact.state} />
                <Value label="País" value={structure.contact.country} />
                <Value
                  label="Código postal"
                  value={structure.contact.postal_code}
                />
                <Value label="LinkedIn" value={structure.contact.linkedin} />
                <Value label="Portafolio" value={structure.contact.portfolio} />
              </div>
            </Section>

            <Section title="Perfil profesional">
              <div className="space-y-4">
                <Value
                  label="Título original"
                  value={structure.professional_title.original_text}
                />
                <Value
                  label="Título normalizado"
                  value={structure.professional_title.normalized_text}
                />
                <Value
                  label="Resumen original"
                  value={structure.professional_summary.original_text}
                />
                <Value
                  label="Resumen normalizado"
                  value={structure.professional_summary.normalized_text}
                />
              </div>
            </Section>

            <Section
              title="Experiencia laboral"
              count={structure.experience.length}
            >
              {structure.experience.length === 0 ? (
                <p className="text-sm text-base-content/50">
                  No se identificaron experiencias laborales.
                </p>
              ) : (
                <div className="space-y-5">
                  {structure.experience.map((item, index) => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-base-300 p-4"
                    >
                      <h4 className="font-semibold">
                        {item.position || "Puesto sin identificar"}
                      </h4>
                      <p className="text-sm text-base-content/70">
                        {item.company || "Empresa sin identificar"}
                      </p>
                      <p className="mt-1 text-xs text-base-content/50">
                        {item.original_date_text || "Fechas no identificadas"}
                        {" · "}
                        {item.employment_status === "current"
                          ? "Actual"
                          : item.employment_status === "ended"
                            ? "Finalizado"
                            : "Estado desconocido"}
                      </p>

                      {item.original_text && (
                        <p className="mt-3 whitespace-pre-wrap text-sm">
                          {item.original_text}
                        </p>
                      )}

                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold text-base-content/60">
                          Responsabilidades ({item.responsibilities.length})
                        </p>

                        {item.responsibilities.length === 0 ? (
                          <p className="text-sm text-base-content/50">
                            No se identificaron responsabilidades.
                          </p>
                        ) : (
                          <ul className="list-disc space-y-2 pl-5">
                            {item.responsibilities.map((responsibility) => (
                              <li
                                key={responsibility.id}
                                className="text-sm"
                              >
                                <p className="whitespace-pre-wrap">
                                  {responsibility.original_text}
                                </p>
                                {responsibility.normalized_text && (
                                  <p className="mt-1 text-xs text-base-content/50">
                                    Normalizado: {responsibility.normalized_text}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Habilidades técnicas"
              count={structure.technical_skills.length}
            >
              {structure.technical_skills.length === 0 ? (
                <p className="text-sm text-base-content/50">
                  No se identificaron habilidades.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {structure.technical_skills.map((skill) => (
                    <span
                      key={skill.id}
                      className="badge badge-outline badge-lg"
                      title={`Texto original: ${skill.source_text}`}
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Formación académica"
              count={structure.education.length}
            >
              {structure.education.length === 0 ? (
                <p className="text-sm text-base-content/50">
                  No se identificó formación académica.
                </p>
              ) : (
                <div className="space-y-3">
                  {structure.education.map((item) => (
                    <article key={item.id} className="rounded-lg bg-base-200 p-3">
                      <p className="font-medium">{item.original_text}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <Value label="Título" value={item.degree} />
                        <Value label="Institución" value={item.institution} />
                        <Value label="Año" value={item.graduation_year} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Certificaciones"
              count={structure.certifications.length}
            >
              {structure.certifications.length === 0 ? (
                <p className="text-sm text-base-content/50">
                  No se identificaron certificaciones.
                </p>
              ) : (
                <div className="space-y-3">
                  {structure.certifications.map((item) => (
                    <article key={item.id} className="rounded-lg bg-base-200 p-3">
                      <p className="font-medium">{item.original_text}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <Value label="Nombre" value={item.name} />
                        <Value label="Emisor" value={item.issuer} />
                        <Value label="Fecha de emisión" value={item.issue_date} />
                        <Value
                          label="Fecha de expiración"
                          value={item.expiration_date}
                        />
                        <Value
                          label="ID de credencial"
                          value={item.credential_id}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Advertencias"
              count={preview?.warnings?.length ?? 0}
            >
              {preview?.warnings?.length ? (
                <div className="space-y-3">
                  {preview.warnings.map((warning, index) => (
                    <article
                      key={`${warning.field}-${warning.line}-${index}`}
                      className="rounded-lg bg-warning/10 p-3 text-sm"
                    >
                      <p className="font-semibold">
                        {warning.field} · Línea {warning.line}
                      </p>
                      <p className="mt-1">{warning.message}</p>
                      <p className="mt-2 whitespace-pre-wrap text-xs text-base-content/60">
                        {warning.source_text}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-base-content/50">
                  No se generaron advertencias.
                </p>
              )}
            </Section>

            <Section
              title="Elementos sin clasificar"
              count={preview?.unparsed?.length ?? 0}
            >
              {preview?.unparsed?.length ? (
                <div className="space-y-3">
                  {preview.unparsed.map((item, index) => (
                    <article
                      key={`${item.field}-${item.line}-${index}`}
                      className="rounded-lg border border-warning/30 p-3 text-sm"
                    >
                      <p className="font-semibold">
                        {item.field} · Línea {item.line}
                      </p>
                      <p className="mt-1">{item.reason}</p>
                      <p className="mt-2 whitespace-pre-wrap text-xs text-base-content/60">
                        {item.source_text}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-base-content/50">
                  No hay elementos pendientes de clasificación.
                </p>
              )}
            </Section>

            <p className="text-xs text-base-content/50">
              Hash del CV:{" "}
              <code className="break-all">{preview?.source_hash}</code>
            </p>

            {!confirmation && (
              <p className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm">
                Esta propuesta todavía no está confirmada ni guardada.
                Revisa los datos antes de continuar.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
