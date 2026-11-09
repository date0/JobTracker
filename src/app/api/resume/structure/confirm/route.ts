import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import pool from "@/lib/db";

import {
  createResumeSourceSnapshot,
  hashResumeSourceSnapshot,
} from "@/lib/resume-source.server";

import { parseResumeStructure } from "@/lib/resume-parser";
import { reconcileResumeStructure } from "@/lib/resume-reconciliation";
import {
  ResumeStructureSchema,
  type ResumeSourceSnapshot,
} from "@/lib/resume-structure";

function getUserId(session: { user: { id: string } }): number | null {
  const userId = Number(session.user.id);

  return Number.isSafeInteger(userId) && userId > 0
    ? userId
    : null;
}

type PreviousStructureRow = {
  version: number;
  schema_version: number;
  source_hash: string;
  structure_json: string;
};

export async function POST(request: Request) {
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "El cuerpo de la solicitud no contiene JSON válido",
      },
      { status: 400 },
    );
  }

  const requestedHash =
    typeof body === "object" &&
    body !== null &&
    "source_hash" in body &&
    typeof body.source_hash === "string"
      ? body.source_hash
      : null;

  if (!requestedHash || !/^[a-f0-9]{64}$/.test(requestedHash)) {
    return NextResponse.json(
      {
        success: false,
        error: "Se requiere un hash SHA-256 válido de la vista previa",
      },
      { status: 400 },
    );
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let transactionOpen = true;

    try {
      // Lock the source CV row to prevent concurrent modifications
      // while the confirmed structure is being generated.
      const [profileRows] = await connection.execute(
        `SELECT
           headline,
           summary,
           experience,
           skills,
           education,
           certifications,
           full_name,
           phone,
           email,
           state,
           country,
           postal_code,
           linkedin,
           portfolio
         FROM resume_profiles
         WHERE user_id = ?
         LIMIT 1
         FOR UPDATE`,
        [userId],
      );

      const profiles = profileRows as ResumeSourceSnapshot[];
      const profile = profiles[0];

      if (!profile) {
        await connection.rollback();
        transactionOpen = false;

        return NextResponse.json(
          {
            success: false,
            error: "No existe un CV maestro para este usuario",
          },
          { status: 404 },
        );
      }

      const snapshot = createResumeSourceSnapshot(profile);
      const currentHash = hashResumeSourceSnapshot(snapshot);

      if (currentHash !== requestedHash) {
        await connection.rollback();
        transactionOpen = false;

        return NextResponse.json(
          {
            success: false,
            error:
              "El CV maestro cambió desde que se generó la vista previa. " +
              "Genera una nueva vista previa antes de confirmar.",
            code: "SOURCE_CHANGED",
          },
          { status: 409 },
        );
      }

      const [previousRows] = await connection.execute(
        `SELECT
           version,
           schema_version,
           source_hash,
           structure_json
         FROM resume_structures
         WHERE user_id = ?
         ORDER BY version DESC
         LIMIT 1
         FOR UPDATE`,
        [userId],
      );

      const previousStructures =
        previousRows as PreviousStructureRow[];

      const previousRow = previousStructures[0];
      let previousStructure = null;

      if (previousRow) {
        if (Number(previousRow.schema_version) !== 1) {
          await connection.rollback();
          transactionOpen = false;

          return NextResponse.json(
            {
              success: false,
              error:
                "La última estructura guardada utiliza una versión de esquema " +
                "no compatible. Se requiere revisar su integridad.",
            },
            { status: 409 },
          );
        }

        let decodedStructure: unknown;

        try {
          decodedStructure =
            typeof previousRow.structure_json === "string"
              ? JSON.parse(previousRow.structure_json)
              : previousRow.structure_json;
        } catch {
          console.error(
            "Stored resume structure contains invalid JSON.",
            { userId },
          );

          await connection.rollback();
          transactionOpen = false;

          return NextResponse.json(
            {
              success: false,
              error:
                "La estructura anterior contiene JSON inválido. " +
                "No se guardó una nueva versión.",
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

          await connection.rollback();
          transactionOpen = false;

          return NextResponse.json(
            {
              success: false,
              error:
                "La estructura anterior no cumple el esquema actual. " +
                "No se guardó una nueva versión.",
            },
            { status: 409 },
          );
        }

        previousStructure = validation.data;

        // Idempotency: do not create another version for the same source.
        if (previousRow.source_hash === currentHash) {
          await connection.commit();
          transactionOpen = false;

          return NextResponse.json({
            success: true,
            already_confirmed: true,
            version: Number(previousRow.version),
            source_hash: currentHash,
            message: "Esta versión del CV ya estaba confirmada.",
          });
        }
      }

      const parsed = parseResumeStructure(snapshot);

      const structure = reconcileResumeStructure(
        parsed.structure,
        previousStructure,
      );

      const nextVersion = previousRow
        ? Number(previousRow.version) + 1
        : 1;

      if (
        !Number.isSafeInteger(nextVersion) ||
        nextVersion < 1 ||
        nextVersion > 4294967295
      ) {
        await connection.rollback();
        transactionOpen = false;

        return NextResponse.json(
          {
            success: false,
            error: "No se pudo calcular un número de versión válido",
          },
          { status: 409 },
        );
      }

      await connection.execute(
        `INSERT INTO resume_structures (
           user_id,
           version,
           schema_version,
           source_hash,
           structure_json,
           confirmed_at
         )
         VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP)`,
        [
          userId,
          nextVersion,
          currentHash,
          JSON.stringify(structure),
        ],
      );

      await connection.commit();
      transactionOpen = false;

      return NextResponse.json({
        success: true,
        already_confirmed: false,
        version: nextVersion,
        source_hash: currentHash,
        message: "La estructura semántica del CV fue confirmada y guardada.",
      });
    } catch (error) {
      if (transactionOpen) {
        await connection.rollback();
      }

      throw error;
    }
  } catch (error) {
    console.error(
      "Failed to confirm semantic resume structure:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo confirmar y guardar la estructura del CV",
      },
      { status: 500 },
    );
  } finally {
    connection?.release();
  }
}
