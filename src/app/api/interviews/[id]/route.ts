import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { auth } from "@/../auth";

const allowedTypes = ["virtual", "onsite", "phone"] as const;
const allowedStatuses = ["scheduled", "completed", "cancelled", "rescheduled"] as const;

const allowedResults = [
  "pending",
  "awaiting_response",
  "next_round",
  "offer_received",
  "rejected",
  "withdrawn",
] as const;

function isValidDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  let connection;

  try {
    const { id: rawId } = await context.params;
    const interviewId = Number(rawId);

    if (!Number.isSafeInteger(interviewId) || interviewId <= 0) {
      return NextResponse.json(
        { success: false, error: "El identificador de entrevista no es válido" },
        { status: 400 },
      );
    }

    const body = await request.json();

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

    const status = body.status ?? "scheduled";

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status as (typeof allowedStatuses)[number])
    ) {
      return NextResponse.json(
        { success: false, error: "El estado de la entrevista no es válido" },
        { status: 400 },
      );
    }

    const result = body.result ?? "pending";

    if (
      typeof result !== "string" ||
      !allowedResults.includes(result as (typeof allowedResults)[number])
    ) {
      return NextResponse.json(
        { success: false, error: "El resultado de la entrevista no es válido" },
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

    const limits: Record<(typeof optionalTextFields)[number], number> = {
      meeting_url: 2048,
      location: 500,
      interviewer_name: 200,
      interviewer_contact: 320,
      preparation_notes: 65535,
      questions_to_ask: 65535,
      post_interview_notes: 65535,
    };

    const values: Record<(typeof optionalTextFields)[number], string | null> = {
      meeting_url: null,
      location: null,
      interviewer_name: null,
      interviewer_contact: null,
      preparation_notes: null,
      questions_to_ask: null,
      post_interview_notes: null,
    };

    for (const field of optionalTextFields) {
      const rawValue = body[field];

      if (rawValue != null && typeof rawValue !== "string") {
        return NextResponse.json(
          { success: false, error: `El campo ${field} no es válido` },
          { status: 400 },
        );
      }

      const value = typeof rawValue === "string" ? rawValue.trim() : "";

      if (value.length > limits[field]) {
        return NextResponse.json(
          { success: false, error: `El campo ${field} es demasiado largo` },
          { status: 400 },
        );
      }

      values[field] = value || null;
    }

    if (values.meeting_url && !/^https?:\/\/\S+$/i.test(values.meeting_url)) {
      return NextResponse.json(
        { success: false, error: "El enlace debe comenzar con http:// o https://" },
        { status: 400 },
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT i.id
       FROM interviews i
       INNER JOIN applications a ON a.id = i.application_id
       WHERE i.id = ? AND a.user_id = ?
       FOR UPDATE`,
      [interviewId, session.user.id],
    );

    if ((rows as Array<{ id: number }>).length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { success: false, error: "La entrevista no existe o no tienes acceso a ella" },
        { status: 404 },
      );
    }

    const scheduledAt = `${body.scheduled_at.replace("T", " ")}:00`;

    await connection.execute(
      `UPDATE interviews
       SET scheduled_at = ?,
           duration_minutes = ?,
           interview_type = ?,
           meeting_url = ?,
           location = ?,
           interviewer_name = ?,
           interviewer_contact = ?,
           status = ?,
           result = ?,
           preparation_notes = ?,
           questions_to_ask = ?,
           post_interview_notes = ?
       WHERE id = ?`,
      [
        scheduledAt,
        duration,
        interviewType,
        values.meeting_url,
        values.location,
        values.interviewer_name,
        values.interviewer_contact,
        status,
        result,
        values.preparation_notes,
        values.questions_to_ask,
        values.post_interview_notes,
        interviewId,
      ],
    );

    await connection.commit();

    return NextResponse.json({ success: true, interviewId });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "El contenido de la solicitud no es válido" },
        { status: 400 },
      );
    }

    console.error("Failed to update interview:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo actualizar la entrevista" },
      { status: 500 },
    );
  } finally {
    connection?.release();
  }
}
