import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import pool from "@/lib/db";

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
         j.id,
         j.title,
         c.name AS company_name,
         j.description,
         j.location,
         j.work_mode,
         j.employment_type,
         j.created_at
       FROM jobs j
       LEFT JOIN companies c ON c.id = j.company_id
       WHERE j.created_by = ? OR j.created_by IS NULL
       ORDER BY j.created_at DESC, j.id DESC`,
      [userId],
    );

    return NextResponse.json({ success: true, jobs: rows });
  } catch (error) {
    console.error("Failed to retrieve analyzable jobs:", error);

    return NextResponse.json(
      { success: false, error: "No se pudieron consultar las vacantes" },
      { status: 500 },
    );
  }
}
