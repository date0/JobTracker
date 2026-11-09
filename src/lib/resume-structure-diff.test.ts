import { describe, expect, it } from "vitest";

import { parseResumeStructure } from "./resume-parser";
import { ResumeSourceSnapshotSchema } from "./resume-structure";
import { compareResumeStructures } from "./resume-structure-diff";

const profile = {
  headline: "DevOps Engineer",
  summary: "Senior DevOps Engineer.",
  experience: [
    "Nestlé | Senior Specialist Application Developer | Dec 2023 - May 2026",
    "Managed Kubernetes clusters.",
    "Automated deployments using Jenkins.",
    "Luxoft | DevOps Engineer | Dec 2022 - Dec 2023",
    "Managed Infrastructure as Code changes using Terraform",
    "Guaranteed continuous availability of application environments.",
  ].join("\n"),
  skills: "Azure, Kubernetes, Jenkins",
  education: "Computer Science | Example University | 2008",
  certifications: "Cloud Practitioner | Example",
  full_name: "Test User",
  phone: null,
  email: null,
  state: null,
  country: "México",
  postal_code: null,
  linkedin: null,
  portfolio: null,
};

function createStructure() {
  const snapshot = ResumeSourceSnapshotSchema.parse(profile);
  return parseResumeStructure(snapshot).structure;
}

describe("compareResumeStructures", () => {
  it("detects a responsibility text modification", () => {
    const previous = createStructure();
    const current = structuredClone(previous);

    const oldResponsibility =
      previous.experience[1].responsibilities[0];

    current.experience[1].responsibilities[0] = {
      id: "new-responsibility-id",
      original_text: "Managed Terraform infrastructure changes.",
      normalized_text: null,
    };

    const result = compareResumeStructures(previous, current);

    const luxoft = result.experience.find(
      item => item.previous?.company === "Luxoft",
    );

    expect(luxoft).toBeDefined();
    expect(luxoft?.status).toBe("modified");
    expect(luxoft?.responsibilities).toHaveLength(1);
    expect(luxoft?.responsibilities[0]).toMatchObject({
      status: "modified",
      previous: oldResponsibility,
      current: current.experience[1].responsibilities[0],
    });
  });

  it("detects an added responsibility without misclassifying existing ones", () => {
    const previous = createStructure();
    const current = structuredClone(previous);

    current.experience[0].responsibilities.push({
      id: "new-responsibility-id",
      original_text: "New responsibility.",
      normalized_text: null,
    });

    const result = compareResumeStructures(previous, current);

    const nestle = result.experience.find(
      item => item.previous?.company === "Nestlé",
    );

    expect(nestle?.status).toBe("modified");
    expect(nestle?.responsibilities).toHaveLength(1);
    expect(nestle?.responsibilities[0]).toMatchObject({
      status: "added",
      previous: null,
      current: {
        original_text: "New responsibility.",
      },
    });
  });

  it("does not infer modifications when multiple responsibilities were replaced", () => {
    const previous = createStructure();
    const current = structuredClone(previous);

    current.experience[0].responsibilities.splice(0, 2);

    current.experience[0].responsibilities.push(
      {
        id: "new-responsibility-1",
        original_text: "Replacement responsibility one.",
        normalized_text: null,
      },
      {
        id: "new-responsibility-2",
        original_text: "Replacement responsibility two.",
        normalized_text: null,
      },
    );

    const result = compareResumeStructures(previous, current);

    const nestle = result.experience.find(
      item => item.previous?.company === "Nestlé",
    );

    expect(nestle?.responsibilities.filter(
      item => item.status === "removed",
    )).toHaveLength(2);

    expect(nestle?.responsibilities.filter(
      item => item.status === "added",
    )).toHaveLength(2);

    expect(nestle?.responsibilities.some(
      item => item.status === "modified",
    )).toBe(false);
  });

  it("does not include unchanged experiences in the comparison", () => {
    const previous = createStructure();
    const current = structuredClone(previous);

    const result = compareResumeStructures(previous, current);

    expect(result.experience).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.education).toHaveLength(0);
    expect(result.certifications).toHaveLength(0);
  });

  it("detects added and removed experiences", () => {
    const previous = createStructure();
    const current = structuredClone(previous);

    const removedExperience = previous.experience[1];

    current.experience = [
      current.experience[0],
      {
        ...current.experience[1],
        id: "new-experience-id",
        company: "New Company",
        position: "Platform Engineer",
      },
    ];

    const result = compareResumeStructures(previous, current);

    expect(result.experience).toHaveLength(2);

    expect(result.experience.some(
      item =>
        item.status === "removed" &&
        item.previous?.id === removedExperience.id,
    )).toBe(true);

    expect(result.experience.some(
      item =>
        item.status === "added" &&
        item.current?.company === "New Company",
    )).toBe(true);
  });

  it("detects added and removed skills by ID", () => {
    const previous = createStructure();
    const current = structuredClone(previous);

    const removedSkill = previous.technical_skills[0];

    current.technical_skills = current.technical_skills
      .filter(item => item.id !== removedSkill.id);

    current.technical_skills.push({
      id: "new-skill-id",
      name: "Terraform",
      source_text: "Terraform",
    });

    const result = compareResumeStructures(previous, current);

    expect(result.skills).toContainEqual({
      status: "removed",
      previous: removedSkill,
      current: null,
    });

    expect(result.skills).toContainEqual({
      status: "added",
      previous: null,
      current: {
        id: "new-skill-id",
        name: "Terraform",
        source_text: "Terraform",
      },
    });
  });
});
