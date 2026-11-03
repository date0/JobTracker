import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import pool from "@/lib/db";
import { analyzeResumeSemantically } from "@/lib/resume-analysis";

type ResumeRow = {
  headline: string | null;
  summary: string | null;
  experience: string | null;
  skills: string | null;
  education: string | null;
  certifications: string | null;
};

type JobRow = {
  id: number;
  title: string;
  description: string | null;
};

const TECHNOLOGIES = [
  "Kubernetes", "Docker", "Terraform", "Ansible", "Jenkins",
  "GitHub Actions", "GitLab CI", "Azure DevOps", "CI/CD",
  "AWS", "Azure", "Google Cloud", "GCP", "Linux", "Unix",
  "SQL", "MySQL", "MariaDB", "PostgreSQL", "MongoDB", "Redis",
  "Python", "Java", "JavaScript", "TypeScript", "Node.js",
  "React", "Next.js", "C#", ".NET", "PowerShell", "Bash",
  "Cisco ASA", "Cisco", "Firewall", "TCP/IP", "DNS", "VPN",
  "Networking", "Ansible Tower", "OpenShift", "Helm",
  "Prometheus", "Grafana", "ELK", "Git", "REST API",
  "Microservices", "Linux administration",
];

const STOP_WORDS = new Set(
  `a al algo algunas algunos ante antes como con contra cual cuando de del
   desde donde durante e el ella ellas ellos en entre era es esa esas ese eso
   esos esta estaban estado estas este esto estos fue fueron ha habia han
   hasta hay la las le les lo los mas me mi mis mucha muchas mucho muchos muy
   nada ni no nos nuestra nuestras nuestro nuestros o otra otras otro otros
   para pero poco por porque que quien se sea sean ser si sin sobre son su sus
   tambien tanto te tiene tienen toda todas todo todos tu tus un una unas uno
   unos y ya the a an and are as at be been being by for from has have in into
   is it its of on or our that their them they this to was we were will with
   you your`.split(/\s+/),
);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(text: string, term: string): boolean {
  const normalizedText = ` ${normalize(text)} `;
  const normalizedTerm = normalize(term);
  return normalizedText.includes(` ${normalizedTerm} `);
}

