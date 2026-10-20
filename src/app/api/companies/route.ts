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
      `SELECT id, name, website, description, created_at, updated_at
       FROM companies
       ORDER BY name ASC`,
    );

    return NextResponse.json({ success: true, companies: rows });
  } catch (error) {
    console.error("Failed to retrieve companies:", error);

    return NextResponse.json(
      { success: false, error: "No se pudieron consultar las empresas" },
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
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const website = typeof data.website === "string" ? data.website.trim() : "";
    const description =
      typeof data.description === "string" ? data.description.trim() : "";

    if (!name || name.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: "El nombre es obligatorio y admite hasta 200 caracteres",
        },
        { status: 400 },
      );
    }

    if (website.length > 2048) {
      return NextResponse.json(
        { success: false, error: "El sitio web admite hasta 2048 caracteres" },
        { status: 400 },
      );
    }

    if (website) {
      try {
        const parsedWebsite = new URL(website);
        if (!["http:", "https:"].includes(parsedWebsite.protocol)) {
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

    if (description.length > 65535) {
      return NextResponse.json(
        { success: false, error: "La descripción es demasiado larga" },
        { status: 400 },
      );
    }

    const [result] = await pool.execute(
      "INSERT INTO companies (name, website, description) VALUES (?, ?, ?)",
      [name, website || null, description || null],
    );

    const insertResult = result as { insertId: number | bigint };

    return NextResponse.json(
      {
        success: true,
        company: {
          id: String(insertResult.insertId),
          name,
          website: website || null,
          description: description || null,
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

    console.error("Failed to create company:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo registrar la empresa" },
      { status: 500 },
    );
  }
}
