import { NextResponse } from "next/server";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import { auth } from "@/../auth";
import pool from "@/lib/db";


type AdaptationRow = {
  id: number | bigint | string;
  job_title: string;
  draft_content: string;
};

type Section = {
  heading: string;
  lines: string[];
};

const KNOWN_HEADINGS = new Set([
  "NOMBRE COMPLETO",
  "DATOS DE CONTACTO",
  "TÍTULO PROFESIONAL",
  "RESUMEN PROFESIONAL",
  "EXPERIENCIA LABORAL",
  "HABILIDADES Y REQUISITOS RELEVANTES CONFIRMADOS POR EL USUARIO",
  "HABILIDADES Y TECNOLOGÍAS DEL CV MAESTRO",
  "FORMACIÓN ACADÉMICA",
  "CERTIFICACIONES Y CURSOS",
  "PERFIL PROFESIONAL",
  "HABILIDADES",
  "EXPERIENCIA",
  "EDUCACIÓN",
  "FORMACIÓN ACADÉMICA",
  "CERTIFICACIONES",
  "IDIOMAS",
  "PROYECTOS",
]);

function safeFilename(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || "CV-adaptado";
}

function parseDraft(content: string): {
  title: string;
  sections: Section[];
} {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const firstLine = lines.find((line) => line.trim())?.trim();
  const title = firstLine
    ? firstLine.replace(/^CV ADAPTADO\s*[—-]\s*/i, "").trim()
    : "CV adaptado";

  const sections: Section[] = [];
  let current: Section = { heading: "", lines: [] };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (current.lines.length > 0) current.lines.push("");
      continue;
    }

    if (/^CV ADAPTADO\s*[—-]/i.test(line)) continue;
    if (/^BORRADOR PARA REVISIÓN/i.test(line)) continue;

    const normalized = line
      .replace(/:$/, "")
      .toLocaleUpperCase("es-MX");

    if (KNOWN_HEADINGS.has(normalized)) {
      if (current.heading || current.lines.length > 0) {
        sections.push(current);
      }

      current = { heading: normalized, lines: [] };
      continue;
    }

    current.lines.push(line);
  }

  if (current.heading || current.lines.length > 0) {
    sections.push(current);
  }

  const nameSection = sections.find(
    (section) => section.heading === "NOMBRE COMPLETO",
  );
  const candidateName = nameSection?.lines.find((line) => line.trim())?.trim();

  return {
    title: candidateName || title,
    sections: sections.filter((section) => section.heading !== "NOMBRE COMPLETO"),
  };
}

function makeDocxParagraphs(
  sections: Section[],
  title: string,
): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
    }),
  ];

  for (const section of sections) {
    if (section.heading) {
      paragraphs.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 100 },
          keepNext: true,
        }),
      );
    }

    for (const line of section.lines) {
      if (!line) {
        paragraphs.push(new Paragraph({ text: "" }));
      } else if (/^[-•]\s+/.test(line)) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^[-•]\s+/, ""),
            bullet: { level: 0 },
            spacing: { after: 60 },
          }),
        );
      } else {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: 80 },
          }),
        );
      }
    }
  }

  return paragraphs;
}