function extractKeywords(value: string): string[] {
  const words = normalize(value).match(/[a-z0-9+#./-]+/g) ?? [];

  return [...new Set(
    words
      .map((word) => word.replace(/^[./-]+|[./-]+$/g, ""))
      .filter(
        (word) =>
          word.length >= 3 &&
          !STOP_WORDS.has(word) &&
          !/^\d+$/.test(word),
      ),
  )].sort();
}

function splitSentences(value: string): string[] {
  return value
    .split(/[\n\r]+|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12);
}

function classifySentences(description: string) {
  const sentences = splitSentences(description);

  const experience = sentences.filter((sentence) =>
    /\b(years?|years? of experience|años?|experiencia|senior|junior|mid.level|entry.level|lead|liderazgo|minimum of|at least|mínimo|minimo)\b/i.test(
      sentence,
    ),
  );

  const certifications = sentences.filter((sentence) =>
    /\b(certification|certified|certifications|certificado|certificación|certificacion|certificaciones|credential|PMP|CCNA|CCNP|CISSP|Security\+|AWS Certified|Azure Administrator)\b/i.test(
      sentence,
    ),
  );

  const responsibilities = sentences.filter((sentence) =>
    /\b(responsible for|responsibilities|responsabilidad|responsabilidades|manage|maintain|design|develop|implement|deploy|monitor|troubleshoot|configure|administrar|gestionar|diseñar|desarrollar|implementar|mantener|supervisar|configurar|automatizar)\b/i.test(
      sentence,
    ),
  );

  return { experience, certifications, responsibilities };
}

function compareItems(items: string[], resumeText: string) {
  const uniqueItems = [...new Set(items)];

  return {
    matched: uniqueItems.filter((item) => containsTerm(resumeText, item)),
    missing: uniqueItems.filter((item) => !containsTerm(resumeText, item)),
  };
}

export async function POST(request: Request) {
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

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "El cuerpo de la solicitud no es válido" },
        { status: 400 },
      );
    }

    const jobId = Number((body as Record<string, unknown>).jobId);

    if (!Number.isSafeInteger(jobId) || jobId <= 0) {
      return NextResponse.json(
        { success: false, error: "Selecciona una vacante válida" },
        { status: 400 },
      );
    }

    const [jobRows] = await pool.execute(
      `SELECT id, title, description
       FROM jobs
       WHERE id = ?
         AND (created_by = ? OR created_by IS NULL)
       LIMIT 1`,
      [jobId, userId],
    );

    const job = (jobRows as JobRow[])[0];

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: "La vacante no existe o no tienes permiso para analizarla",
        },
        { status: 404 },
      );
    }

    const [resumeRows] = await pool.execute(
      `SELECT headline, summary, experience, skills, education, certifications
       FROM resume_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    const resume = (resumeRows as ResumeRow[])[0];

    if (!resume) {
      return NextResponse.json(
        {
          success: false,
          error: "Primero guarda tu CV maestro antes de analizar una vacante",
        },
        { status: 400 },
      );
    }

    const description = job.description?.trim() ?? "";

    if (!description) {
      return NextResponse.json(
        {
          success: false,
          error: "Esta vacante no tiene descripción para analizar",
        },
        { status: 400 },
      );
    }

    const resumeText = Object.values(resume)
      .filter((value): value is string => typeof value === "string")
      .join("\n");

    // Análisis local: se conserva temporalmente para comparar resultados.
    const normalizedDescription = normalize(description);

    const technologies = TECHNOLOGIES.filter((technology) =>
      containsTerm(normalizedDescription, technology),
    );

    const sentenceCategories = classifySentences(description);

    const categories = {
      technologies: compareItems(technologies, resumeText),
      experience: compareItems(sentenceCategories.experience, resumeText),
      certifications: compareItems(
        sentenceCategories.certifications,
        resumeText,
      ),
      responsibilities: compareItems(
        sentenceCategories.responsibilities,
        resumeText,
      ),
    };

    const keywords = extractKeywords(description);

    const matchedKeywords = keywords.filter((keyword) =>
      containsTerm(resumeText, keyword),
    );

    const missingKeywords = keywords.filter(
      (keyword) => !containsTerm(resumeText, keyword),
    );

    const totalKeywords = keywords.length;

    const score =
      totalKeywords > 0
        ? Math.round((matchedKeywords.length / totalKeywords) * 100)
        : 0;

    // Análisis semántico mediante OpenAI.
    // Si el servicio no está disponible, se utiliza el análisis local.
    let semantic;
    let fallbackNotice: string | undefined;

    try {
      semantic = await analyzeResumeSemantically({
        resumeText,
        jobTitle: job.title,
        jobDescription: description,
      });
    } catch (openAIError) {
      const errorRecord =
        openAIError && typeof openAIError === "object"
          ? (openAIError as Record<string, unknown>)
          : {};

      const nestedError =
        errorRecord.error && typeof errorRecord.error === "object"
          ? (errorRecord.error as Record<string, unknown>)
          : {};

      const status = Number(errorRecord.status ?? 0);
      const code = String(
        errorRecord.code ?? nestedError.code ?? "",
      );
      const errorType = String(
        errorRecord.type ?? nestedError.type ?? "",
      );

      let reason = "El servicio de análisis semántico no está disponible.";

      if (
        code === "credit_balance_exhausted" ||
        errorType === "insufficient_quota"
      ) {
        reason =
          "OpenAI no tiene créditos disponibles. Revisa la facturación de la API.";
      } else if (status === 429) {
        reason =
          "OpenAI alcanzó un límite de uso. Intenta nuevamente más tarde.";
      } else if (status === 401) {
        reason =
          "OpenAI rechazó la API key. Revisa su configuración.";
      } else if (status === 403) {
        reason =
          "La API key no tiene permisos para utilizar el servicio solicitado.";
      } else if (status >= 500) {
        reason =
          "OpenAI presenta un problema temporal. Intenta nuevamente más tarde.";
      }

      console.warn(
        "Semantic resume analysis unavailable; using local fallback:",
        {
          status,
          code,
          errorType,
          message:
            openAIError instanceof Error
              ? openAIError.message
              : String(openAIError),
        },
      );

      const fallbackRequirements = [
        ...categories.technologies.missing.map((item) => ({
          requirement: item,
          category: "technology" as const,
        })),
        ...categories.experience.missing.map((item) => ({
          requirement: item,
          category: "experience" as const,
        })),
        ...categories.certifications.missing.map((item) => ({
          requirement: item,
          category: "certification" as const,
        })),
        ...categories.responsibilities.missing.map((item) => ({
          requirement: item,
          category: "responsibility" as const,
        })),
      ];

      semantic = {
        summary:
          "OpenAI no pudo realizar el análisis semántico. Este resultado utiliza coincidencias textuales locales y no interpreta equivalencias entre tecnologías, responsabilidades o experiencias.",
        requirements: fallbackRequirements.map((item) => ({
          requirement: item.requirement,
          category: item.category,
          status: "not_demonstrated" as const,
          evidence: "",
          reasoning:
            "El análisis local no encontró una coincidencia textual en el CV. Esto no demuestra que carezcas de esta experiencia; revisa el requisito y confirma manualmente si puedes respaldarlo.",
        })),
      };

      fallbackNotice =
        "ANÁLISIS ALTERNATIVO: " +
        reason +
        " Se muestran únicamente requisitos sin coincidencia textual local. No es un análisis semántico y no determina si tienes experiencia equivalente. Revisa y confirma manualmente cada requisito.";
    }

    return NextResponse.json({
      success: true,
      analysis: {
        jobId: job.id,
        jobTitle: job.title,

        // Resultado heurístico anterior, conservado temporalmente.
        score,
        totalKeywords,
        matchedKeywords: matchedKeywords.slice(0, 30),
        missingKeywords: missingKeywords.slice(0, 30),
        categories,

        // Nuevo resultado semántico.
        semantic,

        notice:
          fallbackNotice ??
          "El análisis local utiliza coincidencias textuales. El análisis semántico utiliza IA para interpretar los requisitos. Las conclusiones deben revisarse manualmente y no demuestran por sí solas la idoneidad profesional.",
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "El cuerpo debe ser JSON válido" },
        { status: 400 },
      );
    }

    console.error("Failed to analyze resume:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo analizar el CV. Comprueba la configuración de OpenAI y vuelve a intentarlo.",
      },
      { status: 500 },
    );
  }
}
