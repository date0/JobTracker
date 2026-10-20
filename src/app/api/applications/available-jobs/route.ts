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
         j.id,
         j.title,
         j.location,
         j.work_mode,
         j.employment_type,
         j.source_url,
         c.name AS company_name
       FROM jobs j
       LEFT JOIN companies c ON c.id = j.company_id
       WHERE NOT EXISTS (
         SELECT 1
         FROM applications a
         WHERE a.job_id = j.id
           AND a.user_id = ?
       )
       ORDER BY j.created_at DESC, j.id DESC`,
      [session.user.id],
    );

    return NextResponse.json({
      success: true,
      jobs: rows,
    });
  } catch (error) {
    console.error("Failed to retrieve available jobs:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron consultar las vacantes disponibles",
      },
      { status: 500 },
    );
  }
}
