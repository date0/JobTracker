import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { auth } from "@/../auth";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         a.id,
         a.job_id,
         a.status,
         a.applied_at,
         a.personal_notes,
         a.created_at,
         a.updated_at,
         j.title AS job_title,
         j.location,
         j.work_mode,
         j.source_url,
         c.name AS company_name
       FROM applications a
       INNER JOIN jobs j ON j.id = a.job_id
       LEFT JOIN companies c ON c.id = j.company_id
       WHERE a.user_id = ?
       ORDER BY a.updated_at DESC, a.id DESC`,
      [session.user.id],
    );

    return NextResponse.json({
      success: true,
      applications: rows,
    });
  } catch (error) {
    console.error("Failed to retrieve applications:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron consultar las candidaturas",
      },
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

  try {
    const body = await request.json();
    const jobId = Number(body.job_id);
    const allowedStatuses = [
      "saved",
      "applied",
      "interviewing",
      "offer",
      "rejected",
      "withdrawn",
    ];

    if (!Number.isSafeInteger(jobId) || jobId <= 0) {
      return NextResponse.json(
        { success: false, error: "Selecciona una vacante válida" },
        { status: 400 },
      );
    }

    const status = body.status ?? "saved";

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "El estado de la candidatura no es válido" },
        { status: 400 },
      );
    }

    const personalNotes =
      typeof body.personal_notes === "string" ? body.personal_notes.trim() : "";

    if (personalNotes.length > 65535) {
      return NextResponse.json(
        { success: false, error: "Las notas son demasiado largas" },
        { status: 400 },
      );
    }

    const [jobs] = await pool.query(
      "SELECT id FROM jobs WHERE id = ? LIMIT 1",
      [jobId],
    );

    if ((jobs as Array<{ id: number }>).length === 0) {
      return NextResponse.json(
        { success: false, error: "La vacante seleccionada no existe" },
        { status: 404 },
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO applications
         (user_id, job_id, status, personal_notes)
       VALUES (?, ?, ?, ?)`,
      [session.user.id, jobId, status, personalNotes || null],
    );

    return NextResponse.json(
      {
        success: true,
        applicationId: (result as { insertId: number }).insertId,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Ya tienes una candidatura registrada para esta vacante",
        },
        { status: 409 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "El contenido de la solicitud no es válido" },
        { status: 400 },
      );
    }

    console.error("Failed to create application:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo registrar la candidatura" },
      { status: 500 },
    );
  }
}
