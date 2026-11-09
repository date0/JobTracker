import type {
  ResumeStructure,
  ResumeExperience,
  ResumeResponsibility,
} from "@/lib/resume-structure";

export type ChangeStatus = "added" | "removed" | "modified";

export type ResponsibilityChange = {
  status: ChangeStatus;
  previous: ResumeResponsibility | null;
  current: ResumeResponsibility | null;
};

export type ExperienceChange = {
  status: ChangeStatus;
  previous: ResumeExperience | null;
  current: ResumeExperience | null;
  responsibilities: ResponsibilityChange[];
};

export type ItemChange<T> = {
  status: ChangeStatus;
  previous: T | null;
  current: T | null;
};

function compareById<T extends { id: string }>(
  previousItems: T[],
  currentItems: T[],
): ItemChange<T>[] {
  const currentMap = new Map(
    currentItems.map(item => [item.id, item]),
  );

  const changes: ItemChange<T>[] = [];

  for (const previous of previousItems) {
    const current = currentMap.get(previous.id);

    if (!current) {
      changes.push({
        status: "removed",
        previous,
        current: null,
      });
      continue;
    }

    if (JSON.stringify(previous) !== JSON.stringify(current)) {
      changes.push({
        status: "modified",
        previous,
        current,
      });
    }

    currentMap.delete(previous.id);
  }

  for (const current of currentMap.values()) {
    changes.push({
      status: "added",
      previous: null,
      current,
    });
  }

  return changes;
}

function compareResponsibilities(
  previousItems: ResumeResponsibility[],
  currentItems: ResumeResponsibility[],
): ResponsibilityChange[] {
  const changes = compareById(previousItems, currentItems);

  const removed = changes.filter(
    change => change.status === "removed" && change.previous !== null,
  );

  const added = changes.filter(
    change => change.status === "added" && change.current !== null,
  );

  // Only infer a modification when exactly one old and one new
  // responsibility remain unmatched in the same experience.
  if (removed.length === 1 && added.length === 1) {
    const removedChange = removed[0];
    const addedChange = added[0];

    return [
      ...changes.filter(
        change =>
          change !== removedChange &&
          change !== addedChange,
      ),
      {
        status: "modified",
        previous: removedChange.previous,
        current: addedChange.current,
      },
    ];
  }

  return changes;
}

function compareExperienceMetadata(
  previous: ResumeExperience,
  current: ResumeExperience,
): boolean {
  return (
    previous.company !== current.company ||
    previous.position !== current.position ||
    previous.start_date !== current.start_date ||
    previous.end_date !== current.end_date ||
    previous.employment_status !== current.employment_status ||
    previous.original_date_text !== current.original_date_text
  );
}

function compareExperiences(
  previousItems: ResumeExperience[],
  currentItems: ResumeExperience[],
): ExperienceChange[] {
  const changes: ExperienceChange[] = [];

  const currentMap = new Map(
    currentItems.map(item => [item.id, item]),
  );

  for (const previous of previousItems) {
    const current = currentMap.get(previous.id);

    if (!current) {
      changes.push({
        status: "removed",
        previous,
        current: null,
        responsibilities: previous.responsibilities.map(item => ({
          status: "removed",
          previous: item,
          current: null,
        })),
      });
      continue;
    }

    const responsibilities = compareResponsibilities(
      previous.responsibilities,
      current.responsibilities,
    );

    const metadataChanged = compareExperienceMetadata(
      previous,
      current,
    );

    // Do not include experiences with no changes.
    if (metadataChanged || responsibilities.length > 0) {
      changes.push({
        status: "modified",
        previous,
        current,
        responsibilities,
      });
    }

    currentMap.delete(previous.id);
  }

  for (const current of currentMap.values()) {
    changes.push({
      status: "added",
      previous: null,
      current,
      responsibilities: current.responsibilities.map(item => ({
        status: "added",
        previous: null,
        current: item,
      })),
    });
  }

  return changes;
}

export function compareResumeStructures(
  previous: ResumeStructure,
  current: ResumeStructure,
) {
  return {
    experience: compareExperiences(
      previous.experience,
      current.experience,
    ),
    skills: compareById(
      previous.technical_skills,
      current.technical_skills,
    ),
    education: compareById(
      previous.education,
      current.education,
    ),
    certifications: compareById(
      previous.certifications,
      current.certifications,
    ),
  };
}
