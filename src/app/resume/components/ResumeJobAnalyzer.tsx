"use client";

import { useCallback, useEffect, useState } from "react";

type Job = {
  id: number | string;
  title: string;
  company_name?: string | null;
};

type ItemComparison = {
  matched: string[];
  missing: string[];
};

type CategoryKey =
  | "technologies"
  | "experience"
  | "certifications"
  | "responsibilities";

type Analysis = {
  jobId: number;
  jobTitle: string;
  score: number;
  totalKeywords: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  categories: Record<CategoryKey, ItemComparison>;
  notice: string;
};

type Requirement = {
  key: string;
  text: string;
  category: string;
  source: "Encontrado en el CV" | "Pendiente de revisión";
};

type SavedAdaptation = {
  id: string | number;
  jobId: string | number;
  jobTitle: string;
  confirmedRequirements: string[];
  draftContent: string;
  createdAt: string;
  updatedAt: string;
};

const categoryDefinitions: {
  key: CategoryKey;
  title: string;
  description: string;
}[] = [
  {
    key: "technologies",
    title: "Tecnologías y herramientas",
    description: "Tecnologías detectadas en la descripción de la vacante.",
  },
  {
    key: "experience",
    title: "Experiencia y nivel",
    description: "Frases relacionadas con años, seniority y experiencia requerida.",
  },
  {
    key: "responsibilities",
    title: "Responsabilidades",
    description: "Funciones y actividades detectadas en la vacante.",
  },
  {
    key: "certifications",
    title: "Certificaciones y credenciales",
    description: "Certificaciones o credenciales mencionadas en la descripción.",
  },
];

function getRequirements(analysis: Analysis): Requirement[] {
  const requirements: Requirement[] = [];
  const seen = new Set<string>();

  for (const category of categoryDefinitions) {
    const comparison = analysis.categories[category.key];

    for (const item of comparison.matched) {
      const normalized = item.trim().toLocaleLowerCase();

      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        requirements.push({
          key: normalized,
          text: item,
          category: category.title,
          source: "Encontrado en el CV",
        });
      }
    }

    for (const item of comparison.missing) {
      const normalized = item.trim().toLocaleLowerCase();

      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        requirements.push({
          key: normalized,
          text: item,
          category: category.title,
          source: "Pendiente de revisión",
        });
      }
    }
  }

  for (const keyword of analysis.matchedKeywords) {
    const normalized = keyword.trim().toLocaleLowerCase();

    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      requirements.push({
        key: normalized,
        text: keyword,
        category: "Palabras clave",
        source: "Encontrado en el CV",
      });
    }
  }

  for (const keyword of analysis.missingKeywords) {
    const normalized = keyword.trim().toLocaleLowerCase();

    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      requirements.push({
        key: normalized,
        text: keyword,
        category: "Palabras clave",
        source: "Pendiente de revisión",
      });
    }
  }

  return requirements;
}

