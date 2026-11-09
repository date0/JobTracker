import { describe, expect, it } from "vitest";

import { ResumeSourceSnapshotSchema } from "./resume-structure";
import { parseResumeStructure } from "./resume-parser";

const profile = {
  headline: "DevOps Engineer",
  summary: "Senior DevOps Engineer.",
  experience: [
    "Nestlé | Senior Specialist Application Developer | Dec 2023 - May 2026",
    "Ensured uninterrupted site operations for several global corporate brands by developing and deploying infrastructure updates via Infrastructure as Code (IaC).",
    "Managed and orchestrated containerized application services within Kubernetes clusters hosted on Microsoft Azure infrastructure.",
    "Acted as the central point of contact for technical coordination across diverse brand stakeholders and internal departments.",
    "Automated and optimized the deployment of production mobile applications using Jenkins in combination with Lighthouse testing.",
    "Maintained rigorous adherence to Service Level Agreements (SLAs) utilizing JIRA and ServiceNow ticketing systems.",
    "Directed technical crisis coordination for the Technological Response on MSE North America team while leading a major web application platform migration from Azure to Adobe Experience Manager using Magento and Shopify.",
    "Luxoft | DevOps Engineer | Dec 2022 - Dec 2023",
    "Delivered high-tier infrastructure and platform support for enterprise-scale hospitality clients.",
    "Guaranteed continuous availability and optimal performance of core application environments.",
    "Enforced regression-free stability by thoroughly analyzing and validating the impact of production environment updates.",
    "Accelerated features time-to-market by designing and executing continuous integration and deployment (CI/CD) pipelines.",
  ].join("\n"),
  skills:
    "Cloud, DevOps, Lighthouse, Microsoft Azure, Kubernetes, Infrastructure as Code (IaC), CI/CD Pipelines, Jenkins, Agile/Scrum, Kanban, FDD, JIRA, ServiceNow, JSD, BASS, GTS, Oracle, MySQL, Enterprise Linux Platform, Firewalls, Java, MOCA, Network Security, Nessus Auditing, Juniper IDS, Cisco ASA/PIX",
  education:
    "Licenciatura en Sistemas Computacionales y Administrativos | Universidad de las Américas, A.C. | 2008",
  certifications:
    "Cybesecurity Practicioner | Cisco | September 2026",
  full_name: "Test User",
  phone: null,
  email: null,
  state: null,
  country: "México",
  postal_code: null,
  linkedin: null,
  portfolio: null,
};

function getSnapshot() {
  return ResumeSourceSnapshotSchema.parse(profile);
}

