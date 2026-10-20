"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type ResumeForm = {
  full_name: string;
  phone: string;
  email: string;
  state: string;
  country: string;
  postal_code: string;
  linkedin: string;
  portfolio: string;
  headline: string;
  summary: string;
  experience: string;
  skills: string;
  education: string;
  certifications: string;
};

const emptyForm: ResumeForm = {
  full_name: "",
  phone: "",
  email: "",
  state: "",
  country: "",
  postal_code: "",
  linkedin: "",
  portfolio: "",
  headline: "",
  summary: "",
  experience: "",
  skills: "",
  education: "",
  certifications: "",
};

const sections: {
  name: keyof ResumeForm;
  label: string;
  description: string;
  placeholder: string;
  maxLength: number;
  rows: number;
}[] = [
  {
    name: "full_name",
    label: "Nombre completo",
    description: "Tu nombre tal como deseas que aparezca en el CV.",
    placeholder: "Nombre y apellidos",
    maxLength: 255,
    rows: 1,
  },
  {
    name: "phone",
    label: "Teléfono",
    description: "Incluye la clave de país si buscas empleo internacional.",
    placeholder: "+52 ...",
    maxLength: 80,
    rows: 1,
  },
  {
    name: "email",
    label: "Correo electrónico",
    description: "Correo profesional de contacto.",
    placeholder: "nombre@ejemplo.com",
    maxLength: 320,
    rows: 1,
  },
  {
    name: "state",
    label: "Estado o provincia",
    description: "Lugar de residencia.",
    placeholder: "Querétaro",
    maxLength: 120,
    rows: 1,
  },
  {
    name: "country",
    label: "País",
    description: "País de residencia.",
    placeholder: "México",
    maxLength: 120,
    rows: 1,
  },
  {
    name: "postal_code",
    label: "Código postal",
    description: "Opcional; inclúyelo si te resulta útil para la vacante.",
    placeholder: "Código postal",
    maxLength: 20,
    rows: 1,
  },
  {
    name: "linkedin",
    label: "LinkedIn",
    description: "URL de tu perfil profesional.",
    placeholder: "https://www.linkedin.com/in/...",
    maxLength: 500,
    rows: 1,
  },
  {
    name: "portfolio",
    label: "Portafolio o sitio web",
    description: "URL de tu portafolio, GitHub o sitio profesional.",
    placeholder: "https://...",
    maxLength: 1000,
    rows: 1,
  },
  {
    name: "headline",
    label: "Título profesional",
    description: "El rol que mejor representa tu perfil.",
    placeholder: "Ej. Senior DevOps Engineer | Cloud & Automation",
    maxLength: 255,
    rows: 2,
  },
  {
    name: "summary",
    label: "Resumen profesional",
    description: "Experiencia, especialidades y fortalezas principales.",
    placeholder: "Describe tu trayectoria profesional y tus principales fortalezas...",
    maxLength: 10000,
    rows: 5,
  },
  {
    name: "experience",
    label: "Experiencia laboral",
    description: "Incluye puestos, fechas, responsabilidades y logros verificables.",
    placeholder: "Empresa | Puesto | Fechas\nResponsabilidades y logros...",
    maxLength: 50000,
    rows: 10,
  },
  {
    name: "skills",
    label: "Habilidades y tecnologías",
    description: "Herramientas, lenguajes, plataformas y competencias.",
    placeholder: "Ej. Linux, SQL, Kubernetes, CI/CD, networking...",
    maxLength: 15000,
    rows: 5,
  },
  {
    name: "education",
    label: "Formación académica",
    description: "Estudios, instituciones y fechas relevantes.",
    placeholder: "Grado o título | Institución | Año",
    maxLength: 20000,
    rows: 4,
  },
  {
    name: "certifications",
    label: "Certificaciones y cursos",
    description: "Incluye únicamente certificaciones obtenidas y cursos realizados.",
    placeholder: "Certificación o curso | Emisor | Año",
    maxLength: 15000,
    rows: 4,
  },
];

export default function ResumeEditor() {
  const [form, setForm] = useState<ResumeForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadResume = useCallback(async () => {
    try {
      const response = await fetch("/api/resume");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo cargar el CV.");
      }

      const profile = data.profile;

      setForm({
        full_name: profile?.full_name ?? "",
        phone: profile?.phone ?? "",
        email: profile?.email ?? "",
        state: profile?.state ?? "",
        country: profile?.country ?? "",
        postal_code: profile?.postal_code ?? "",
        linkedin: profile?.linkedin ?? "",
        portfolio: profile?.portfolio ?? "",
        headline: profile?.headline ?? "",
        summary: profile?.summary ?? "",
        experience: profile?.experience ?? "",
        skills: profile?.skills ?? "",
        education: profile?.education ?? "",
        certifications: profile?.certifications ?? "",
      });
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el CV.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // La función carga los datos de forma asíncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Carga inicial del CV.
    void loadResume();
  }, [loadResume]);

  function updateField(field: keyof ResumeForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el CV.");
      }

      setMessage("CV maestro guardado correctamente.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el CV.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <p role="status">Cargando tu currículum...</p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-info/30 bg-info/5 p-4 text-sm">
        <h2 className="font-semibold">Tu CV maestro</h2>
        <p className="mt-1 text-base-content/70">
          Guarda aquí tu información profesional real. Las futuras adaptaciones
          partirán de este contenido y no deberán inventar experiencia,
          tecnologías ni logros.
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="card border border-base-300 bg-base-100 shadow-sm"
      >
        <div className="card-body gap-6 p-6 sm:p-8">
          {sections.map((section) => (
            <div key={section.name}>
              <label htmlFor={section.name} className="label">
                <span className="label-text font-semibold">
                  {section.label}
                </span>
              </label>
              <p className="mb-2 text-xs text-base-content/60">
                {section.description}
              </p>

              {section.rows === 1 || section.rows === 2 ? (
                <input
                  id={section.name}
                  className="input input-bordered w-full"
                  value={form[section.name]}
                  onChange={(event) =>
                    updateField(section.name, event.target.value)
                  }
                  maxLength={section.maxLength}
                  placeholder={section.placeholder}
                />
              ) : (
                <textarea
                  id={section.name}
                  className="textarea textarea-bordered min-h-28 w-full"
                  rows={section.rows}
                  value={form[section.name]}
                  onChange={(event) =>
                    updateField(section.name, event.target.value)
                  }
                  maxLength={section.maxLength}
                  placeholder={section.placeholder}
                />
              )}

              <p className="mt-1 text-right text-xs text-base-content/45">
                {form[section.name].length.toLocaleString("es-MX")} /{" "}
                {section.maxLength.toLocaleString("es-MX")} caracteres
              </p>
            </div>
          ))}

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

          <div className="flex flex-wrap items-center gap-3 border-t border-base-300 pt-5">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar CV maestro"}
            </button>
            <p className="text-xs text-base-content/60">
              Los cambios se guardan al pulsar el botón.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