export default function ResumeJobAnalyzer() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedRequirements, setSelectedRequirements] = useState<
    Record<string, boolean>
  >({});
  const [draftContent, setDraftContent] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adaptations, setAdaptations] = useState<SavedAdaptation[]>([]);
  const [loadingAdaptations, setLoadingAdaptations] = useState(false);
  const [savingAdaptation, setSavingAdaptation] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "docx" | null>(null);
  const [openedAdaptation, setOpenedAdaptation] =
    useState<SavedAdaptation | null>(null);

  const loadAdaptations = useCallback(async () => {
    setLoadingAdaptations(true);
    try {
      const response = await fetch("/api/resume/adaptations");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "No se pudo cargar el historial de borradores.",
        );
      }

      setAdaptations(data.adaptations ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el historial de borradores.",
      );
    } finally {
      setLoadingAdaptations(false);
    }
  }, []);

  async function saveOpenedAdaptation() {
    if (!openedAdaptation || savingAdaptation) {
      return;
    }

    setSavingAdaptation(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/resume/adaptations", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: openedAdaptation.id,
          draftContent: openedAdaptation.draftContent,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el borrador.");
      }

      const updatedAt =
        data.updatedAt != null
          ? new Date(data.updatedAt).toISOString()
          : new Date().toISOString();

      setOpenedAdaptation((current) =>
        current
          ? { ...current, updatedAt }
          : current,
      );

      await loadAdaptations();
      setSuccess("Borrador guardado correctamente.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el borrador.",
      );
    } finally {
      setSavingAdaptation(false);
    }
  }


  async function exportOpenedAdaptation(format: "pdf" | "docx") {
    if (!openedAdaptation || exportingFormat !== null) {
      return;
    }

    setExportingFormat(format);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/resume/adaptations/${encodeURIComponent(
          String(openedAdaptation.id),
        )}/export?format=${format}`,
      );

      if (!response.ok) {
        let message = "No se pudo generar el documento.";

        try {
          const data = await response.json();
          if (typeof data.error === "string") {
            message = data.error;
          }
        } catch {
          // La respuesta puede no contener JSON.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error("El documento generado está vacío.");
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTitle =
        openedAdaptation.jobTitle
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80) || "CV-adaptado";

      link.href = objectUrl;
      link.download = `${safeTitle}.${format}`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      setSuccess(
        `Documento ${format.toUpperCase()} generado correctamente.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar el documento.",
      );
    } finally {
      setExportingFormat(null);
    }
  }

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/resume/jobs");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudieron cargar las vacantes.");
      }

      setJobs(data.jobs ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las vacantes.",
      );
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial del historial guardado.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Carga inicial.
    void loadAdaptations();
  }, [loadAdaptations]);

  useEffect(() => {
    // Carga inicial de las vacantes disponibles.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Carga inicial.
    void loadJobs();
  }, [loadJobs]);

  async function analyzeResume() {
    if (!selectedJobId) {
      setError("Selecciona una vacante.");
      return;
    }

    setAnalyzing(true);
    setError("");
    setSuccess("");
    setAnalysis(null);
    setSelectedRequirements({});
    setDraftContent("");

    try {
      const response = await fetch("/api/resume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo analizar el CV.");
      }

      setAnalysis(data.analysis);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo analizar el CV.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleRequirement(key: string, checked: boolean) {
    setSelectedRequirements((current) => ({
      ...current,
      [key]: checked,
    }));
    setDraftContent("");
    setSuccess("");
  }

  async function createDraft() {
    if (!analysis) {
      setError("Primero analiza una vacante.");
      return;
    }

    const confirmedRequirements = getRequirements(analysis)
      .filter((requirement) => selectedRequirements[requirement.key])
      .map((requirement) => requirement.text);

    if (confirmedRequirements.length === 0) {
      setError(
        "Selecciona al menos un requisito que puedas respaldar con tu experiencia.",
      );
      return;
    }

    setCreatingDraft(true);
    setError("");
    setSuccess("");
    setDraftContent("");

    try {
      const response = await fetch("/api/resume/adaptations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: analysis.jobId,
          confirmedRequirements,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo crear el borrador.");
      }

      setDraftContent(data.adaptation?.draftContent ?? data.draftContent ?? "");
      setOpenedAdaptation(null);
      await loadAdaptations();
      setSuccess(
        "Borrador creado y guardado. Tu CV maestro permanece sin cambios.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el borrador.",
      );
    } finally {
      setCreatingDraft(false);
    }
  }

  const requirements = analysis ? getRequirements(analysis) : [];
  const selectedCount = requirements.filter(
    (requirement) => selectedRequirements[requirement.key],
  ).length;

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-5 p-6 sm:p-8">
        <div>
          <h2 className="text-xl font-bold">
            Analizar CV contra una vacante
          </h2>
          <p className="mt-1 text-sm text-base-content/60">
            Compara tu CV maestro con una vacante y confirma manualmente qué
            requisitos puedes respaldar con tu experiencia.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            className="select select-bordered w-full"
            value={selectedJobId}
            onChange={(event) => {
              setSelectedJobId(event.target.value);
              setAnalysis(null);
              setSelectedRequirements({});
              setDraftContent("");
              setError("");
              setSuccess("");
            }}
            disabled={loadingJobs || jobs.length === 0 || analyzing || creatingDraft}
          >
            <option value="">
              {loadingJobs
                ? "Cargando vacantes..."
                : jobs.length === 0
                  ? "No hay vacantes guardadas"
                  : "Selecciona una vacante"}
            </option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.company_name ? ` — ${job.company_name}` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-primary sm:shrink-0"
            onClick={analyzeResume}
            disabled={!selectedJobId || analyzing || loadingJobs || creatingDraft}
          >
            {analyzing ? "Analizando..." : "Analizar coincidencias"}
          </button>
        </div>

        {!loadingJobs && jobs.length === 0 && (
          <p className="text-sm text-base-content/65">
            Primero guarda una vacante en la sección Vacantes.
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

        {success && (
          <p
            role="status"
            className="rounded-lg bg-success/10 p-3 text-sm text-success"
          >
            {success}
          </p>
        )}

        <section className="space-y-3 rounded-xl border border-base-300 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Mis borradores guardados</h3>
              <p className="text-sm text-base-content/65">
                Consulta adaptaciones anteriores sin modificar tu CV maestro.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void loadAdaptations()}
              disabled={loadingAdaptations}
            >
              {loadingAdaptations ? "Actualizando..." : "Actualizar historial"}
            </button>
          </div>

          {loadingAdaptations && adaptations.length === 0 ? (
            <p className="text-sm text-base-content/60">
              Cargando borradores...
            </p>
          ) : adaptations.length === 0 ? (
            <p className="text-sm text-base-content/60">
              Todavía no tienes borradores guardados.
            </p>
          ) : (
            <ul className="space-y-2">
              {adaptations.map((adaptation) => (
                <li
                  key={adaptation.id}
                  className="flex flex-col gap-2 rounded-lg border border-base-300 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {adaptation.jobTitle}
                    </p>
                    <p className="text-xs text-base-content/60">
                      Actualizado:{" "}
                      {adaptation.updatedAt
                        ? new Date(adaptation.updatedAt).toLocaleString()
                        : "Fecha no disponible"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm shrink-0"
                    onClick={() => {
                      setOpenedAdaptation(adaptation);
                      setError("");
                      setSuccess("");
                    }}
                  >
                    Abrir borrador
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {openedAdaptation && (
          <section className="space-y-3 rounded-xl border border-success/30 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {openedAdaptation.jobTitle}
                </h3>
                <p className="text-sm text-base-content/65">
                  Puedes editar el texto y guardar los cambios. El CV maestro
                  permanece sin modificaciones.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOpenedAdaptation(null)}
              >
                Cerrar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => void exportOpenedAdaptation("pdf")}
                disabled={
                  exportingFormat !== null ||
                  !openedAdaptation.draftContent.trim()
                }
              >
                {exportingFormat === "pdf" ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                Descargar PDF
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => void exportOpenedAdaptation("docx")}
                disabled={
                  exportingFormat !== null ||
                  !openedAdaptation.draftContent.trim()
                }
              >
                {exportingFormat === "docx" ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                Descargar Word
              </button>
            </div>
            <textarea
              className="textarea textarea-bordered min-h-80 w-full font-mono text-sm"
              value={openedAdaptation.draftContent}
              onChange={(event) =>
                setOpenedAdaptation((current) =>
                  current
                    ? { ...current, draftContent: event.target.value }
                    : current,
                )
              }
              disabled={savingAdaptation}
              maxLength={100000}
              aria-label="Contenido editable de la adaptación guardada"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-base-content/60">
                {openedAdaptation.draftContent.length.toLocaleString()} / 100,000
                caracteres
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveOpenedAdaptation}
                disabled={
                  savingAdaptation ||
                  openedAdaptation.draftContent.trim().length === 0 ||
                  openedAdaptation.draftContent.length > 100000
                }
              >
                {savingAdaptation ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </section>
        )}

        {analysis && (
          <div className="space-y-6 border-t border-base-300 pt-5">
            <div>
              <p className="text-sm text-base-content/60">Vacante analizada</p>
              <h3 className="text-lg font-semibold">{analysis.jobTitle}</h3>
            </div>

            <div className="rounded-xl bg-base-200 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-semibold">
                  Coincidencia textual general
                </span>
                <span className="text-2xl font-bold tabular-nums">
                  {analysis.score}%
                </span>
              </div>
              <progress
                className="progress progress-primary w-full"
                value={analysis.score}
                max={100}
                aria-label="Porcentaje de coincidencia textual"
              />
              <p className="mt-2 text-xs text-base-content/60">
                Basado en términos detectados en la descripción, no en una
                evaluación de idoneidad profesional.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {categoryDefinitions.map((category) => {
                const comparison = analysis.categories[category.key];

                return (
                  <section
                    key={category.key}
                    className="rounded-xl border border-base-300 p-4"
                  >
                    <h4 className="font-semibold">{category.title}</h4>
                    <p className="mt-1 text-xs text-base-content/60">
                      {category.description}
                    </p>

                    <div className="mt-4">
                      <p className="text-sm font-medium text-success">
                        Encontrado en el CV ({comparison.matched.length})
                      </p>

                      {comparison.matched.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                          {comparison.matched.map((item) => (
                            <li key={item} className="break-words">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-base-content/55">
                          No se encontraron coincidencias textuales.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 border-t border-base-300 pt-3">
                      <p className="text-sm font-medium text-warning">
                        Pendiente de revisión ({comparison.missing.length})
                      </p>

                      {comparison.missing.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                          {comparison.missing.map((item) => (
                            <li key={item} className="break-words">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-base-content/55">
                          No hay elementos pendientes en esta categoría.
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            <section className="rounded-xl border border-base-300 p-4">
              <h4 className="font-semibold">Palabras clave adicionales</h4>
              <p className="mt-1 text-xs text-base-content/60">
                Otros términos de la descripción que pueden ayudarte a revisar
                el contenido del CV.
              </p>

              <div className="mt-3">
                <p className="text-sm font-medium text-success">
                  Coincidencias
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.matchedKeywords.length > 0 ? (
                    analysis.matchedKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="badge badge-success badge-outline"
                      >
                        {keyword}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-base-content/55">
                      Ninguna detectada.
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-warning">
                  Para revisar
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.missingKeywords.length > 0 ? (
                    analysis.missingKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="badge badge-warning badge-outline"
                      >
                        {keyword}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-base-content/55">
                      Ninguno detectado.
                    </span>
                  )}
                </div>
              </div>
            </section>

            <p className="text-xs text-base-content/60">{analysis.notice}</p>

            <section className="space-y-4 rounded-xl border border-primary/30 p-4">
              <div>
                <h4 className="text-lg font-semibold">
                  Confirmar requisitos para el borrador
                </h4>
                <p className="mt-1 text-sm text-base-content/65">
                  Marca únicamente los requisitos que realmente puedes
                  demostrar. Que un término no aparezca en el CV no significa
                  necesariamente que carezcas de esa experiencia.
                </p>
              </div>

              {requirements.length > 0 ? (
                <div className="space-y-3">
                  {requirements.map((requirement) => (
                    <label
                      key={requirement.key}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-3"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary mt-0.5"
                        checked={Boolean(selectedRequirements[requirement.key])}
                        onChange={(event) =>
                          toggleRequirement(
                            requirement.key,
                            event.target.checked,
                          )
                        }
                        disabled={creatingDraft}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium">
                          {requirement.text}
                        </span>
                        <span className="mt-1 block text-xs text-base-content/60">
                          {requirement.category} · {requirement.source}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-base-content/60">
                  El análisis no detectó requisitos para seleccionar.
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-base-content/65">
                  {selectedCount} requisito(s) confirmado(s)
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={createDraft}
                  disabled={selectedCount === 0 || creatingDraft}
                >
                  {creatingDraft ? "Guardando borrador..." : "Crear borrador"}
                </button>
              </div>
            </section>

            {draftContent && (
              <section className="space-y-3 rounded-xl border border-success/30 p-4">
                <div>
                  <h4 className="text-lg font-semibold">
                    Borrador del CV adaptado
                  </h4>
                  <p className="mt-1 text-sm text-base-content/65">
                    Este borrador se guardó como una adaptación independiente.
                    El CV maestro no se modificó.
                  </p>
                </div>
                <textarea
                  className="textarea textarea-bordered min-h-80 w-full font-mono text-sm"
                  value={draftContent}
                  readOnly
                  aria-label="Contenido del borrador guardado"
                />
                <p className="text-xs text-base-content/60">
                  Por ahora el contenido es de solo lectura. En el siguiente
                  paso podemos habilitar la edición y el guardado de cambios.
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
