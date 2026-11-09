import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import pool from "@/lib/db";
import { ResumeStructureSchema } from "@/lib/resume-structure";

function getUserId(session: { user: { id: string } }): number | null {
  const userId = Number(session.user.id);

  return Number.isSafeInteger(userId) && userId > 0
    ? userId
    : null;
}

type HistoryRow = {
  version: number;
  schema_version: number;
  source_hash: string;
  confirmed_at: Date | string;
};

type StructureRow = HistoryRow & {
  structure_json: string;
};

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: "La sesión no contiene un usuario válido",
      },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const requestedVersion = url.searchParams.get("version");

  try {
    // Without a version parameter, return the history index.
    if (requestedVersion === null) {
      const [rows] = await pool.execute(
        `SELECT
           version,
           schema_version,
           source_hash,
           confirmed_at
         FROM resume_structures
         WHERE user_id = ?
         ORDER BY version DESC`,
        [userId],
      );

      const versions = rows as HistoryRow[];

      return NextResponse.json({
        success: true,
        versions: versions.map((item) => ({
          version: Number(item.version),
          schema_version: Number(item.schema_version),
          source_hash: item.source_hash,
          confirmed_at: item.confirmed_at,
        })),
      });
    }

    // Validate the requested version before querying the database.
    if (!/^[1-9]\d*$/.test(requestedVersion)) {
      return NextResponse.json(
        {
          success: false,
          error: "El número de versión no es válido",
        },
        { status: 400 },
      );
    }

    const version = Number(requestedVersion);

    if (!Number.isSafeInteger(version)) {
      return NextResponse.json(
        {
          success: false,
          error: "El número de versión está fuera del rango permitido",
        },
        { status: 400 },
      );
    }

    const [rows] = await pool.execute(
      `SELECT
         version,
         schema_version,
         source_hash,
         confirmed_at,
         structure_json
       FROM resume_structures
       WHERE user_id = ?
         AND version = ?
       LIMIT 1`,
      [userId, version],
    );

    const structures = rows as StructureRow[];
    const row = structures[0];

    if (!row) {
      return NextResponse.json(
        {
          success: false,
          error: "No existe esa versión del CV",
        },
        { status: 404 },
      );
    }

    if (Number(row.schema_version) !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Esta versión utiliza un esquema no compatible",
        },
        { status: 409 },
      );
    }

    let decoded: unknown;

    try {
      decoded =
        typeof row.structure_json === "string"
          ? JSON.parse(row.structure_json)
          : row.structure_json;
    } catch {
      console.error("Invalid JSON in stored resume structure.", {
        userId,
        version,
      });

      return NextResponse.json(
        {
          success: false,
          error: "La estructura guardada contiene JSON inválido",
        },
        { status: 409 },
      );
    }

    const validation = ResumeStructureSchema.safeParse(decoded);

    if (!validation.success) {
      console.error("Stored resume structure failed validation.", {
        userId,
        version,
        issues: validation.error.issues,
      });

      return NextResponse.json(
        {
          success: false,
          error: "La estructura guardada no cumple el esquema actual",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      version: Number(row.version),
      schema_version: Number(row.schema_version),
      source_hash: row.source_hash,
      confirmed_at: row.confirmed_at,
      structure: validation.data,
    });
  } catch (error) {
    console.error("Failed to retrieve resume structure history:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo consultar el historial del CV",
      },
      { status: 500 },
    );
  }
}
