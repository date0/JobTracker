"use client";

import { useEffect, useState } from "react";

import type { ResumeStructure } from "@/lib/resume-structure";
import {
  compareResumeStructures,
  type ChangeStatus,
  type ExperienceChange,
  type ItemChange,
  type ResponsibilityChange,
} from "@/lib/resume-structure-diff";

type HistoryVersion = {
  version: number;
  schema_version: number;
  source_hash: string;
  confirmed_at: string;
};

type HistoryResponse = {
  success: boolean;
  versions?: HistoryVersion[];
  error?: string;
};

type StructureResponse = {
  success: boolean;
  version?: number;
  confirmed_at?: string;
  structure?: ResumeStructure;
  error?: string;
};

type LoadedVersion = {
  version: number;
  confirmed_at: string;
  structure: ResumeStructure;
};

type RestoreResponse = {
  success: boolean;
  restored?: boolean;
  already_current?: boolean;
  history_entry_created?: boolean;
  restored_from_version?: number;
  version?: number;
  source_hash?: string;
  message?: string;
  error?: string;
};

function statusLabel(status: ChangeStatus) {
  switch (status) {
    case "added":
      return "Agregado";
    case "removed":
      return "Eliminado";
    case "modified":
      return "Modificado";
  }
}

function statusBadge(status: ChangeStatus) {
  const classes: Record<ChangeStatus, string> = {
    added: "badge-success",
    removed: "badge-error",
    modified: "badge-warning",
  };

  return (
    <span className={`badge ${classes[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

function OriginalText({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div>
      <p className="text-xs font-medium text-base-content/50">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">
        {value}
      </p>
    </div>
  );
}

function ChangeCard({
  status,
  title,
  previousText,
  currentText,
  children,
}: {
  status: ChangeStatus;
  title: string;
  previousText?: string | null;
  currentText?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-base-300 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">{title}</h4>
        {statusBadge(status)}
      </div>

      {status === "modified" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-error">
              Versión anterior
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {previousText || "Sin texto"}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-success">
              Versión nueva
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {currentText || "Sin texto"}
            </p>
          </div>
        </div>
      ) : (
        <OriginalText
          label={status === "added" ? "Texto nuevo" : "Texto anterior"}
          value={status === "added" ? currentText : previousText}
        />
      )}

      {children}
    </article>
  );
}

function ResponsibilityChanges({
  changes,
}: {
  changes: ResponsibilityChange[];
}) {
  if (changes.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <h5 className="text-sm font-semibold">
        Responsabilidades ({changes.length})
      </h5>

      {changes.map((change, index) => (
        <ChangeCard
          key={`${change.previous?.id ?? "new"}-${change.current?.id ?? "old"}-${index}`}
          status={change.status}
          title={`Responsabilidad ${index + 1}`}
          previousText={change.previous?.original_text}
          currentText={change.current?.original_text}
        />
      ))}
    </div>
  );
}

function ExperienceChanges({
  changes,
}: {
  changes: ExperienceChange[];
}) {
  return (
    <div className="space-y-4">
      {changes.map((change, index) => {
        const experience = change.current ?? change.previous;

        return (
          <ChangeCard
            key={experience?.id ?? index}
            status={change.status}
            title={
              [experience?.company, experience?.position]
                .filter(Boolean)
                .join(" — ") || `Experiencia ${index + 1}`
            }
            previousText={change.previous?.original_text}
            currentText={change.current?.original_text}
          >
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <OriginalText
                label="Fechas anteriores"
                value={change.previous?.original_date_text}
              />
              <OriginalText
                label="Fechas nuevas"
                value={change.current?.original_date_text}
              />
            </div>

            <ResponsibilityChanges changes={change.responsibilities} />
          </ChangeCard>
        );
      })}
    </div>
  );
}

function SimpleChanges<T extends { id: string }>({
  changes,
  getTitle,
  getPreviousText,
  getCurrentText,
}: {
  changes: ItemChange<T>[];
  getTitle: (item: T) => string;
  getPreviousText: (item: T) => string;
  getCurrentText: (item: T) => string;
}) {
  return (
    <div className="space-y-3">
      {changes.map((change, index) => {
        const item = change.current ?? change.previous;

        if (!item) return null;

        return (
          <ChangeCard
            key={item.id || index}
            status={change.status}
            title={getTitle(item)}
            previousText={
              change.previous
                ? getPreviousText(change.previous)
                : null
            }
            currentText={
              change.current
                ? getCurrentText(change.current)
                : null
            }
          />
        );
      })}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ResumeStructureHistory() {
  const [versions, setVersions] = useState<HistoryVersion[]>([]);
  const [previousVersion, setPreviousVersion] = useState("");
  const [currentVersion, setCurrentVersion] = useState("");

  const [previousData, setPreviousData] = useState<LoadedVersion | null>(null);
  const [currentData, setCurrentData] = useState<LoadedVersion | null>(null);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [error, setError] = useState("");

  const [restoreTargetVersion, setRestoreTargetVersion] =
    useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreMessage, setRestoreMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoadingHistory(true);
      setError("");

      try {
        const response = await fetch("/api/resume/structure/history");
        const data = (await response.json()) as HistoryResponse;

        if (!response.ok || !data.success || !data.versions) {
          throw new Error(
            data.error || "No se pudo consultar el historial.",
          );
        }

        if (cancelled) return;

        setVersions(data.versions);

        if (data.versions.length > 0) {
          setCurrentVersion(String(data.versions[0].version));

          if (data.versions.length > 1) {
            setPreviousVersion(String(data.versions[1].version));
          } else {
            setPreviousVersion(String(data.versions[0].version));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo consultar el historial.",
          );
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!previousVersion || !currentVersion) return;

    let cancelled = false;

    async function loadComparison() {
      setLoadingComparison(true);
      setError("");
      setPreviousData(null);
      setCurrentData(null);

      try {
        const [previousResponse, currentResponse] = await Promise.all([
          fetch(
            `/api/resume/structure/history?version=${encodeURIComponent(previousVersion)}`,
          ),
          fetch(
            `/api/resume/structure/history?version=${encodeURIComponent(currentVersion)}`,
          ),
        ]);

        const [previous, current] = await Promise.all([
          previousResponse.json() as Promise<StructureResponse>,
          currentResponse.json() as Promise<StructureResponse>,
        ]);

        if (
          !previousResponse.ok ||
          !previous.success ||
          !previous.structure ||
          !previous.version ||
          !previous.confirmed_at
        ) {
          throw new Error(
            previous.error || "No se pudo cargar la versión anterior.",
          );
        }

        if (
          !currentResponse.ok ||
          !current.success ||
          !current.structure ||
          !current.version ||
          !current.confirmed_at
        ) {
          throw new Error(
            current.error || "No se pudo cargar la versión nueva.",
          );
        }

        if (cancelled) return;

        setPreviousData({
          version: previous.version,
          confirmed_at: previous.confirmed_at,
          structure: previous.structure,
        });

        setCurrentData({
          version: current.version,
          confirmed_at: current.confirmed_at,
          structure: current.structure,
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo comparar las versiones.",
          );
        }
      } finally {
        if (!cancelled) setLoadingComparison(false);
      }
    }

    void loadComparison();

    return () => {
      cancelled = true;
    };
  }, [previousVersion, currentVersion]);

  async function confirmRestore() {
    if (restoreTargetVersion === null || restoring) return;

    const targetVersion = restoreTargetVersion;

    setRestoring(true);
    setRestoreError("");
    setRestoreMessage("");

    try {
      const response = await fetch("/api/resume/structure/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: targetVersion,
        }),
      });

      const data = (await response.json()) as RestoreResponse;

      if (
        !response.ok ||
        !data.success ||
        !Number.isSafeInteger(data.version) ||
        !data.version ||
        data.version < 1
      ) {
        throw new Error(
          data.error || "No se pudo restaurar la versión seleccionada.",
        );
      }

      setRestoreTargetVersion(null);
      setRestoreMessage(
        data.message || "El CV maestro fue restaurado correctamente.",
      );

      // Refresh the version index after the server confirms the restore.
      try {
        const historyResponse = await fetch(
          "/api/resume/structure/history",
        );
        const history = (await historyResponse.json()) as HistoryResponse;

        if (
          !historyResponse.ok ||
          !history.success ||
          !history.versions
        ) {
          throw new Error(
            history.error || "No se pudo actualizar el historial.",
          );
        }

        setVersions(history.versions);
        setPreviousVersion(String(targetVersion));
        setCurrentVersion(String(data.version));
      } catch (refreshError) {
        setRestoreError(
          "La restauración se completó, pero no se pudo actualizar " +
          "la pantalla del historial. Recarga la página para consultar " +
          "las versiones actualizadas.",
        );
      }
    } catch (err) {
      setRestoreError(
        err instanceof Error
          ? err.message
          : "No se pudo restaurar la versión seleccionada.",
      );
    } finally {
      setRestoring(false);
    }
  }

  const comparison =
    previousData && currentData
      ? compareResumeStructures(
          previousData.structure,
          currentData.structure,
        )
      : null;

  const totalChanges = comparison
    ? comparison.experience.length +
      comparison.skills.length +
      comparison.education.length +
      comparison.certifications.length
    : 0;

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-6 p-6 sm:p-8">
        <div>
          <h2 className="text-xl font-bold">
            Historial y comparación del CV
          </h2>
          <p className="mt-2 text-sm text-base-content/60">
            Consulta las versiones confirmadas y revisa qué cambió entre
            ellas. El historial es de solo lectura.
          </p>
        </div>

        {loadingHistory && (
          <div className="flex items-center gap-3 text-sm">
            <span className="loading loading-spinner loading-sm" />
            Consultando historial...
          </div>
        )}

        {!loadingHistory && versions.length === 0 && !error && (
          <div className="alert">
            Todavía no existen versiones confirmadas del CV.
          </div>
        )}

        {versions.length > 0 && (
          <>
            <div className="rounded-xl border border-base-300 p-4">
              <h3 className="mb-4 font-semibold">
                Versiones confirmadas ({versions.length})
              </h3>

              <div className="space-y-3">
                {versions.map(version => (
                  <div
                    key={version.version}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-base-200 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">
                        Versión {version.version}
                      </p>
                      <p className="text-xs text-base-content/50">
                        Confirmada: {formatDate(version.confirmed_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge badge-ghost">
                        Esquema {version.schema_version}
                      </span>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={restoring}
                        onClick={() => {
                          setRestoreTargetVersion(version.version);
                          setRestoreError("");
                          setRestoreMessage("");
                        }}
                      >
                        Restaurar como CV maestro
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {restoreTargetVersion !== null && (
              <div className="rounded-xl border border-warning/50 bg-warning/5 p-4">
                <h3 className="font-semibold">
                  Confirmar restauración de la versión {restoreTargetVersion}
                </h3>

                <p className="mt-2 text-sm text-base-content/70">
                  Esta operación reemplazará los 14 campos actuales del CV
                  maestro con el contenido exacto de la versión seleccionada.
                  También recuperará su estructura semántica y sus
                  identificadores originales.
                </p>

                <p className="mt-2 text-sm font-medium">
                  El historial no se eliminará ni se sobrescribirá.
                  Si corresponde, se registrará una nueva versión.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-warning btn-sm"
                    onClick={() => void confirmRestore()}
                    disabled={restoring}
                  >
                    {restoring ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        Restaurando...
                      </>
                    ) : (
                      "Sí, restaurar esta versión"
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setRestoreTargetVersion(null)}
                    disabled={restoring}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {restoreMessage && (
              <div className="alert alert-success">
                <span>{restoreMessage}</span>
              </div>
            )}

            {restoreError && (
              <div className="alert alert-error">
                <span>{restoreError}</span>
              </div>
            )}

            <div className="grid gap-4 rounded-xl border border-base-300 p-4 md:grid-cols-2">
              <label className="form-control gap-2">
                <span className="label-text font-medium">
                  Comparar desde
                </span>

                <select
                  className="select select-bordered w-full"
                  value={previousVersion}
                  onChange={event => setPreviousVersion(event.target.value)}
                  disabled={loadingComparison}
                >
                  {versions.map(version => (
                    <option
                      key={version.version}
                      value={String(version.version)}
                    >
                      Versión {version.version}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control gap-2">
                <span className="label-text font-medium">
                  Comparar contra
                </span>

                <select
                  className="select select-bordered w-full"
                  value={currentVersion}
                  onChange={event => setCurrentVersion(event.target.value)}
                  disabled={loadingComparison}
                >
                  {versions.map(version => (
                    <option
                      key={version.version}
                      value={String(version.version)}
                    >
                      Versión {version.version}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loadingComparison && (
              <div className="flex items-center gap-3 text-sm">
                <span className="loading loading-spinner loading-sm" />
                Cargando las versiones seleccionadas...
              </div>
            )}

            {comparison && previousData && currentData && (
              <>
                <div className="rounded-xl bg-base-200 p-4">
                  <p className="font-semibold">
                    Versión {previousData.version} → Versión{" "}
                    {currentData.version}
                  </p>

                  <p className="mt-1 text-sm text-base-content/60">
                    {totalChanges} elementos con cambios detectados.
                  </p>
                </div>

                {totalChanges === 0 ? (
                  <div className="alert">
                    No se detectaron cambios entre estas versiones.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {comparison.experience.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-semibold">Experiencia laboral</h3>
                          <span className="badge badge-ghost">
                            {comparison.experience.length}
                          </span>
                        </div>

                        <ExperienceChanges
                          changes={comparison.experience}
                        />
                      </section>
                    )}

                    {comparison.skills.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-semibold">Habilidades</h3>
                          <span className="badge badge-ghost">
                            {comparison.skills.length}
                          </span>
                        </div>

                        <SimpleChanges
                          changes={comparison.skills}
                          getTitle={item => item.name}
                          getPreviousText={item => item.source_text}
                          getCurrentText={item => item.source_text}
                        />
                      </section>
                    )}

                    {comparison.education.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-semibold">Educación</h3>
                          <span className="badge badge-ghost">
                            {comparison.education.length}
                          </span>
                        </div>

                        <SimpleChanges
                          changes={comparison.education}
                          getTitle={item =>
                            item.degree || item.institution || "Educación"
                          }
                          getPreviousText={item => item.original_text}
                          getCurrentText={item => item.original_text}
                        />
                      </section>
                    )}

                    {comparison.certifications.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-semibold">Certificaciones</h3>
                          <span className="badge badge-ghost">
                            {comparison.certifications.length}
                          </span>
                        </div>

                        <SimpleChanges
                          changes={comparison.certifications}
                          getTitle={item =>
                            item.name || item.original_text
                          }
                          getPreviousText={item => item.original_text}
                          getCurrentText={item => item.original_text}
                        />
                      </section>
                    )}
                  </div>
                )}

                <div className="divider" />

                <details className="collapse collapse-arrow border border-base-300">
                  <summary className="collapse-title font-semibold">
                    Consultar textos originales completos
                  </summary>

                  <div className="collapse-content space-y-5">
                    {[previousData, currentData].map(data => (
                      <section
                        key={data.version}
                        className="space-y-3"
                      >
                        <h3 className="font-semibold">
                          Versión {data.version}
                        </h3>

                        <OriginalText
                          label="Título profesional"
                          value={data.structure.professional_title.original_text}
                        />

                        <OriginalText
                          label="Resumen profesional"
                          value={data.structure.professional_summary.original_text}
                        />

                        {data.structure.experience.map(experience => (
                          <div
                            key={experience.id}
                            className="rounded-lg border border-base-300 p-3"
                          >
                            <p className="font-medium">
                              {[experience.company, experience.position]
                                .filter(Boolean)
                                .join(" — ")}
                            </p>

                            <OriginalText
                              label="Texto original de experiencia"
                              value={experience.original_text}
                            />

                            <div className="mt-3 space-y-2">
                              {experience.responsibilities.map(item => (
                                <OriginalText
                                  key={item.id}
                                  label="Responsabilidad original"
                                  value={item.original_text}
                                />
                              ))}
                            </div>
                          </div>
                        ))}

                        <OriginalText
                          label="Habilidades originales"
                          value={data.structure.technical_skills
                            .map(item => item.source_text)
                            .join(", ")}
                        />

                        <OriginalText
                          label="Educación original"
                          value={data.structure.education
                            .map(item => item.original_text)
                            .join("\n")}
                        />

                        <OriginalText
                          label="Certificaciones originales"
                          value={data.structure.certifications
                            .map(item => item.original_text)
                            .join("\n")}
                        />
                      </section>
                    ))}
                  </div>
                </details>
              </>
            )}
          </>
        )}

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
      </div>
    </section>
  );
}
