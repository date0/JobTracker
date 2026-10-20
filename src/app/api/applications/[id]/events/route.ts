import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { auth } from "@/../auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const applicationId = Number(id);

  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
    return NextResponse.json(
      { success: false, error: "El ID de la candidatura no es válido" },
      { status: 400 },
    );
  }

  try {
    const [applications] = await pool.execute(
      `SELECT id
       FROM applications
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [applicationId, session.user.id],
    );

    if ((applications as Array<{ id: number }>).length === 0) {
      return NextResponse.json(
        { success: false, error: "No se encontró la candidatura" },
        { status: 404 },
      );
    }

    const [events] = await pool.execute(
      `SELECT id, event_type, title, details, event_at, created_at
       FROM application_events
       WHERE application_id = ?
       ORDER BY COALESCE(event_at, created_at) DESC, id DESC`,
      [applicationId],
    );

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Failed to retrieve application events:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo consultar el historial" },
      { status: 500 },
    );
  }
}
export async function POST(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const applicationId = Number(id);

  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
    return NextResponse.json(
      { success: false, error: "El ID de la candidatura no es válido" },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const { event_type, title, details, event_at } = body;

    const allowedTypes = [
      "note",
      "follow_up",
      "interview",
      "reminder",
      "other",
    ];

    if (!allowedTypes.includes(event_type)) {
      return NextResponse.json(
        { success: false, error: "El tipo de evento no es válido" },
        { status: 400 },
      );
    }

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 200
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "El título es obligatorio y debe tener máximo 200 caracteres",
        },
        { status: 400 },
      );
    }

    if (details != null && typeof details !== "string") {
      return NextResponse.json(
        { success: false, error: "Los detalles no son válidos" },
        { status: 400 },
      );
    }

    let normalizedEventAt: string | null = null;

    if (event_at != null) {
      if (typeof event_at !== "string") {
        return NextResponse.json(
          { success: false, error: "La fecha del evento no es válida" },
          { status: 400 },
        );
      }

      const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(event_at);

      if (!match) {
        return NextResponse.json(
          { success: false, error: "La fecha debe tener un formato válido" },
          { status: 400 },
        );
      }

      const [, year, month, day, hour, minute] = match;
      const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
      );

      const validDate =
        Number(year) >= 2000 &&
        Number(year) <= 2100 &&
        date.getFullYear() === Number(year) &&
        date.getMonth() === Number(month) - 1 &&
        date.getDate() === Number(day) &&
        date.getHours() === Number(hour) &&
        date.getMinutes() === Number(minute);

      if (!validDate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "La fecha debe estar entre los años 2000 y 2100 y ser válida",
          },
          { status: 400 },
        );
      }

      normalizedEventAt = `${event_at.replace("T", " ")}:00`;
    }

    const [applications] = await pool.execute(
      `SELECT id
       FROM applications
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [applicationId, session.user.id],
    );

    if ((applications as Array<{ id: number }>).length === 0) {
      return NextResponse.json(
        { success: false, error: "No se encontró la candidatura" },
        { status: 404 },
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO application_events
        (application_id, event_type, title, details, event_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        applicationId,
        event_type,
        title.trim(),
        typeof details === "string" && details.trim() ? details.trim() : null,
        normalizedEventAt,
      ],
    );

    return NextResponse.json(
      {
        success: true,
        eventId: (result as { insertId: number | bigint }).insertId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create application event:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo registrar el evento" },
      { status: 500 },
    );
  }
}
