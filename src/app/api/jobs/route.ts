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
         j.company_id,
         c.name AS company_name,
         j.title,
         j.description,
         j.source_url,
         j.source_site,
         j.location,
         j.work_mode,
         j.employment_type,
         j.salary_min,
         j.salary_max,
         j.salary_currency,
         j.posted_at,
         j.expires_at,
         j.created_at
       FROM jobs j
       LEFT JOIN companies c ON c.id = j.company_id
       ORDER BY j.created_at DESC, j.id DESC`,
    );

    return NextResponse.json({ success: true, jobs: rows });
  } catch (error) {
    console.error("Failed to retrieve jobs:", error);

    return NextResponse.json(
      { success: false, error: "No se pudieron consultar las vacantes" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "El cuerpo de la solicitud no es válido" },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    const title = typeof data.title === "string" ? data.title.trim() : "";
    const description =
      typeof data.description === "string" ? data.description.trim() : "";
    const sourceUrl =
      typeof data.source_url === "string" ? data.source_url.trim() : "";
    const location =
      typeof data.location === "string" ? data.location.trim() : "";
    const employmentType =
      typeof data.employment_type === "string"
        ? data.employment_type.trim()
        : "";
    const workMode =
      typeof data.work_mode === "string" ? data.work_mode : "unknown";

    const allowedWorkModes = ["onsite", "hybrid", "remote", "unknown"];

    if (!title || title.length > 255) {
      return NextResponse.json(
        {
          success: false,
          error: "El título es obligatorio y admite hasta 255 caracteres",
        },
        { status: 400 },
      );
    }

    if (description.length > 16777215) {
      return NextResponse.json(
        { success: false, error: "La descripción es demasiado larga" },
        { status: 400 },
      );
    }

    if (sourceUrl.length > 2048) {
      return NextResponse.json(
        { success: false, error: "La URL admite hasta 2048 caracteres" },
        { status: 400 },
      );
    }

    if (sourceUrl) {
      try {
        const parsedUrl = new URL(sourceUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Protocolo no permitido");
        }
      } catch {
        return NextResponse.json(
          {
            success: false,
            error:
              "Introduce una URL válida que comience con http:// o https://",
          },
          { status: 400 },
        );
      }
    }

    if (location.length > 255 || employmentType.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La ubicación o el tipo de empleo exceden la longitud permitida",
        },
        { status: 400 },
      );
    }

    if (!allowedWorkModes.includes(workMode)) {
      return NextResponse.json(
        { success: false, error: "La modalidad de trabajo no es válida" },
        { status: 400 },
      );
    }

    let companyId: number | null = null;

    if (
      data.company_id !== undefined &&
      data.company_id !== null &&
      data.company_id !== ""
    ) {
      const parsedCompanyId = Number(data.company_id);

      if (!Number.isSafeInteger(parsedCompanyId) || parsedCompanyId <= 0) {
        return NextResponse.json(
          { success: false, error: "La empresa seleccionada no es válida" },
          { status: 400 },
        );
      }

      const [companyRows] = await pool.execute(
        "SELECT id FROM companies WHERE id = ? LIMIT 1",
        [parsedCompanyId],
      );

      if ((companyRows as { id: number }[]).length === 0) {
        return NextResponse.json(
          { success: false, error: "La empresa seleccionada no existe" },
          { status: 400 },
        );
      }

      companyId = parsedCompanyId;
    }

    const normalizedUrl = sourceUrl
      ? (() => {
          const parsedUrl = new URL(sourceUrl);
          parsedUrl.hash = "";
          for (const key of [...parsedUrl.searchParams.keys()]) {
            if (/^(utm_.+|fbclid|gclid)$/i.test(key)) {
              parsedUrl.searchParams.delete(key);
            }
          }
          return parsedUrl.toString();
        })()
      : null;

    const sourceSite = sourceUrl
      ? new URL(sourceUrl).hostname.slice(0, 150)
      : null;

    const [result] = await pool.execute(
      `INSERT INTO jobs (
         company_id, title, description, source_url, normalized_url,
         source_site, location, work_mode, employment_type, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        title,
        description || null,
        sourceUrl || null,
        normalizedUrl,
        sourceSite,
        location || null,
        workMode,
        employmentType || null,
        Number(session.user.id),
      ],
    );

    const insertResult = result as { insertId: number | bigint };

    return NextResponse.json(
      {
        success: true,
        job: {
          id: String(insertResult.insertId),
          company_id: companyId,
          title,
          description: description || null,
          source_url: sourceUrl || null,
          location: location || null,
          work_mode: workMode,
          employment_type: employmentType || null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: "El cuerpo de la solicitud debe ser JSON válido",
        },
        { status: 400 },
      );
    }

    console.error("Failed to create job:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo registrar la vacante" },
      { status: 500 },
    );
  }
}