async function makePdf(
  title: string,
  sections: Section[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "LETTER",
      margins: { top: 54, bottom: 54, left: 58, right: 58 },
      info: {
        Title: title,
        Subject: "CV adaptado",
        Creator: "JobTracker",
      },
    });

    const chunks: Buffer[] = [];

    pdf.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.font("Helvetica-Bold").fontSize(20).text(title, {
      align: "center",
    });
    pdf.moveDown(1);

    for (const section of sections) {
      if (section.heading) {
        pdf.moveDown(0.5);
        pdf
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#222222")
          .text(section.heading, { continued: false });
        pdf.moveDown(0.25);
      }

      for (const line of section.lines) {
        if (!line) {
          pdf.moveDown(0.25);
          continue;
        }

        pdf.font("Helvetica").fontSize(10).fillColor("#222222");

        if (/^[-•]\s+/.test(line)) {
          pdf.text(`•  ${line.replace(/^[-•]\s+/, "")}`, {
            indent: 12,
            paragraphGap: 3,
          });
        } else {
          pdf.text(line, { paragraphGap: 3 });
        }
      }
    }

    pdf.end();
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
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

    const { id } = await context.params;

    if (!/^[1-9][0-9]{0,19}$/.test(id)) {
      return NextResponse.json(
        { success: false, error: "Identificador de adaptación inválido" },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    if (format !== "pdf" && format !== "docx") {
      return NextResponse.json(
        { success: false, error: "Formato no válido. Usa pdf o docx." },
        { status: 400 },
      );
    }

    const [rows] = await pool.execute(
      `SELECT id, job_title, draft_content
       FROM resume_adaptations
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, userId],
    );

    const adaptation = (rows as AdaptationRow[])[0];

    if (!adaptation) {
      return NextResponse.json(
        {
          success: false,
          error: "La adaptación no existe o no tienes permiso para exportarla",
        },
        { status: 404 },
      );
    }

    if (
      typeof adaptation.draft_content !== "string" ||
      !adaptation.draft_content.trim()
    ) {
      return NextResponse.json(
        { success: false, error: "El borrador está vacío" },
        { status: 400 },
      );
    }

    const parsed = parseDraft(adaptation.draft_content);
    const sections = [...parsed.sections];

    // Consultar los datos actuales del CV maestro sin modificar el borrador guardado.
    const [profileRows] = await pool.execute(
      `SELECT full_name, phone, email, state, country, postal_code, linkedin, portfolio
       FROM resume_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    const profile = (
      profileRows as Array<{
        full_name: string | null;
        phone: string | null;
        email: string | null;
        state: string | null;
        country: string | null;
        postal_code: string | null;
        linkedin: string | null;
        portfolio: string | null;
      }>
    )[0];

    // Usar el nombre del CV maestro; si falta, conservar el título del borrador.
    const title =
      profile?.full_name?.trim() ||
      parsed.title ||
      adaptation.job_title;

    if (profile) {
      const contactLines = [
        profile.phone?.trim()
          ? `Teléfono: ${profile.phone.trim()}`
          : "",
        profile.email?.trim()
          ? `Correo: ${profile.email.trim()}`
          : "",
        [profile.state, profile.country]
          .map((value) => value?.trim())
          .filter(Boolean)
          .join(", "),
        profile.postal_code?.trim()
          ? `Código postal: ${profile.postal_code.trim()}`
          : "",
        profile.linkedin?.trim()
          ? `LinkedIn: ${profile.linkedin.trim()}`
          : "",
        profile.portfolio?.trim()
          ? `Portafolio: ${profile.portfolio.trim()}`
          : "",
      ].filter(Boolean);

      const contactIndex = sections.findIndex(
        (section) => section.heading === "DATOS DE CONTACTO",
      );

      if (contactLines.length > 0) {
        const contactSection = {
          heading: "DATOS DE CONTACTO",
          lines: contactLines,
        };

        if (contactIndex >= 0) {
          // Actualizar la sección solo en el documento exportado.
          sections[contactIndex] = contactSection;
        } else {
          sections.unshift(contactSection);
        }
      } else if (contactIndex < 0) {
        sections.unshift({
          heading: "DATOS DE CONTACTO",
          lines: ["Completa tus datos de contacto en el CV maestro."],
        });
      }
    }

    const filename = safeFilename(title || adaptation.job_title);

    let file: Buffer;
    let contentType: string;
    let extension: string;

    if (format === "docx") {
      const document = new Document({
        creator: "JobTracker",
        title,
        description: "CV adaptado para una vacante",
        sections: [
          {
            properties: {},
            children: makeDocxParagraphs(sections, title),
          },
        ],
      });

      file = Buffer.from(await Packer.toBuffer(document));
      contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      extension = "docx";
    } else {
      file = await makePdf(title, sections);
      contentType = "application/pdf";
      extension = "pdf";
    }

    const safeFileName = `${filename}.${extension}`;

    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        "Content-Length": String(file.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Resume adaptation export failed:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo generar el documento" },
      { status: 500 },
    );
  }
}
