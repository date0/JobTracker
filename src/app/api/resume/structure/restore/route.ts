import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import pool from "@/lib/db";

import {
  createResumeSourceSnapshot,
  hashResumeSourceSnapshot,
} from "@/lib/resume-source.server";

import {
  ResumeStructureSchema,
  type ResumeSourceSnapshot,
} from "@/lib/resume-structure";

const fields = {
  headline: 255,
  summary: 10000,
  experience: 50000,
  skills: 15000,
  education: 20000,
  certifications: 15000,
  full_name: 255,
  phone: 80,
  email: 320,
  state: 120,
  country: 120,
  postal_code: 20,
  linkedin: 500,
  portfolio: 1000,
} as const;

type ResumeField = keyof typeof fields;

type StructureRow = {
  version: number;
  schema_version: number;
  source_hash: string;
  structure_json: string;
};

function getUserId(session: { user: { id: string } }): number | null {
  const userId = Number(session.user.id);

  return Number.isSafeInteger(userId) && userId > 0
    ? userId
    : null;
}

function parseStoredStructure(value: unknown) {
  let decoded: unknown;

  try {
    decoded =
      typeof value === "string"
        ? JSON.parse(value)
        : value;
  } catch {
    return null;
  }

  const validation = ResumeStructureSchema.safeParse(decoded);

  return validation.success ? validation.data : null;
}

