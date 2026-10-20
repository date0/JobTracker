import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { auth } from "@/../auth";

const allowedTypes = ["virtual", "onsite", "phone"] as const;

function isValidDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );

  if (!match) return false;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  return (
    Number(year) >= 2000 &&
    Number(year) <= 2100 &&
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    date.getHours() === Number(hour) &&
    date.getMinutes() === Number(minute)
  );
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  try {
    const [rows] = await pool.execute(
      `SELECT
         i.id,
         i.application_id,
         i.scheduled_at,
         i.duration_minutes,
         i.interview_type,
         i.meeting_url,
         i.location,
         i.interviewer_name,
         i.interviewer_contact,
         i.status,
         i.result,
         i.preparation_notes,
         i.questions_to_ask,
         i.post_interview_notes,
         i.created_at,
         i.updated_at,
         j.title AS job_title,
         c.name AS company_name
       FROM interviews i
       INNER JOIN applications a ON a.id = i.application_id
       INNER JOIN jobs j ON j.id = a.job_id
       LEFT JOIN companies c ON c.id = j.company_id
       WHERE a.user_id = ?
       ORDER BY
         CASE WHEN i.scheduled_at >= NOW() AND i.status = 'scheduled'
           THEN 0 ELSE 1 END,
         i.scheduled_at ASC,
         i.id DESC`,
      [session.user.id],
    );

    return NextResponse.json({ success: true, interviews: rows });
  } catch (error) {
    console.error("Failed to retrieve interviews:", error);

    return NextResponse.json(
      { success: false, error: "No se pudieron consultar las entrevistas" },
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
    const applicationId = Number(body.application_id);

    if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
      return NextResponse.json(
        { success: false, error: "Selecciona una candidatura válida" },
        { status: 400 },
      );
    }

    if (!isValidDateTime(body.scheduled_at)) {
      return NextResponse.json(
        { success: false, error: "La fecha y hora no son válidas" },
        { status: 400 },
      );
    }

    const interviewType = body.interview_type ?? "virtual";

    if (
      typeof interviewType !== "string" ||
      !allowedTypes.includes(interviewType as (typeof allowedTypes)[number])
    ) {
      return NextResponse.json(
        { success: false, error: "La modalidad no es válida" },
        { status: 400 },
      );
    }

    const duration =
      body.duration_minutes === "" || body.duration_minutes == null
        ? null
        : Number(body.duration_minutes);

    if (
      duration !== null &&
      (!Number.isInteger(duration) || duration < 1 || duration > 1440)
    ) {
      return NextResponse.json(
        { success: false, error: "La duración debe estar entre 1 y 1440 minutos" },
        { status: 400 },
      );
    }

    const optionalTextFields = [
      "meeting_url",
      "location",
      "interviewer_name",
      "interviewer_contact",
      "preparation_notes",
      "questions_to_ask",
      "post_interview_notes",
    ] as const;

    const values: Record<(typeof optionalTextFields)[number], string | null> = {
      meeting_url: null,
      location: null,
      interviewer_name: null,
      interviewer_contact: null,
      preparation_notes: null,
      questions_to_ask: null,
      post_interview_notes: null,
    };

    const limits: Record<(typeof optionalTextFields)[number], number> = {
      meeting_url: 2048,
      location: 500,
      interviewer_name: 200,
      interviewer_contact: 320,
      preparation_notes: 65535,
      questions_to_ask: 65535,
      post_interview_notes: 65535,
    };

    for (const field of optionalTextFields) {
      const rawValue = body[field];

      if (rawValue != null && typeof rawValue !== "string") {
        return NextResponse.json(
          { success: false, error: `El campo ${field} no es válido` },
          { status: 400 },
        );
      }

      const value =
        typeof rawValue === "string" ? rawValue.trim() : "";

      if (value.length > limits[field]) {
        return NextResponse.json(
          { success: false, error: `El campo ${field} es demasiado largo` },
          { status: 400 },
        );
      }

      values[field] = value || null;
    }

    if (
      values.meeting_url &&
      !/^https?:\/\/\S+$/i.test(values.meeting_url)
    ) {
      return NextResponse.json(
        { success: false, error: "El enlace debe comenzar con http:// o https://" },
        { status: 400 },
      );
    }

    const [applications] = await pool.execute(
      "SELECT id FROM applications WHERE id = ? AND user_id = ? LIMIT 1",
      [applicationId, session.user.id],
    );

    if ((applications as Array<{ id: number }>).length === 0) {
      return NextResponse.json(
        { success: false, error: "La candidatura no existe o no tienes acceso a ella" },
        { status: 404 },
      );
    }

    const scheduledAt = `${body.scheduled_at.replace("T", " ")}:00`;

    const [result] = await pool.execute(
      `INSERT INTO interviews (
         application_id,
         scheduled_at,
         duration_minutes,
         interview_type,
         meeting_url,
         location,
         interviewer_name,
         interviewer_contact,
         preparation_notes,
         questions_to_ask,
         post_interview_notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        applicationId,
        scheduledAt,
        duration,
        interviewType,
        values.meeting_url,
        values.location,
        values.interviewer_name,
        values.interviewer_contact,
        values.preparation_notes,
        values.questions_to_ask,
        values.post_interview_notes,
      ],
    );

    return NextResponse.json(
      {
        success: true,
        interviewId: (result as { insertId: number }).insertId,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "El contenido de la solicitud no es válido" },
        { status: 400 },
      );
    }

    console.error("Failed to create interview:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo registrar la entrevista" },
      { status: 500 },
    );
  }
}
