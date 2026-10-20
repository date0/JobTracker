import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import pool from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const eventId = Number(id);

  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return NextResponse.json(
      { success: false, error: "El ID del evento no es válido" },
      { status: 400 },
    );
  }

  try {
    const [events] = await pool.execute<RowDataPacket[]>(
      `SELECT e.id
       FROM application_events e
       INNER JOIN applications a ON a.id = e.application_id
       WHERE e.id = ?
         AND a.user_id = ?
         AND e.event_type IN ('reminder', 'follow_up')
         AND e.completed_at IS NULL
       LIMIT 1`,
      [eventId, session.user.id],
    );

    if (events.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró un seguimiento pendiente",
        },
        { status: 404 },
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE application_events
       SET completed_at = NOW()
       WHERE id = ? AND completed_at IS NULL`,
      [eventId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "El seguimiento ya fue completado",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to complete application event:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo completar el seguimiento" },
      { status: 500 },
    );
  }
}
