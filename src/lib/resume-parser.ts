import { randomUUID } from "node:crypto";

import {
  ResumeStructureSchema,
  type ResumeSourceSnapshot,
  type ResumeStructure,
} from "./resume-structure";

export type ResumeParseWarning = {
  field: string;
  line: number;
  message: string;
  source_text: string;
};

export type ResumeUnparsedItem = {
  field: string;
  line: number;
  source_text: string;
  reason: string;
};

export type ResumeParseResult = {
  structure: ResumeStructure;
  warnings: ResumeParseWarning[];
  unparsed: ResumeUnparsedItem[];
};

const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function parseDate(value: string): string | null {
  const text = value.trim();

  if (/^\d{4}$/.test(text)) {
    return text;
  }

  const match = text.match(/^([a-z]+)\s+(\d{4})$/i);

  if (!match) {
    return null;
  }

  const month = MONTHS[match[1].toLowerCase()];

  return month ? `${match[2]}-${month}` : null;
}

function getEmploymentStatus(
  value: string,
): "current" | "ended" | "unknown" {
  const parts = value.split(/\s+[-–—]\s+/);

  if (parts.length !== 2) {
    return "unknown";
  }

  const endText = parts[1].trim();

  if (/^(present|current|actualidad)$/i.test(endText)) {
    return "current";
  }

  return parseDate(endText) !== null ? "ended" : "unknown";
}

function parseDateRange(value: string): {
  start: string | null;
  end: string | null;
} {
  const parts = value.split(/\s+[-–—]\s+/);

  if (parts.length !== 2) {
    return { start: null, end: null };
  }

  const start = parseDate(parts[0]);
  const end =
    /^(present|current|actualidad)$/i.test(parts[1].trim())
      ? null
      : parseDate(parts[1]);

  return { start, end };
}

function nonEmptyLines(value: string): {
  text: string;
  line: number;
}[] {
  return value.split("\n").flatMap((raw, index) => {
    const text = raw.replace(/\r$/, "");

    return text.trim()
      ? [{ text, line: index + 1 }]
      : [];
  });
}

function addWarning(
  warnings: ResumeParseWarning[],
  field: string,
  line: number,
  message: string,
  sourceText: string,
) {
  warnings.push({
    field,
    line,
    message,
    source_text: sourceText,
  });
}

function addUnparsed(
  unparsed: ResumeUnparsedItem[],
  field: string,
  line: number,
  sourceText: string,
  reason: string,
) {
  unparsed.push({
    field,
    line,
    source_text: sourceText,
    reason,
  });
}

function parseExperience(
  value: string | null,
  warnings: ResumeParseWarning[],
  unparsed: ResumeUnparsedItem[],
) {
  type ExperienceBlock = {
    header: string;
    headerLine: number;
    lines: { text: string; line: number }[];
  };

  const result: ResumeStructure["experience"] = [];
  const blocks: ExperienceBlock[] = [];
  let current: ExperienceBlock | null = null;

  for (const item of nonEmptyLines(value ?? "")) {
    const parts = item.text.split("|").map((part) => part.trim());

    if (item.text.includes("|")) {
      if (current) {
        blocks.push(current);
        current = null;
      }

      if (parts.length !== 3 || parts.some((part) => !part)) {
        const reason =
          "La cabecera no tiene el formato Empresa | Puesto | Fechas.";

        addWarning(warnings, "experience", item.line, reason, item.text);
        addUnparsed(unparsed, "experience", item.line, item.text, reason);
        continue;
      }

      current = {
        header: item.text,
        headerLine: item.line,
        lines: [],
      };

      continue;
    }

    if (!current) {
      const reason =
        "Contenido sin una cabecera de experiencia reconocible.";

      addWarning(warnings, "experience", item.line, reason, item.text);
      addUnparsed(unparsed, "experience", item.line, item.text, reason);
      continue;
    }

    current.lines.push(item);
  }

  if (current) {
    blocks.push(current);
  }

  for (const block of blocks) {
    const [company, position, dateText] = block.header
      .split("|")
      .map((part) => part.trim());

    const dates = parseDateRange(dateText);
    const dateParts = dateText.split(/\s+[-–—]\s+/);

    if (
      dateParts.length !== 2 ||
      !dates.start ||
      (!dates.end && !/^(present|current|actualidad)$/i.test(dateParts[1]))
    ) {
      addWarning(
        warnings,
        "experience",
        block.headerLine,
        "No se pudieron interpretar completamente las fechas de esta experiencia.",
        dateText,
      );
    }

    result.push({
      id: randomUUID(),
      company,
      position,
      start_date: dates.start,
      end_date: dates.end,
      employment_status: getEmploymentStatus(dateText),
      original_date_text: dateText,
      original_text: [
        block.header,
        ...block.lines.map((item) => item.text),
      ].join("\n"),
      responsibilities: block.lines.map((item) => ({
        id: randomUUID(),
        original_text: item.text,
        normalized_text: null,
      })),
    });
  }

  return result;
}