describe("parseResumeStructure", () => {
  it("extracts the two work experiences and their responsibilities", () => {
    const { structure, warnings } = parseResumeStructure(getSnapshot());

    expect(structure.experience).toHaveLength(2);

    expect(structure.experience[0]).toMatchObject({
      company: "Nestlé",
      position: "Senior Specialist Application Developer",
      start_date: "2023-12",
      end_date: "2026-05",
      original_date_text: "Dec 2023 - May 2026",
    });

    expect(structure.experience[0].responsibilities).toHaveLength(6);

    expect(structure.experience[1]).toMatchObject({
      company: "Luxoft",
      position: "DevOps Engineer",
      start_date: "2022-12",
      end_date: "2023-12",
    });

    expect(structure.experience[1].responsibilities).toHaveLength(4);
    expect(warnings).toHaveLength(0);
  });

  it("preserves the original responsibility text", () => {
    const snapshot = getSnapshot();
    const { structure } = parseResumeStructure(snapshot);

    expect(
      structure.experience[0].responsibilities[0].original_text,
    ).toBe(
      "Ensured uninterrupted site operations for several global corporate brands by developing and deploying infrastructure updates via Infrastructure as Code (IaC).",
    );

    expect(structure.source_snapshot).toEqual(snapshot);
  });

  it("preserves all nine original responsibilities in their original order", () => {
    const { structure } = parseResumeStructure(getSnapshot());

    const expectedNestle = [
      "Ensured uninterrupted site operations for several global corporate brands by developing and deploying infrastructure updates via Infrastructure as Code (IaC).",
      "Managed and orchestrated containerized application services within Kubernetes clusters hosted on Microsoft Azure infrastructure.",
      "Acted as the central point of contact for technical coordination across diverse brand stakeholders and internal departments.",
      "Automated and optimized the deployment of production mobile applications using Jenkins in combination with Lighthouse testing.",
      "Maintained rigorous adherence to Service Level Agreements (SLAs) utilizing JIRA and ServiceNow ticketing systems.",
      "Directed technical crisis coordination for the Technological Response on MSE North America team while leading a major web application platform migration from Azure to Adobe Experience Manager using Magento and Shopify.",
    ];

    const expectedLuxoft = [
      "Delivered high-tier infrastructure and platform support for enterprise-scale hospitality clients.",
      "Guaranteed continuous availability and optimal performance of core application environments.",
      "Enforced regression-free stability by thoroughly analyzing and validating the impact of production environment updates.",
      "Accelerated features time-to-market by designing and executing continuous integration and deployment (CI/CD) pipelines.",
    ];

    expect(
      structure.experience[0].responsibilities.map((item) => item.original_text),
    ).toEqual(expectedNestle);

    expect(
      structure.experience[1].responsibilities.map((item) => item.original_text),
    ).toEqual(expectedLuxoft);
  });

  it("extracts all 26 skills without changing their names", () => {
    const { structure } = parseResumeStructure(getSnapshot());

    expect(structure.technical_skills).toHaveLength(26);

    expect(
      structure.technical_skills.map((skill) => skill.name),
    ).toContain("Cisco ASA/PIX");

    expect(
      structure.technical_skills.map((skill) => skill.name),
    ).toContain("Infrastructure as Code (IaC)");
  });

  it("extracts education and certification fields", () => {
    const { structure, warnings } = parseResumeStructure(getSnapshot());

    expect(structure.education[0]).toMatchObject({
      degree: "Licenciatura en Sistemas Computacionales y Administrativos",
      institution: "Universidad de las Américas, A.C.",
      graduation_year: "2008",
    });

    expect(structure.certifications[0]).toMatchObject({
      name: "Cybesecurity Practicioner",
      issuer: "Cisco",
      issue_date: "2026-09",
      original_text: "Cybesecurity Practicioner | Cisco | September 2026",
    });

    expect(warnings).toHaveLength(0);
  });

  it("accepts a certification without an issue date", () => {
    const snapshot = getSnapshot();
    snapshot.certifications = "Cybesecurity Practicioner | Cisco";

    const { structure, warnings, unparsed } = parseResumeStructure(snapshot);

    expect(structure.certifications).toHaveLength(1);
    expect(structure.certifications[0]).toMatchObject({
      name: "Cybesecurity Practicioner",
      issuer: "Cisco",
      issue_date: null,
      expiration_date: null,
      original_text: "Cybesecurity Practicioner | Cisco",
    });
    expect(warnings).toHaveLength(0);
    expect(unparsed).toHaveLength(0);
  });

  it("reports malformed experience headers instead of inventing data", () => {
    const snapshot = getSnapshot();

    snapshot.experience =
      "Nestlé | Senior Developer\nResponsibility without valid header";

    const { structure, warnings } = parseResumeStructure(snapshot);

    expect(structure.experience).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].field).toBe("experience");
  });

  it("does not change the source snapshot", () => {
    const snapshot = getSnapshot();
    const original = structuredClone(snapshot);

    parseResumeStructure(snapshot);

    expect(snapshot).toEqual(original);
  });

  it("generates unique provisional IDs", () => {
    const { structure } = parseResumeStructure(getSnapshot());

    const ids = [
      ...structure.experience.map((item) => item.id),
      ...structure.experience.flatMap((item) =>
        item.responsibilities.map((responsibility) => responsibility.id),
      ),
      ...structure.technical_skills.map((item) => item.id),
      ...structure.education.map((item) => item.id),
      ...structure.certifications.map((item) => item.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });
});


