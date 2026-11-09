import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import pool from "@/lib/db";

import {
  hashResumeSourceSnapshot,
  loadResumeSourceSnapshot,
} from "@/lib/resume-source.server";

import { parseResumeStructure } from "@/lib/resume-parser";
import { reconcileResumeStructure } from "@/lib/resume-reconciliation";
import { ResumeStructureSchema } from "@/lib/resume-structure";

function getUserId(session: { user: { id: string } }): number | null {
  const userId = Number(session.user.id);

  return Number.isSafeInteger(userId) && userId > 0
    ? userId
    : null;
}

export async function POST() {
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

  try {
    const snapshot = await loadResumeSourceSnapshot(userId);

    if (!snapshot) {
      return NextResponse.json(
        {
          success: false,
          error: "No existe un CV maestro para este usuario",
        },
        { status: 404 },
      );
    }

    const sourceHash = hashResumeSourceSnapshot(snapshot);
    const parsed = parseResumeStructure(snapshot);

    const [rows] = await pool.execute(
      `SELECT structure_json
       FROM resume_structures
       WHERE user_id = ?
       ORDER BY version DESC
       LIMIT 1`,
      [userId],
    );

    const previousRows = rows as Array<{
      structure_json: string;
    }>;

    let previousStructure = null;

    if (previousRows.length > 0) {
      const storedStructure = previousRows[0].structure_json;

      let decodedStructure: unknown;

      try {
        decodedStructure =
          typeof storedStructure === "string"
            ? JSON.parse(storedStructure)
            : storedStructure;
      } catch {
        console.error(
          "Stored resume structure contains invalid JSON.",
          { userId },
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "La estructura anterior del CV contiene JSON inválido. " +
              "No se generó una nueva propuesta para proteger sus identificadores.",
          },
          { status: 409 },
        );
      }

      const validation =
        ResumeStructureSchema.safeParse(decodedStructure);

      if (!validation.success) {
        console.error(
          "Stored resume structure failed schema validation.",
          {
            userId,
            issues: validation.error.issues,
          },
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "La estructura anterior del CV no cumple el esquema actual. " +
              "Se requiere revisar su integridad antes de continuar.",
          },
          { status: 409 },
        );
      }

      previousStructure = validation.data;
    }

    const structure = reconcileResumeStructure(
      parsed.structure,
      previousStructure,
    );

    return NextResponse.json({
      success: true,
      source_hash: sourceHash,
      structure,
      warnings: parsed.warnings,
      unparsed: parsed.unparsed,
      previous_version_found: previousStructure !== null,
    });
  } catch (error) {
    console.error(
      "Failed to generate semantic resume preview:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo generar la vista previa de la estructura del CV",
      },
      { status: 500 },
    );
  }
}
