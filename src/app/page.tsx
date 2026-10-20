import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import SignOutButton from "@/app/components/SignOutButton";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import CompleteFollowUpButton from "@/app/components/CompleteFollowUpButton";

const navigation = [
  { label: "Dashboard", icon: "▦", href: "/", active: true },
  { label: "Empresas", icon: "▤", href: "/companies", active: false },
  { label: "Vacantes", icon: "▣", href: "/jobs", active: false },
  { label: "Candidaturas", icon: "↗", href: "/applications", active: false },
  { label: "Entrevistas", icon: "◷", href: "/interviews", active: false },
  { label: "Mi currículum", icon: "▧", href: "#", active: false },
];

function formatMetric(value: number): string {
  return new Intl.NumberFormat("es-MX").format(value);
}

function parseLocalDateTime(value: unknown): Date | null {
  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!match) return null;

  const [, year, month, day, hours, minutes, seconds = "0"] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hours) ||
    date.getMinutes() !== Number(minutes)
  ) {
    return null;
  }

  return date;
}

function formatInterviewDate(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatTimeUntil(date: Date, now: Date): string {
  const remainingMinutes = Math.floor((date.getTime() - now.getTime()) / 60000);

  if (remainingMinutes <= 0) return "Es hora de la entrevista";
  if (remainingMinutes < 60) {
    return `En ${remainingMinutes} min`;
  }

  const remainingHours = Math.floor(remainingMinutes / 60);
  if (remainingHours < 24) {
    const minutes = remainingMinutes % 60;
    return minutes === 0
      ? `En ${remainingHours} h`
      : `En ${remainingHours} h ${minutes} min`;
  }

  const remainingDays = Math.floor(remainingHours / 24);
  return remainingDays === 1
    ? "Mañana"
    : `En ${remainingDays} días`;
}
export const instant = false;

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [followUps] = await pool.execute<RowDataPacket[]>(
    `SELECT
       e.id,
       e.title,
       e.details,
       e.event_at,
       CASE WHEN e.event_at < NOW() THEN 1 ELSE 0 END AS is_overdue,
       j.title AS job_title,
       c.name AS company_name,
       a.status AS application_status
     FROM application_events e
     INNER JOIN applications a ON a.id = e.application_id
     INNER JOIN jobs j ON j.id = a.job_id
     LEFT JOIN companies c ON c.id = j.company_id
     WHERE a.user_id = ?
  AND e.event_type IN ('reminder', 'follow_up')
  AND e.event_at IS NOT NULL
  AND e.completed_at IS NULL
     ORDER BY
       CASE WHEN e.event_at < NOW() THEN 0 ELSE 1 END,
       e.event_at ASC
     LIMIT 8`,
    [session.user.id],
  );

  const [upcomingInterviews] = await pool.execute<RowDataPacket[]>(
    `SELECT
       i.id,
       DATE_FORMAT(i.scheduled_at, '%Y-%m-%d %H:%i:%s') AS scheduled_at,
       i.interview_type,
       i.meeting_url,
       j.title AS job_title,
       c.name AS company_name
     FROM interviews i
     INNER JOIN applications a ON a.id = i.application_id
     INNER JOIN jobs j ON j.id = a.job_id
     LEFT JOIN companies c ON c.id = j.company_id
     WHERE a.user_id = ?
       AND i.status = 'scheduled'
       AND i.scheduled_at >= NOW()
     ORDER BY i.scheduled_at ASC
     LIMIT 6`,
    [session.user.id],
  );

  const [metricRows] = await pool.execute<RowDataPacket[]>(
    `SELECT
      (
        SELECT COUNT(*)
        FROM jobs
        WHERE created_by = ?
      ) AS saved_jobs,

      (
        SELECT COUNT(*)
        FROM applications
        WHERE user_id = ?
          AND status IN ('saved', 'applied', 'interviewing', 'offer')
      ) AS active_applications,

      (
        SELECT COUNT(*)
        FROM interviews i
        INNER JOIN applications a ON a.id = i.application_id
        WHERE a.user_id = ?
          AND i.status = 'scheduled'
          AND i.scheduled_at >= NOW()
      ) AS scheduled_interviews,

      (
        SELECT COUNT(*)
        FROM application_events e
        INNER JOIN applications a ON a.id = e.application_id
        WHERE a.user_id = ?
          AND e.event_type IN ('reminder', 'follow_up')
          AND e.event_at IS NOT NULL
          AND e.completed_at IS NULL
      ) AS pending_follow_ups`,
    [
      session.user.id,
      session.user.id,
      session.user.id,
      session.user.id,
    ],
  );

  const metricRow = metricRows[0] ?? {};

  const metrics = [
    {
      label: "Vacantes guardadas",
      value: formatMetric(Number(metricRow.saved_jobs ?? 0)),
      detail: "Vacantes registradas",
      icon: "▣",
    },
    {
      label: "Candidaturas activas",
      value: formatMetric(Number(metricRow.active_applications ?? 0)),
      detail: "Procesos en seguimiento",
      icon: "↗",
    },
    {
      label: "Entrevistas",
      value: formatMetric(Number(metricRow.scheduled_interviews ?? 0)),
      detail: "Entrevistas programadas",
      icon: "◷",
    },
    {
      label: "Seguimientos pendientes",
      value: formatMetric(Number(metricRow.pending_follow_ups ?? 0)),
      detail: "Acciones por realizar",
      icon: "✓",
    },
  ];

  return (
    <div className="min-h-screen bg-base-200 text-base-content lg:flex">
      <aside className="flex w-full flex-col border-b border-base-300 bg-base-100 p-5 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-content">
            J
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">JobTracker</div>
            <div className="text-xs text-base-content/60">
              Tu búsqueda, organizada
            </div>
          </div>
        </Link>

        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-base-content/45">
          Espacio de trabajo
        </div>

        <nav
          aria-label="Navegación principal"
          className="flex flex-wrap gap-1 lg:flex-col"
        >
          {navigation.map((item) => (
            <a
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                item.active
                  ? "bg-primary text-primary-content"
                  : "text-base-content/70 hover:bg-base-200"
              }`}
            >
              <span className="w-5 text-center text-lg" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="mt-8 rounded-2xl border border-base-300 bg-base-200 p-4 lg:mt-auto">
          <div className="mb-2 text-sm font-semibold">Un paso a la vez</div>
          <p className="text-xs leading-5 text-base-content/65">
            Organiza tus oportunidades y mantén el control de cada proceso.
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-full bg-secondary/15 font-semibold text-secondary">
            U
          </div>
          <div>
            <div className="text-sm font-medium">Mi espacio</div>
            <div className="text-xs text-base-content/55">Uso personal</div>
          </div>
        </div>

        <SignOutButton />
      </aside>

      <main className="min-w-0 flex-1 p-5 sm:p-8 xl:p-10">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 text-sm text-base-content/55">
              Espacio de trabajo / Dashboard
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Resumen general
            </h1>
            <p className="mt-2 text-sm text-base-content/60">
              Una vista clara de tu búsqueda de empleo.
            </p>
          </div>
          <span className="badge badge-outline gap-2 px-3 py-4">
            <span className="size-2 rounded-full bg-success" />
            Espacio listo para configurar
          </span>
        </header>

        <section aria-labelledby="metrics-title" className="mb-9">
          <div className="mb-4">
            <h2 id="metrics-title" className="text-lg font-semibold">
              Tus indicadores
            </h2>
            <p className="mt-1 text-sm text-base-content/55">
              Indicadores actualizados con los datos de tus registros.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {metrics.map((metric) => (
              <article
                key={metric.label}
                className="card border border-base-300 bg-base-100 shadow-sm"
              >
                <div className="card-body gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-base-content/65">
                      {metric.label}
                    </span>
                    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-lg text-primary">
                      {metric.icon}
                    </span>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{metric.value}</div>
                    <p className="mt-1 text-xs text-base-content/55">
                      {metric.detail}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section aria-labelledby="upcoming-interviews-title" className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2
                id="upcoming-interviews-title"
                className="text-lg font-semibold"
              >
                Próximas entrevistas
              </h2>
              <p className="mt-1 text-sm text-base-content/55">
                Tus entrevistas programadas para los próximos días.
              </p>
            </div>
            <Link href="/interviews" className="btn btn-outline btn-sm">
              Ver entrevistas
            </Link>
          </div>

          {upcomingInterviews.length === 0 ? (
            <article className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body items-center p-8 text-center">
                <div className="mb-2 grid size-12 place-items-center rounded-xl bg-base-200 text-xl">
                  ◷
                </div>
                <h3 className="font-semibold">
                  No tienes entrevistas próximas
                </h3>
                <p className="max-w-md text-sm text-base-content/60">
                  Las entrevistas que registres y estén programadas aparecerán aquí.
                </p>
                <Link href="/interviews" className="btn btn-primary btn-sm mt-2">
                  Agendar entrevista
                </Link>
              </div>
            </article>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {upcomingInterviews.map((interview) => {
                const interviewDate = parseLocalDateTime(
                  interview.scheduled_at,
                );
                const now = new Date();

                const isSameDay = (first: Date, second: Date) =>
                  first.getFullYear() === second.getFullYear() &&
                  first.getMonth() === second.getMonth() &&
                  first.getDate() === second.getDate();

                const isToday = interviewDate
                  ? isSameDay(interviewDate, now)
                  : false;

                const tomorrow = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate() + 1,
                );

                const isTomorrow = interviewDate
                  ? isSameDay(interviewDate, tomorrow)
                  : false;

                const interviewTypeLabels: Record<string, string> = {
                  virtual: "Virtual",
                  onsite: "Presencial",
                  phone: "Telefónica",
                };

                return (
                  <article
                    key={String(interview.id)}
                    className="card border border-base-300 bg-base-100 shadow-sm"
                  >
                    <div className="card-body gap-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold">
                            {String(interview.job_title)}
                          </h3>
                          <p className="mt-1 text-sm text-base-content/65">
                            {String(
                              interview.company_name ?? "Empresa sin especificar",
                            )}
                          </p>
                        </div>
                        <span className="badge badge-primary badge-outline shrink-0">
                          {interviewTypeLabels[String(interview.interview_type)] ??
                            String(interview.interview_type)}
                        </span>
                      </div>

                      {interviewDate ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">
                            {formatInterviewDate(interviewDate)}
                          </p>
                          <span
                            className={`badge ${
                              isToday
                                ? "badge-warning"
                                : isTomorrow
                                  ? "badge-secondary"
                                  : "badge-ghost"
                            }`}
                          >
                            {isToday
                              ? "Hoy"
                              : isTomorrow
                                ? "Mañana"
                                : formatTimeUntil(interviewDate, now)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-error">
                          No se pudo interpretar la fecha de esta entrevista.
                        </p>
                      )}

                      {interview.meeting_url ? (
                        <a
                          href={String(interview.meeting_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary text-sm"
                        >
                          Unirse a la entrevista
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="follow-ups-title" className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 id="follow-ups-title" className="text-lg font-semibold">
                Próximos seguimientos
              </h2>
              <p className="mt-1 text-sm text-base-content/55">
                Recordatorios pendientes y seguimientos vencidos de tus
                candidaturas.
              </p>
            </div>
            <Link href="/applications" className="btn btn-outline btn-sm">
              Ver candidaturas
            </Link>
          </div>

          {followUps.length === 0 ? (
            <article className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body items-center p-8 text-center">
                <div className="mb-2 grid size-12 place-items-center rounded-xl bg-base-200 text-xl">
                  ◷
                </div>
                <h3 className="font-semibold">
                  No tienes seguimientos programados
                </h3>
                <p className="max-w-md text-sm text-base-content/60">
                  Cuando agregues recordatorios con fecha a tus candidaturas,
                  aparecerán aquí.
                </p>
              </div>
            </article>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {followUps.map((item) => {
                const rawEventDate = item.event_at;
                const eventDate =
                  rawEventDate instanceof Date
                    ? rawEventDate
                    : new Date(String(rawEventDate).replace(" ", "T"));
                const overdue = Number(item.is_overdue) === 1;

                return (
                  <article
                    key={String(item.id)}
                    className="card border border-base-300 bg-base-100 shadow-sm"
                  >
                    <div className="card-body gap-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold">
                            {String(item.title)}
                          </h3>
                          <p className="mt-1 text-sm text-base-content/65">
                            {String(
                              item.company_name ?? "Empresa sin especificar",
                            )}
                          </p>
                        </div>
                        <span
                          className={`badge shrink-0 ${
                            overdue
                              ? "badge-error"
                              : "badge-primary badge-outline"
                          }`}
                        >
                          {overdue ? "Vencido" : "Pendiente"}
                        </span>
                      </div>

                      <p className="text-sm font-medium">
                        {String(item.job_title)}
                      </p>

                      {item.details ? (
                        <p className="text-sm leading-5 text-base-content/65">
                          {String(item.details)}
                        </p>
                      ) : null}

                      <div className="text-xs text-base-content/55">
                        {eventDate.toLocaleString("es-MX")}
                      </div>
                      <div className="mt-2">
                        <CompleteFollowUpButton eventId={String(item.id)} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Actividad reciente</h2>
                  <p className="mt-1 text-sm text-base-content/55">
                    Aquí aparecerán los cambios de tus candidaturas.
                  </p>
                </div>
                <span className="badge badge-ghost">Sin actividad</span>
              </div>

              <div className="my-5 rounded-2xl border border-dashed border-base-300 px-5 py-10 text-center">
                <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-base-200 text-2xl">
                  ◷
                </div>
                <h3 className="font-semibold">Tu actividad aparecerá aquí</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-base-content/60">
                  Cuando registres empresas, vacantes o candidaturas, podrás
                  consultar sus movimientos desde este panel.
                </p>
              </div>
            </div>
          </article>

          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body p-6">
              <h2 className="text-lg font-semibold">Próximos pasos</h2>
              <p className="text-sm text-base-content/55">
                Preparación inicial del espacio.
              </p>

              <ul className="mt-3 space-y-4">
                {[
                  [
                    "01",
                    "Registrar empresas",
                    "Organiza las empresas de tu interés.",
                  ],
                  [
                    "02",
                    "Guardar vacantes",
                    "Conserva la descripción y el enlace original.",
                  ],
                  [
                    "03",
                    "Dar seguimiento",
                    "Registra estados, entrevistas y fechas.",
                  ],
                  [
                    "04",
                    "Preparar tu CV",
                    "Adapta tu currículum a cada oportunidad.",
                  ],
                ].map(([number, title, description]) => (
                  <li key={number} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-base-200 text-xs font-semibold">
                      {number}
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{title}</div>
                      <p className="mt-1 text-xs leading-5 text-base-content/60">
                        {description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </section>

        <footer className="mt-8 border-t border-base-300 pt-5 text-xs text-base-content/50">
          JobTracker · Panel personal de seguimiento de oportunidades
        </footer>
      </main>
    </div>
  );
}