describe("experience date handling", () => {
  function parseExperienceHeader(header: string, responsibility?: string) {
    const snapshot = getSnapshot();

    snapshot.experience = [
      header,
      ...(responsibility ? [responsibility] : []),
    ].join("\n");

    return parseResumeStructure(snapshot);
  }

  it.each(["Present", "Current", "Actualidad"])(
    "recognizes %s as an ongoing experience",
    (endDate) => {
      const { structure, warnings } = parseExperienceHeader(
        `Example Corp | Developer | Dec 2023 - ${endDate}`,
      );

      expect(structure.experience[0]).toMatchObject({
        company: "Example Corp",
        position: "Developer",
        start_date: "2023-12",
        end_date: null,
        original_date_text: `Dec 2023 - ${endDate}`,
      });

      expect(warnings).toHaveLength(0);
    },
  );

  it("recognizes year-only date ranges", () => {
    const { structure, warnings } = parseExperienceHeader(
      "Example Corp | Developer | 2020 - 2022",
    );

    expect(structure.experience[0]).toMatchObject({
      start_date: "2020",
      end_date: "2022",
      original_date_text: "2020 - 2022",
    });

    expect(warnings).toHaveLength(0);
  });

  it("preserves an unknown start date without inventing a value", () => {
    const { structure, warnings } = parseExperienceHeader(
      "Example Corp | Developer | Unknown - May 2026",
    );

    expect(structure.experience[0]).toMatchObject({
      start_date: null,
      end_date: "2026-05",
      original_date_text: "Unknown - May 2026",
    });

    expect(warnings).toHaveLength(1);
  });

  it("preserves an unknown end date without inventing a value", () => {
    const { structure, warnings } = parseExperienceHeader(
      "Example Corp | Developer | Dec 2023 - Unknown",
    );

    expect(structure.experience[0]).toMatchObject({
      start_date: "2023-12",
      end_date: null,
      original_date_text: "Dec 2023 - Unknown",
    });

    expect(warnings).toHaveLength(1);
  });

  it.each(["Present", "Current", "Actualidad"])(
    "sets employment_status to current for %s",
    (endDate) => {
      const { structure } = parseExperienceHeader(
        `Example Corp | Developer | Dec 2023 - ${endDate}`,
      );

      expect(structure.experience[0].employment_status).toBe("current");
    },
  );

  it("sets employment_status to ended for a recognized end date", () => {
    const { structure } = parseExperienceHeader(
      "Example Corp | Developer | Dec 2023 - May 2026",
    );

    expect(structure.experience[0]).toMatchObject({
      start_date: "2023-12",
      end_date: "2026-05",
      employment_status: "ended",
      original_date_text: "Dec 2023 - May 2026",
    });
  });

  it("sets employment_status to unknown for an unrecognized end date", () => {
    const { structure } = parseExperienceHeader(
      "Example Corp | Developer | Dec 2023 - Unknown",
    );

    expect(structure.experience[0]).toMatchObject({
      start_date: "2023-12",
      end_date: null,
      employment_status: "unknown",
      original_date_text: "Dec 2023 - Unknown",
    });
  });

  it("allows an experience without responsibilities", () => {
    const { structure, warnings } = parseExperienceHeader(
      "Example Corp | Developer | Jan 2020 - Dec 2022",
    );

    expect(structure.experience).toHaveLength(1);
    expect(structure.experience[0].responsibilities).toEqual([]);
    expect(warnings).toHaveLength(0);
  });

  it("keeps incomplete experience headers available for review", () => {
    const { structure, warnings, unparsed } = parseExperienceHeader(
      "Example Corp | Developer",
    );

    expect(structure.experience).toHaveLength(0);
    expect(unparsed).toHaveLength(1);
    expect(unparsed[0].source_text).toBe("Example Corp | Developer");
    expect(warnings).toHaveLength(1);
  });
});

describe("preservation of unparsed content", () => {
  it("keeps malformed lines available for manual review", () => {
    const snapshot = getSnapshot();

    snapshot.experience = [
      "Texto de experiencia sin cabecera",
      "Nestlé | Senior Developer",
      "Responsabilidad sin cabecera válida",
    ].join("\n");

    snapshot.education =
      "Licenciatura | Universidad | Año desconocido";

    snapshot.certifications =
      "Certificación sin delimitadores";

    const { unparsed, warnings } = parseResumeStructure(snapshot);

    expect(unparsed).toHaveLength(4);

    expect(unparsed.map((item) => item.source_text)).toEqual([
      "Texto de experiencia sin cabecera",
      "Nestlé | Senior Developer",
      "Responsabilidad sin cabecera válida",
      "Certificación sin delimitadores",
    ]);

    expect(warnings).toHaveLength(5);

    // El registro educativo se conserva aunque el año no pueda normalizarse.
    expect(unparsed.some(
      (item) => item.source_text === "Licenciatura | Universidad | Año desconocido",
    )).toBe(false);

    expect(
      parseResumeStructure(snapshot).structure.education[0],
    ).toMatchObject({
      original_text: "Licenciatura | Universidad | Año desconocido",
      degree: "Licenciatura",
      institution: "Universidad",
      graduation_year: null,
    });
  });
});
