import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { auth } from "@/../auth";

const allowedStatuses = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;

type ApplicationStatus = (typeof allowedStatuses)[number];

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ApplicationRow = {
  id: number;
  status: ApplicationStatus;
};

type UpdateResult = {
  affectedRows: number;
};

export async function PATCH(request: Request, context: RouteContext) {
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

  let body: { status?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "El contenido de la solicitud no es válido" },
      { status: 400 },
    );
  }

  const status = body.status;

  if (
    typeof status !== "string" ||
    !allowedStatuses.includes(status as ApplicationStatus)
  ) {
    return NextResponse.json(
      { success: false, error: "El estado de la candidatura no es válido" },
      { status: 400 },
    );
  }

  const newStatus = status as ApplicationStatus;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, status
       FROM applications
       WHERE id = ? AND user_id = ?
       FOR UPDATE`,
      [applicationId, session.user.id],
    );

    const applications = rows as ApplicationRow[];

    if (applications.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { success: false, error: "No se encontró la candidatura" },
        { status: 404 },
      );
    }

    const previousStatus = applications[0].status;

    if (previousStatus === newStatus) {
      await connection.commit();

      return NextResponse.json({
        success: true,
        changed: false,
      });
    }

    await connection.execute(
      `UPDATE applications
       SET status = ?
       WHERE id = ? AND user_id = ?`,
      [newStatus, applicationId, session.user.id],
    );

    await connection.execute(
      `INSERT INTO application_events
         (application_id, event_type, title, details, event_at)
       VALUES (?, 'status_change', ?, ?, NOW())`,
      [
        applicationId,
        "Cambio de estado",
        `Estado anterior: ${previousStatus}; estado nuevo: ${newStatus}`,
      ],
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      changed: true,
    });
  } catch (error) {
    await connection.rollback();

    console.error("Failed to update application status and history:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo actualizar el estado y su historial",
      },
      { status: 500 },
    );
  } finally {
    connection.release();
  }
}