function validateSnapshotLengths(
  snapshot: ResumeSourceSnapshot,
): string | null {
  for (const field of Object.keys(fields) as ResumeField[]) {
    const value = snapshot[field];

    if (value !== null && value.length > fields[field]) {
      return (
        `El campo ${field} de la versión histórica supera ` +
        `el máximo permitido de ${fields[field]} caracteres.`
      );
    }
  }

  return null;
}

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

  const requestedVersion =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    "version" in body
      ? body.version
      : null;

  if (
    typeof requestedVersion !== "number" ||
    !Number.isSafeInteger(requestedVersion) ||
    requestedVersion < 1 ||
    requestedVersion > 4294967295
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Se requiere un número de versión válido",
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
      // Lock the current master CV before reading or changing its contents.
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
      const currentProfile = profiles[0] ?? null;

      // Only retrieve a historical version belonging to this user.
      const [targetRows] = await connection.execute(
        `SELECT
           version,
           schema_version,
           source_hash,
           structure_json
         FROM resume_structures
         WHERE user_id = ?
           AND version = ?
         LIMIT 1
         FOR UPDATE`,
        [userId, requestedVersion],
      );

      const targets = targetRows as StructureRow[];
      const target = targets[0];

      if (!target) {
        await connection.rollback();
        transactionOpen = false;

        return NextResponse.json(
          {
            success: false,
            error: "No existe esa versión del CV para este usuario",
          },
          { status: 404 },
        );
      }

      if (Number(target.schema_version) !== 1) {
        await connection.rollback();
        transactionOpen = false;

        return NextResponse.json(
          {
            success: false,
            error: "La versión seleccionada utiliza un esquema no compatible",
          },
          { status: 409 },
        );
      }

      const structure = parseStoredStructure(target.structure_json);

      if (!structure) {
        console.error("Stored resume structure failed validation.", {
          userId,
          version: requestedVersion,
        });

        await connection.rollback();
        transactionOpen = false;

        return NextResponse.json(
          {
            success: false,
            error: "La estructura histórica no es válida. No se modificó el CV.",
          },
          { status: 409 },
        );
      }

      const snapshot = createResumeSourceSnapshot(
        structure.source_snapshot,
      );

      const lengthError = validateSnapshotLengths(snapshot);

      if (lengthError) {
        await connection.rollback();
        transactionOpen = false;

        return NextResponse.json(
          {
            success: false,
            error: lengthError,
          },
          { status: 409 },
        );
      }

      const targetHash = hashResumeSourceSnapshot(snapshot);

      if (
        !/^[a-f0-9]{64}$/.test(target.source_hash) ||
        targetHash !== target.source_hash
      ) {
        console.error("Stored resume snapshot hash mismatch.", {
          userId,
          version: requestedVersion,
        });

        await connection.rollback();
        transactionOpen = false;

        return NextResponse.json(
          {
            success: false,
            error:
              "El contenido de la versión histórica no coincide con su hash. " +
              "No se modificó el CV.",
          },
          { status: 409 },
        );
      }

      // Lock the latest confirmed version to serialize version creation.
      const [latestRows] = await connection.execute(
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

      const latestVersions = latestRows as StructureRow[];
      const latest = latestVersions[0] ?? null;

      const currentHash = currentProfile
        ? hashResumeSourceSnapshot(
            createResumeSourceSnapshot(currentProfile),
          )
        : null;

      const masterAlreadyMatches = currentHash === targetHash;
      const historyAlreadyMatches = latest?.source_hash === targetHash;

      // If both the master and latest history already represent this
      // snapshot, the operation is idempotent.
      if (masterAlreadyMatches && historyAlreadyMatches) {
        await connection.commit();
        transactionOpen = false;

        return NextResponse.json({
          success: true,
          restored: false,
          already_current: true,
          restored_from_version: requestedVersion,
          version: Number(latest.version),
          source_hash: targetHash,
          message: "El CV maestro ya corresponde a esa versión.",
        });
      }

      // Restore the exact 14 source fields. Do not trim or normalize them.
      await connection.execute(
        `INSERT INTO resume_profiles (
           user_id,
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
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           headline = VALUES(headline),
           summary = VALUES(summary),
           experience = VALUES(experience),
           skills = VALUES(skills),
           education = VALUES(education),
           certifications = VALUES(certifications),
           full_name = VALUES(full_name),
           phone = VALUES(phone),
           email = VALUES(email),
           state = VALUES(state),
           country = VALUES(country),
           postal_code = VALUES(postal_code),
           linkedin = VALUES(linkedin),
           portfolio = VALUES(portfolio)`,
        [
          userId,
          snapshot.headline,
          snapshot.summary,
          snapshot.experience,
          snapshot.skills,
          snapshot.education,
          snapshot.certifications,
          snapshot.full_name,
          snapshot.phone,
          snapshot.email,
          snapshot.state,
          snapshot.country,
          snapshot.postal_code,
          snapshot.linkedin,
          snapshot.portfolio,
        ],
      );

      // If the latest history entry already represents the target
      // snapshot, updating the master is sufficient; do not duplicate it.
      if (historyAlreadyMatches && latest) {
        await connection.commit();
        transactionOpen = false;

        return NextResponse.json({
          success: true,
          restored: true,
          already_current: false,
          history_entry_created: false,
          restored_from_version: requestedVersion,
          version: Number(latest.version),
          source_hash: targetHash,
          message:
            "El CV maestro fue restaurado. El historial ya contenía " +
            "una versión confirmada con ese contenido.",
        });
      }

      const nextVersion = latest
        ? Number(latest.version) + 1
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

      // Preserve the exact historical semantic structure and its IDs.
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
          targetHash,
          JSON.stringify(structure),
        ],
      );

      await connection.commit();
      transactionOpen = false;

      return NextResponse.json({
        success: true,
        restored: true,
        already_current: false,
        history_entry_created: true,
        restored_from_version: requestedVersion,
        version: nextVersion,
        source_hash: targetHash,
        message:
          "El CV maestro fue restaurado y guardado como una nueva versión.",
      });
    } catch (error) {
      if (transactionOpen) {
        await connection.rollback();
      }

      throw error;
    }
  } catch (error) {
    console.error("Failed to restore historical resume version:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo restaurar la versión histórica del CV",
      },
      { status: 500 },
    );
  } finally {
    connection?.release();
  }
}
