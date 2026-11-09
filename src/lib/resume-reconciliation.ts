import type { ResumeStructure } from "./resume-structure";

/**
 * Normalization is used only for matching identifiers.
 * It never changes the source text stored in the structure.
 */
function normalizeForMatch(value: string | null): string {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

function takeMatchingId<T>(
  previousItems: T[],
  usedIds: Set<string>,
  matches: (previous: T) => boolean,
  getId: (previous: T) => string,
): string | null {
  const match = previousItems.find((item) => {
    const id = getId(item);
    return !usedIds.has(id) && matches(item);
  });

  if (!match) {
    return null;
  }

  const id = getId(match);
  usedIds.add(id);
  return id;
}

/**
 * Reuses identifiers from the previously confirmed structure.
 *
 * Matching is conservative and exact after limited normalization.
 * New items retain their provisional IDs.
 */
export function reconcileResumeStructure(
  current: ResumeStructure,
  previous: ResumeStructure | null,
): ResumeStructure {
  if (!previous) {
    return structuredClone(current);
  }

  const usedExperienceIds = new Set<string>();
  const usedResponsibilityIds = new Set<string>();
  const usedSkillIds = new Set<string>();
  const usedEducationIds = new Set<string>();
  const usedCertificationIds = new Set<string>();

  const experience = current.experience.map((item) => {
    const previousExperienceId = takeMatchingId(
      previous.experience,
      usedExperienceIds,
      (candidate) =>
        normalizeForMatch(candidate.company) ===
          normalizeForMatch(item.company) &&
        normalizeForMatch(candidate.position) ===
          normalizeForMatch(item.position) &&
        normalizeForMatch(candidate.original_date_text) ===
          normalizeForMatch(item.original_date_text),
      (candidate) => candidate.id,
    );

    const previousExperience = previous.experience.find(
      (candidate) => candidate.id === previousExperienceId,
    );

    const responsibilities = item.responsibilities.map((responsibility) => {
      const previousId = previousExperience
        ? takeMatchingId(
            previousExperience.responsibilities,
            usedResponsibilityIds,
            (candidate) =>
              normalizeForMatch(candidate.original_text) ===
              normalizeForMatch(responsibility.original_text),
            (candidate) => candidate.id,
          )
        : null;

      return {
        ...responsibility,
        id: previousId ?? responsibility.id,
      };
    });

    return {
      ...item,
      id: previousExperienceId ?? item.id,
      responsibilities,
    };
  });

  const technical_skills = current.technical_skills.map((skill) => {
    const previousId = takeMatchingId(
      previous.technical_skills,
      usedSkillIds,
      (candidate) =>
        normalizeForMatch(candidate.name) ===
        normalizeForMatch(skill.name),
      (candidate) => candidate.id,
    );

    return {
      ...skill,
      id: previousId ?? skill.id,
    };
  });

  const education = current.education.map((item) => {
    const previousId = takeMatchingId(
      previous.education,
      usedEducationIds,
      (candidate) =>
        normalizeForMatch(candidate.original_text) ===
        normalizeForMatch(item.original_text),
      (candidate) => candidate.id,
    );

    return {
      ...item,
      id: previousId ?? item.id,
    };
  });

  const certifications = current.certifications.map((item) => {
    const previousId = takeMatchingId(
      previous.certifications,
      usedCertificationIds,
      (candidate) =>
        normalizeForMatch(candidate.original_text) ===
        normalizeForMatch(item.original_text),
      (candidate) => candidate.id,
    );

    return {
      ...item,
      id: previousId ?? item.id,
    };
  });

  return {
    ...current,
    experience,
    technical_skills,
    education,
    certifications,
  };
}
