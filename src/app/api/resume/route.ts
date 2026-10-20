import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import pool from "@/lib/db";

type ResumeProfile = {
  id: number;
  user_id: number;
  headline: string | null;
  summary: string | null;
  experience: string | null;
  skills: string | null;
  education: string | null;
  certifications: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  linkedin: string | null;
  portfolio: string | null;
  created_at: Date;
  updated_at: Date;
};

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

function getUserId(session: { user: { id: string } }): number | null {
  const userId = Number(session.user.id);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

export async function GET() {
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
      { success: false, error: "La sesión no contiene un usuario válido" },
      { status: 401 },
    );
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, user_id, headline, summary, experience, skills,
              education, certifications, full_name, phone, email, state,
              country, postal_code, linkedin, portfolio, created_at, updated_at
       FROM resume_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    const profiles = rows as ResumeProfile[];

    return NextResponse.json({
      success: true,
      profile: profiles[0] ?? null,
    });
  } catch (error) {
    console.error("Failed to retrieve resume profile:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo consultar el CV" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
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
      { success: false, error: "La sesión no contiene un usuario válido" },
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
    const values: Record<ResumeField, string | null> = {
      headline: null,
      summary: null,
      experience: null,
      skills: null,
      education: null,
      certifications: null,
      full_name: null,
      phone: null,
      email: null,
      state: null,
      country: null,
      postal_code: null,
      linkedin: null,
      portfolio: null,
    };

    for (const field of Object.keys(fields) as ResumeField[]) {
      const value = data[field];

      if (value !== undefined && value !== null && typeof value !== "string") {
        return NextResponse.json(
          { success: false, error: `El campo ${field} debe ser texto` },
          { status: 400 },
        );
      }

      const normalized = typeof value === "string" ? value.trim() : "";

      if (normalized.length > fields[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `El campo ${field} supera el máximo de ${fields[field]} caracteres`,
          },
          { status: 400 },
        );
      }

      values[field] = normalized || null;
    }

    await pool.execute(
      `INSERT INTO resume_profiles
         (user_id, headline, summary, experience, skills, education, certifications,
          full_name, phone, email, state, country, postal_code, linkedin, portfolio)
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
        values.headline,
        values.summary,
        values.experience,
        values.skills,
        values.education,
        values.certifications,
        values.full_name,
        values.phone,
        values.email,
        values.state,
        values.country,
        values.postal_code,
        values.linkedin,
        values.portfolio,
      ],
    );

    return NextResponse.json({
      success: true,
      message: "CV guardado correctamente",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "El cuerpo debe ser JSON válido" },
        { status: 400 },
      );
    }

    console.error("Failed to save resume profile:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo guardar el CV" },
      { status: 500 },
    );
  }
}