function parseSkills(value: string | null) {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      id: randomUUID(),
      name: item,
      source_text: item,
    }));
}

function parseEducation(
  value: string | null,
  warnings: ResumeParseWarning[],
  unparsed: ResumeUnparsedItem[],
) {
  const result: ResumeStructure["education"] = [];

  for (const item of nonEmptyLines(value ?? "")) {
    const parts = item.text.split("|").map((part) => part.trim());

    if (parts.length !== 3 || parts.some((part) => !part)) {
      const reason = "Se esperaba Título | Institución | Año.";

      addWarning(warnings, "education", item.line, reason, item.text);
      addUnparsed(unparsed, "education", item.line, item.text, reason);
      continue;
    }

    result.push({
      id: randomUUID(),
      original_text: item.text,
      degree: parts[0],
      institution: parts[1],
      graduation_year: /^\d{4}$/.test(parts[2]) ? parts[2] : null,
    });

    if (!/^\d{4}$/.test(parts[2])) {
      addWarning(
        warnings,
        "education",
        item.line,
        "No se pudo interpretar el año de graduación.",
        parts[2],
      );
    }
  }

  return result;
}

function parseCertifications(
  value: string | null,
  warnings: ResumeParseWarning[],
  unparsed: ResumeUnparsedItem[],
) {
  const result: ResumeStructure["certifications"] = [];

  for (const item of nonEmptyLines(value ?? "")) {
    const parts = item.text.split("|").map((part) => part.trim());

    if (
      parts.length < 2 ||
      parts.length > 3 ||
      !parts[0] ||
      !parts[1]
    ) {
      const reason = "Se esperaba Certificación | Emisor | Fecha opcional.";

      addWarning(warnings, "certifications", item.line, reason, item.text);
      addUnparsed(unparsed, "certifications", item.line, item.text, reason);
      continue;
    }

    const issueDateText = parts[2] ?? "";
    const issueDate = issueDateText ? parseDate(issueDateText) : null;

    result.push({
      id: randomUUID(),
      original_text: item.text,
      name: parts[0],
      issuer: parts[1],
      issue_date: issueDate,
      expiration_date: null,
      credential_id: null,
    });

    if (issueDateText && !issueDate) {
      addWarning(
        warnings,
        "certifications",
        item.line,
        "No se pudo interpretar la fecha de emisión.",
        issueDateText,
      );
    }
  }

  return result;
}

/**
 * Extracts a provisional semantic structure from the exact CV snapshot.
 *
 * This function does not modify the source snapshot or persist anything.
 * Generated IDs are provisional until version reconciliation is implemented.
 */
export function parseResumeStructure(
  snapshot: ResumeSourceSnapshot,
): ResumeParseResult {
  const warnings: ResumeParseWarning[] = [];
  const unparsed: ResumeUnparsedItem[] = [];

  const structure = ResumeStructureSchema.parse({
    schema_version: 1,

    source_snapshot: snapshot,

    contact: {
      full_name: snapshot.full_name,
      phone: snapshot.phone,
      email: snapshot.email,
      state: snapshot.state,
      country: snapshot.country,
      postal_code: snapshot.postal_code,
      linkedin: snapshot.linkedin,
      portfolio: snapshot.portfolio,
    },

    professional_title: {
      original_text: snapshot.headline,
      normalized_text: null,
    },

    professional_summary: {
      original_text: snapshot.summary,
      normalized_text: null,
    },

    experience: parseExperience(snapshot.experience, warnings, unparsed),

    technical_skills: parseSkills(snapshot.skills),

    education: parseEducation(snapshot.education, warnings, unparsed),

    certifications: parseCertifications(
      snapshot.certifications,
      warnings,
      unparsed,
    ),
  });

  return { structure, warnings, unparsed };
}
