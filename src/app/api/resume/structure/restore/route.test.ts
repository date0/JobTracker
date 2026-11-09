import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getConnection: vi.fn(),
}));

vi.mock("@/../auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  default: {
    getConnection: mocks.getConnection,
  },
}));

import { POST } from "./route";
import {
  createResumeSourceSnapshot,
  hashResumeSourceSnapshot,
} from "@/lib/resume-source.server";
import {
  ResumeStructureSchema,
  type ResumeSourceSnapshot,
} from "@/lib/resume-structure";

const userId = 7;

function createSnapshot(
  overrides: Partial<ResumeSourceSnapshot> = {},
): ResumeSourceSnapshot {
  return createResumeSourceSnapshot({
    headline: "DevOps Engineer",
    summary: "Test professional summary.",
    experience: "Example Company | DevOps Engineer | 2020 - 2024\nManaged infrastructure.",
    skills: "Linux, Kubernetes, Terraform",
    education: "Computer Science | Example University | 2010",
    certifications: "Cloud Practitioner | Example",
    full_name: "Test User",
    phone: null,
    email: "test@example.com",
    state: null,
    country: "México",
    postal_code: null,
    linkedin: null,
    portfolio: null,
    ...overrides,
  });
}

function createStructure(snapshot: ResumeSourceSnapshot) {
  return ResumeStructureSchema.parse({
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
      normalized_text: snapshot.headline,
    },
    professional_summary: {
      original_text: snapshot.summary,
      normalized_text: snapshot.summary,
    },
    experience: [
      {
        id: "experience-1",
        company: "Example Company",
        position: "DevOps Engineer",
        start_date: "2020",
        end_date: "2024",
        employment_status: "ended",
        original_date_text: "2020 - 2024",
        original_text: "Example Company | DevOps Engineer | 2020 - 2024",
        responsibilities: [
          {
            id: "responsibility-1",
            original_text: "Managed infrastructure.",
            normalized_text: null,
          },
        ],
      },
    ],
    technical_skills: [
      {
        id: "skill-1",
        name: "Kubernetes",
        source_text: "Kubernetes",
      },
    ],
    education: [],
    certifications: [],
  });
}

type StructureRow = {
  version: number;
  schema_version: number;
  source_hash: string;
  structure_json: string;
};

function createConnection(options?: {
  currentProfile?: ResumeSourceSnapshot | null;
  target?: StructureRow | null;
  latest?: StructureRow | null;
}) {
  const currentProfile = options?.currentProfile ?? null;
  const target = options?.target ?? null;
  const latest = options?.latest ?? null;

  const connection = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    execute: vi.fn(async (sql: string, params?: unknown) => {
      if (sql.includes("FROM resume_profiles")) {
        return [[...(currentProfile ? [currentProfile] : [])], []];
      }

      if (
        sql.includes("FROM resume_structures") &&
        sql.includes("AND version = ?")
      ) {
        return [[...(target ? [target] : [])], []];
      }

      if (
        sql.includes("FROM resume_structures") &&
        sql.includes("ORDER BY version DESC")
      ) {
        return [[...(latest ? [latest] : [])], []];
      }

      if (sql.includes("INSERT INTO resume_profiles")) {
        return [{ affectedRows: 1 }, []];
      }

      if (sql.includes("INSERT INTO resume_structures")) {
        return [{ insertId: 1 }, []];
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    }),
  };

  return connection;
}

function createHistoryRow(
  snapshot: ResumeSourceSnapshot,
  version: number,
  overrides: Partial<StructureRow> = {},
): StructureRow {
  const structure = createStructure(snapshot);

  return {
    version,
    schema_version: 1,
    source_hash: hashResumeSourceSnapshot(snapshot),
    structure_json: JSON.stringify(structure),
    ...overrides,
  };
}

