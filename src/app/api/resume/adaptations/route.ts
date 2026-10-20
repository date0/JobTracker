import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import pool from "@/lib/db";

type JobRow = {
  id: number;
  title: string;
  description: string | null;
};

type ResumeRow = {
  headline: string | null;
  summary: string | null;
  experience: string | null;
  skills: string | null;
  education: string | null;
  certifications: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  linkedin: string | null;
  portfolio: string | null;
};


type AdaptationRow = {
  id: number | bigint;
  job_id: number | bigint;
  job_title: string;
  confirmed_requirements: string;
  draft_content: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const userId = Number(session.user.id);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return NextResponse.json(
      { success: false, error: "La sesión no contiene un usuario válido" },
      { status: 401 },
    );
  }

  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         job_id,
         job_title,
         confirmed_requirements,
         draft_content,
         created_at,
         updated_at
       FROM resume_adaptations
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 100`,
      [userId],
    );

    const adaptations = (rows as AdaptationRow[]).map((row) => {
      let confirmedRequirements: string[];

      try {
        const parsed: unknown = JSON.parse(row.confirmed_requirements);

        if (
          !Array.isArray(parsed) ||
          !parsed.every((item) => typeof item === "string")
        ) {
          throw new Error("Formato de requisitos inválido");
        }

        confirmedRequirements = parsed;
      } catch {
        throw new Error(
          `Los requisitos de la adaptación ${String(row.id)} no son válidos`,
        );
      }

      return {
        id: String(row.id),
        jobId: String(row.job_id),
        jobTitle: row.job_title,
        confirmedRequirements,
        draftContent: row.draft_content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({
      success: true,
      adaptations,
    });
  } catch (error) {
    console.error("Failed to retrieve resume adaptations:", error);

    return NextResponse.json(
      { success: false, error: "No se pudieron recuperar los borradores" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const userId = Number(session.user.id);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return NextResponse.json(
      { success: false, error: "La sesión no contiene un usuario válido" },
      { status: 401 },
    );
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "El cuerpo de la solicitud no es válido" },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const jobId = Number(data.jobId);
    const requirements = data.confirmedRequirements;

    if (!Number.isSafeInteger(jobId) || jobId <= 0) {
      return NextResponse.json(
        { success: false, error: "Selecciona una vacante válida" },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(requirements) ||
      requirements.length === 0 ||
      requirements.length > 80 ||
      !requirements.every(
        (item) =>
          typeof item === "string" &&
          item.trim().length > 0 &&
          item.trim().length <= 1000,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Selecciona al menos un requisito que puedas respaldar con tu experiencia",
        },
        { status: 400 },
      );
    }

    const confirmedRequirements = [
      ...new Set(
        (requirements as string[]).map((item) => item.trim()),
      ),
    ];

    const [jobRows] = await pool.execute(
      `SELECT id, title, description
       FROM jobs
       WHERE id = ?
         AND (created_by = ? OR created_by IS NULL)
       LIMIT 1`,
      [jobId, userId],
    );

    const job = (jobRows as JobRow[])[0];

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: "La vacante no existe o no tienes permiso para utilizarla",
        },
        { status: 404 },
      );
    }

    const [resumeRows] = await pool.execute(
      `SELECT headline, summary, experience, skills, education, certifications,
              full_name, phone, email, state, country, postal_code, linkedin, portfolio
       FROM resume_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    const resume = (resumeRows as ResumeRow[])[0];

    if (!resume) {
      return NextResponse.json(
        { success: false, error: "Primero guarda tu CV maestro" },
        { status: 400 },
      );
    }

    const contactLines = [
      resume.phone ? `Teléfono: ${resume.phone}` : "",
      resume.email ? `Correo: ${resume.email}` : "",
      [resume.state, resume.country].filter(Boolean).join(", "),
      resume.postal_code ? `Código postal: ${resume.postal_code}` : "",
      resume.linkedin ? `LinkedIn: ${resume.linkedin}` : "",
      resume.portfolio ? `Portafolio: ${resume.portfolio}` : "",
    ].filter(Boolean);

    const draftContent = [
      `CV ADAPTADO — ${job.title}`,
      "",
      "BORRADOR PARA REVISIÓN. Verifica cada dato antes de utilizarlo.",
      "",
      "NOMBRE COMPLETO",
      resume.full_name || "[Completar nombre completo]",
      "",
      "DATOS DE CONTACTO",
      ...contactLines.length ? contactLines : ["[Completar datos de contacto]"],
      "",
      "TÍTULO PROFESIONAL",
      resume.headline || "[Completar título profesional]",
      "",
      "RESUMEN PROFESIONAL",
      resume.summary || "[Completar resumen profesional]",
      "",
      "EXPERIENCIA LABORAL",
      resume.experience || "[Completar experiencia laboral]",
      "",
      "HABILIDADES Y REQUISITOS RELEVANTES CONFIRMADOS POR EL USUARIO",
      ...confirmedRequirements.map((item) => `- ${item}`),
      "",
      "HABILIDADES Y TECNOLOGÍAS DEL CV MAESTRO",
      resume.skills || "[Completar habilidades y tecnologías]",
      "",
      "FORMACIÓN ACADÉMICA",
      resume.education || "[Completar formación académica]",
      "",
      "CERTIFICACIONES Y CURSOS",
      resume.certifications || "[Completar certificaciones y cursos]",
    ].join("\n");

    const [result] = await pool.execute(
      `INSERT INTO resume_adaptations (
         user_id, job_id, job_title, confirmed_requirements, draft_content
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        jobId,
        job.title,
        JSON.stringify(confirmedRequirements),
        draftContent,
      ],
    );

    const insertResult = result as { insertId: number | bigint };

    return NextResponse.json(
      {
        success: true,
        adaptation: {
          id: String(insertResult.insertId),
          jobId,
          jobTitle: job.title,
          confirmedRequirements,
          draftContent,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "El cuerpo debe ser JSON válido" },
        { status: 400 },
      );
    }

    console.error("Failed to create resume adaptation:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo guardar el borrador adaptado" },
      { status: 500 },
    );
  }
}


export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const userId = Number(session.user.id);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return NextResponse.json(
      { success: false, error: "La sesión no contiene un usuario válido" },
      { status: 401 },
    );
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "El cuerpo de la solicitud no es válido" },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const rawId = data.id;
    const draftContent = data.draftContent;

    const adaptationId =
      typeof rawId === "string" || typeof rawId === "number"
        ? String(rawId)
        : "";

    if (
      !/^[1-9][0-9]{0,19}$/.test(adaptationId)
    ) {
      return NextResponse.json(
        { success: false, error: "El identificador del borrador no es válido" },
        { status: 400 },
      );
    }

    if (
      typeof draftContent !== "string" ||
      draftContent.trim().length === 0 ||
      draftContent.length > 100000
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "El borrador no puede estar vacío ni superar 100,000 caracteres",
        },
        { status: 400 },
      );
    }

    // La propiedad se comprueba antes de actualizar.
    const [ownedRows] = await pool.execute(
      `SELECT id
       FROM resume_adaptations
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [adaptationId, userId],
    );

    if ((ownedRows as Array<{ id: number | bigint }>).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "El borrador no existe o no tienes permiso para modificarlo",
        },
        { status: 404 },
      );
    }

    await pool.execute(
      `UPDATE resume_adaptations
       SET draft_content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [draftContent, adaptationId, userId],
    );

    const [updatedRows] = await pool.execute(
      `SELECT updated_at
       FROM resume_adaptations
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [adaptationId, userId],
    );

    const updatedAt = (
      updatedRows as Array<{ updated_at: Date | string }>
    )[0]?.updated_at;

    return NextResponse.json({
      success: true,
      id: adaptationId,
      updatedAt,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "El cuerpo debe ser JSON válido" },
        { status: 400 },
      );
    }

    console.error("Failed to update resume adaptation:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo guardar el borrador" },
      { status: 500 },
    );
  }
}
