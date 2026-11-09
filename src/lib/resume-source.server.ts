import { createHash } from "node:crypto";
import pool from "@/lib/db";

import {
  ResumeSourceSnapshotSchema,
  type ResumeSourceSnapshot,
} from "@/lib/resume-structure";

/**
 * Creates an exact snapshot of the source fields.
 *
 * The property order is intentional and must remain stable.
 * No text normalization or transformation is performed.
 */
export function createResumeSourceSnapshot(
  profile: ResumeSourceSnapshot,
): ResumeSourceSnapshot {
  return ResumeSourceSnapshotSchema.parse({
    headline: profile.headline,
    summary: profile.summary,
    experience: profile.experience,
    skills: profile.skills,
    education: profile.education,
    certifications: profile.certifications,

    full_name: profile.full_name,
    phone: profile.phone,
    email: profile.email,
    state: profile.state,
    country: profile.country,
    postal_code: profile.postal_code,
    linkedin: profile.linkedin,
    portfolio: profile.portfolio,
  });
}

/**
 * Generates a deterministic SHA-256 hash from the source snapshot.
 *
 * Explicit property ordering ensures that equivalent snapshots
 * always produce the same hash.
 */
export function hashResumeSourceSnapshot(
  snapshot: ResumeSourceSnapshot,
): string {
  const validated = ResumeSourceSnapshotSchema.parse(snapshot);

  const canonicalSnapshot = {
    headline: validated.headline,
    summary: validated.summary,
    experience: validated.experience,
    skills: validated.skills,
    education: validated.education,
    certifications: validated.certifications,

    full_name: validated.full_name,
    phone: validated.phone,
    email: validated.email,
    state: validated.state,
    country: validated.country,
    postal_code: validated.postal_code,
    linkedin: validated.linkedin,
    portfolio: validated.portfolio,
  };

  return createHash("sha256")
    .update(JSON.stringify(canonicalSnapshot), "utf8")
    .digest("hex");
}

/**
 * Loads the authenticated user's original CV fields directly
 * from resume_profiles and creates a validated source snapshot.
 *
 * The userId must come from the authenticated server session,
 * never from request data.
 */
export async function loadResumeSourceSnapshot(
  userId: number,
): Promise<ResumeSourceSnapshot | null> {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Invalid user ID.");
  }

  const [rows] = await pool.execute(
    `SELECT
       headline,
       summary,
       experience,
       skills,
       education,
       certifications,
       full_name,
       phone,
       email,
       state,
       country,
       postal_code,
       linkedin,
       portfolio
     FROM resume_profiles
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );

  const profiles = rows as ResumeSourceSnapshot[];
  const profile = profiles[0];

  if (!profile) {
    return null;
  }

  return createResumeSourceSnapshot(profile);
}