function createRequest(body: unknown) {
  return new Request("http://localhost/api/resume/structure/restore", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function responseBody(response: Response) {
  return response.json();
}

describe("POST /api/resume/structure/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.auth.mockResolvedValue({
      user: {
        id: String(userId),
      },
    });
  });

  it("rejects unauthenticated requests without opening a connection", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await POST(createRequest({ version: 1 }));

    expect(response.status).toBe(401);
    expect(await responseBody(response)).toMatchObject({
      success: false,
      error: "No autorizado",
    });
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("rejects an invalid session user ID", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "0",
      },
    });

    const response = await POST(createRequest({ version: 1 }));

    expect(response.status).toBe(401);
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without opening a connection", async () => {
    const request = new Request(
      "http://localhost/api/resume/structure/restore",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{invalid",
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toMatchObject({
      success: false,
      error: "El cuerpo de la solicitud no contiene JSON válido",
    });
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it.each([
    ["missing version", {}],
    ["string version", { version: "1" }],
    ["zero version", { version: 0 }],
    ["negative version", { version: -1 }],
    ["decimal version", { version: 1.5 }],
    ["version above uint32", { version: 4294967296 }],
    ["array body", [1]],
  ])("rejects invalid input: %s", async (_label, body) => {
    const response = await POST(createRequest(body));

    expect(response.status).toBe(400);
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("restores the historical snapshot and creates a new history version", async () => {
    const targetSnapshot = createSnapshot();
    const currentSnapshot = createSnapshot({
      headline: "Different current title",
      summary: "Different current summary.",
    });

    const target = createHistoryRow(targetSnapshot, 1);
    const latest = createHistoryRow(currentSnapshot, 2);
    const connection = createConnection({
      currentProfile: currentSnapshot,
      target,
      latest,
    });

    mocks.getConnection.mockResolvedValue(connection);

    const response = await POST(createRequest({ version: 1 }));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      restored: true,
      already_current: false,
      history_entry_created: true,
      restored_from_version: 1,
      version: 3,
      source_hash: target.source_hash,
    });

    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();

    const profileInsert = connection.execute.mock.calls.find(
      ([sql]) => sql.includes("INSERT INTO resume_profiles"),
    );

    expect(profileInsert).toBeDefined();
    expect(profileInsert?.[1]).toEqual([
      userId,
      targetSnapshot.headline,
      targetSnapshot.summary,
      targetSnapshot.experience,
      targetSnapshot.skills,
      targetSnapshot.education,
      targetSnapshot.certifications,
      targetSnapshot.full_name,
      targetSnapshot.phone,
      targetSnapshot.email,
      targetSnapshot.state,
      targetSnapshot.country,
      targetSnapshot.postal_code,
      targetSnapshot.linkedin,
      targetSnapshot.portfolio,
    ]);

    const historyInsert = connection.execute.mock.calls.find(
      ([sql]) => sql.includes("INSERT INTO resume_structures"),
    );

    expect(historyInsert).toBeDefined();
    expect(historyInsert?.[1]).toEqual([
      userId,
      3,
      target.source_hash,
      target.structure_json,
    ]);

    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("updates the master without creating duplicate history when the latest hash already matches", async () => {
    const targetSnapshot = createSnapshot();
    const currentSnapshot = createSnapshot({
      headline: "Different current title",
    });

    const target = createHistoryRow(targetSnapshot, 1);
    const latest = createHistoryRow(targetSnapshot, 3);

    const connection = createConnection({
      currentProfile: currentSnapshot,
      target,
      latest,
    });

    mocks.getConnection.mockResolvedValue(connection);

    const response = await POST(createRequest({ version: 1 }));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      restored: true,
      already_current: false,
      history_entry_created: false,
      restored_from_version: 1,
      version: 3,
    });

    expect(
      connection.execute.mock.calls.filter(([sql]) =>
        sql.includes("INSERT INTO resume_profiles"),
      ),
    ).toHaveLength(1);

    expect(
      connection.execute.mock.calls.filter(([sql]) =>
        sql.includes("INSERT INTO resume_structures"),
      ),
    ).toHaveLength(0);

    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("returns an idempotent result when the master and latest history already match", async () => {
    const snapshot = createSnapshot();
    const target = createHistoryRow(snapshot, 1);
    const latest = createHistoryRow(snapshot, 3);

    const connection = createConnection({
      currentProfile: snapshot,
      target,
      latest,
    });

    mocks.getConnection.mockResolvedValue(connection);

    const response = await POST(createRequest({ version: 1 }));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      restored: false,
      already_current: true,
      restored_from_version: 1,
      version: 3,
    });

    expect(
      connection.execute.mock.calls.filter(([sql]) =>
        sql.includes("INSERT INTO"),
      ),
    ).toHaveLength(0);

    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("returns 404 when the requested historical version does not exist", async () => {
    const connection = createConnection({
      target: null,
    });

    mocks.getConnection.mockResolvedValue(connection);

    const response = await POST(createRequest({ version: 99 }));

    expect(response.status).toBe(404);
    expect(await responseBody(response)).toMatchObject({
      success: false,
      error: "No existe esa versión del CV para este usuario",
    });

    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rejects an unsupported schema version", async () => {
    const snapshot = createSnapshot();
    const target = createHistoryRow(snapshot, 1, {
      schema_version: 2,
    });

    const connection = createConnection({ target });
    mocks.getConnection.mockResolvedValue(connection);

    const response = await POST(createRequest({ version: 1 }));

    expect(response.status).toBe(409);
    expect(await responseBody(response)).toMatchObject({
      success: false,
      error: "La versión seleccionada utiliza un esquema no compatible",
    });

    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rejects an invalid stored structure", async () => {
    const snapshot = createSnapshot();
    const target = createHistoryRow(snapshot, 1, {
      structure_json: "{}",
    });

    const connection = createConnection({ target });
    mocks.getConnection.mockResolvedValue(connection);

    const response = await POST(createRequest({ version: 1 }));

    expect(response.status).toBe(409);
    expect(await responseBody(response)).toMatchObject({
      success: false,
      error: "La estructura histórica no es válida. No se modificó el CV.",
    });

    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rejects a snapshot whose hash does not match the stored hash", async () => {
    const snapshot = createSnapshot();
    const target = createHistoryRow(snapshot, 1, {
      source_hash: "a".repeat(64),
    });

    const connection = createConnection({ target });
    mocks.getConnection.mockResolvedValue(connection);

    const response = await POST(createRequest({ version: 1 }));

    expect(response.status).toBe(409);
    expect(await responseBody(response)).toMatchObject({
      success: false,
      error:
        "El contenido de la versión histórica no coincide con su hash. " +
        "No se modificó el CV.",
    });

    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rejects a snapshot with a field exceeding the allowed length", async () => {
    const snapshot = createSnapshot({
      headline: "A".repeat(256),
    });

    const target = createHistoryRow(snapshot, 1);
    const connection = createConnection({ target });

    mocks.getConnection.mockResolvedValue(connection);

    const response = await POST(createRequest({ version: 1 }));

    expect(response.status).toBe(409);
    expect(await responseBody(response)).toMatchObject({
      success: false,
      error: expect.stringContaining("headline"),
    });

    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rolls back the master update when the next history version exceeds uint32", async () => {
    const targetSnapshot = createSnapshot();
    const currentSnapshot = createSnapshot({
      headline: "Different current title",
    });

    const target = createHistoryRow(targetSnapshot, 1);
    const latest = createHistoryRow(
      createSnapshot({ headline: "Another historical title" }),
      4294967295,
    );

    const connection = createConnection({
      currentProfile: currentSnapshot,
      target,
      latest,
    });

    mocks.getConnection.mockResolvedValue(connection);

    const response = await POST(createRequest({ version: 1 }));

    expect(response.status).toBe(409);
    expect(await responseBody(response)).toMatchObject({
      success: false,
      error: "No se pudo calcular un número de versión válido",
    });

    expect(
      connection.execute.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO resume_profiles"),
      ),
    ).toBe(true);

    expect(
      connection.execute.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO resume_structures"),
      ),
    ).toBe(false);

    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
