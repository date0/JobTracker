import { describe, expect, it } from "vitest";

import { parseResumeStructure } from "./resume-parser";
import { ResumeSourceSnapshotSchema } from "./resume-structure";
import { reconcileResumeStructure } from "./resume-reconciliation";

const profile = {
  headline: "DevOps Engineer",
  summary: "Senior DevOps Engineer.",
  experience: [
    "Nestlé | Senior Specialist Application Developer | Dec 2023 - May 2026",
    "Managed Kubernetes clusters.",
    "Automated deployments using Jenkins.",
    "Luxoft | DevOps Engineer | Dec 2022 - Dec 2023",
    "Supported enterprise infrastructure.",
  ].join("\n"),
  skills: "Azure, Kubernetes, Jenkins",
  education: "Computer Science | Example University | 2008",
  certifications: "Cloud Practitioner | Example | September 2026",
  full_name: "Test User",
  phone: null,
  email: null,
  state: null,
  country: "México",
  postal_code: null,
  linkedin: null,
  portfolio: null,
};

function parse(overrides: Partial<typeof profile> = {}) {
  const snapshot = ResumeSourceSnapshotSchema.parse({
    ...profile,
    ...overrides,
  });

  return parseResumeStructure(snapshot).structure;
}

describe("reconcileResumeStructure", () => {
  it("keeps all existing IDs when the source has not changed", () => {
    const previous = parse();
    const current = parse();

    const result = reconcileResumeStructure(current, previous);

    expect(result.experience.map((item) => item.id)).toEqual(
      previous.experience.map((item) => item.id),
    );

    expect(
      result.experience.flatMap((item) =>
        item.responsibilities.map((responsibility) => responsibility.id),
      ),
    ).toEqual(
      previous.experience.flatMap((item) =>
        item.responsibilities.map((responsibility) => responsibility.id),
      ),
    );

    expect(result.technical_skills.map((item) => item.id)).toEqual(
      previous.technical_skills.map((item) => item.id),
    );
  });

  it("preserves responsibility IDs when other responsibilities are added", () => {
    const previous = parse();
    const current = parse({
      experience: [
        "Nestlé | Senior Specialist Application Developer | Dec 2023 - May 2026",
        "New responsibility.",
        "Managed Kubernetes clusters.",
        "Automated deployments using Jenkins.",
        "Luxoft | DevOps Engineer | Dec 2022 - Dec 2023",
        "Supported enterprise infrastructure.",
      ].join("\n"),
    });

    const result = reconcileResumeStructure(current, previous);

    expect(result.experience[0].responsibilities[1].id).toBe(
      previous.experience[0].responsibilities[0].id,
    );

    expect(result.experience[0].responsibilities[0].id).not.toBe(
      previous.experience[0].responsibilities[0].id,
    );
  });

  it("does not reuse responsibility IDs across different experiences", () => {
    const previous = parse();
    const current = parse({
      experience: [
        "Nestlé | Senior Specialist Application Developer | Dec 2023 - May 2026",
        "Managed Kubernetes clusters.",
        "Automated deployments using Jenkins.",
        "Luxoft | DevOps Engineer | Dec 2022 - Dec 2023",
        "Managed Kubernetes clusters.",
      ].join("\n"),
    });

    const result = reconcileResumeStructure(current, previous);

    expect(result.experience[1].responsibilities[0].id).not.toBe(
      previous.experience[0].responsibilities[0].id,
    );

    expect(result.experience[1].responsibilities[0].id).not.toBe(
      previous.experience[0].responsibilities[0].id,
    );

    expect(result.experience[1].responsibilities[0].id).not.toBe(
      previous.experience[1].responsibilities[0].id,
    );
  });

  it("matches skills without changing their original presentation", () => {
    const previous = parse();
    const current = parse({
      skills: " azure , Kubernetes, Jenkins, Docker",
    });

    const result = reconcileResumeStructure(current, previous);

    expect(result.technical_skills[0].id).toBe(
      previous.technical_skills[0].id,
    );

    expect(result.technical_skills[0].name).toBe("azure");
    expect(result.technical_skills[0].source_text).toBe("azure");

    expect(result.technical_skills[3].name).toBe("Docker");
    expect(
      previous.technical_skills.some((item) => item.name === "Docker"),
    ).toBe(false);
  });

  it("does not reuse an ID more than once for duplicate skills", () => {
    const previous = parse({ skills: "Azure" });
    const current = parse({ skills: "Azure, azure" });

    const result = reconcileResumeStructure(current, previous);
    const ids = result.technical_skills.map((item) => item.id);

    expect(ids[0]).toBe(previous.technical_skills[0].id);
    expect(ids[1]).not.toBe(ids[0]);
    expect(new Set(ids).size).toBe(2);
  });

  it("preserves education and certification IDs", () => {
    const previous = parse();
    const current = parse();

    const result = reconcileResumeStructure(current, previous);

    expect(result.education[0].id).toBe(previous.education[0].id);
    expect(result.certifications[0].id).toBe(
      previous.certifications[0].id,
    );
  });

  it("does not modify either input structure", () => {
    const previous = parse();
    const current = parse({
      skills: "Azure, Kubernetes, Docker",
    });

    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    reconcileResumeStructure(current, previous);

    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });

  it("keeps provisional IDs when there is no previous structure", () => {
    const current = parse();
    const result = reconcileResumeStructure(current, null);

    expect(result).toEqual(current);
    expect(result).not.toBe(current);
  });
});
