import type { CSSProperties } from "react";
import type { ResumeEntry, ResumeStyle, SectionKind } from "./resume-model";

export const DEFAULT_PHOTO_SIZE = 82;
export const MAX_PHOTO_SIZE = 180;
export const MIN_PHOTO_SIZE = 48;
export const PHOTO_GAP = 14;

export const sectionTemplates: Record<SectionKind, { title: string; entry: Omit<ResumeEntry, "id"> }> = {
  summary: {
    title: "Profile",
    entry: { heading: "", subheading: "", date: "", details: "Write a focused professional summary.", bullets: [] },
  },
  experience: {
    title: "Experience",
    entry: { heading: "Role title", subheading: "Organization", date: "Dates", details: "", bullets: ["Describe an accomplishment or responsibility."] },
  },
  projects: {
    title: "Projects",
    entry: { heading: "Project name", subheading: "Your role", date: "", details: "Describe the project and its purpose.", bullets: [], link: "" },
  },
  education: {
    title: "Education",
    entry: { heading: "School", subheading: "Degree or program", date: "Dates", details: "", bullets: [] },
  },
  skills: {
    title: "Skills",
    entry: { heading: "Category", subheading: "", date: "", details: "Skill, Skill, Skill", bullets: [] },
  },
  awards: {
    title: "Awards",
    entry: { heading: "Award name", subheading: "", date: "Year", details: "", bullets: [] },
  },
  custom: {
    title: "New Section",
    entry: { heading: "Item title", subheading: "Supporting detail", date: "", details: "Add your information here.", bullets: [] },
  },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (start: number, end: number, progress: number) => start + (end - start) * progress;

/**
 * Smart fitting spends the cheapest space first. Whitespace collapses before
 * page margins, and typography only moves once the safer savings are gone, so
 * a document never loses readability to fit a page it was always going to fit.
 */
export function resumeFitVariables(style: ResumeStyle): CSSProperties {
  const fit = clamp01(style.fitLevel / 100);

  const spacePhase = clamp01(fit / 0.55);
  const marginPhase = clamp01((fit - 0.12) / 0.68);
  const typePhase = clamp01((fit - 0.58) / 0.42);
  const detailPhase = clamp01((fit - 0.28) / 0.72);
  const compact = style.density === "compact";

  const base = compact
    ? { bodySpace: 12, entrySpace: 8, fontSize: 11, headerSpace: 14, lineHeight: 1.36, paddingY: 52, sectionSpace: 11 }
    : { bodySpace: 17, entrySpace: 12, fontSize: 12, headerSpace: 20, lineHeight: 1.46, paddingY: 66, sectionSpace: 17 };

  return {
    "--paper-pad-y": `${mix(base.paddingY, 38, marginPhase).toFixed(1)}px`,
    "--paper-pad-x": `${mix(70, 48, marginPhase).toFixed(1)}px`,
    "--paper-font-size": `${mix(base.fontSize, 10.2, typePhase).toFixed(2)}px`,
    "--paper-line-height": mix(base.lineHeight, 1.3, typePhase).toFixed(3),
    "--header-space": `${mix(base.headerSpace, 10, spacePhase).toFixed(1)}px`,
    "--body-space": `${mix(base.bodySpace, 8, spacePhase).toFixed(1)}px`,
    "--section-space": `${mix(base.sectionSpace, 7, spacePhase).toFixed(1)}px`,
    "--section-title-space": `${mix(9, 5, spacePhase).toFixed(1)}px`,
    "--entry-space": `${mix(base.entrySpace, 5.5, spacePhase).toFixed(1)}px`,
    "--name-size": `${mix(34, 28, typePhase).toFixed(1)}px`,
    "--headline-size": `${mix(13, 11.4, typePhase).toFixed(1)}px`,
    "--contact-size": `${mix(10, 9.1, typePhase).toFixed(1)}px`,
    "--section-title-size": `${mix(11, 9.5, typePhase).toFixed(1)}px`,
    "--entry-title-size": `${mix(13, 11.4, typePhase).toFixed(1)}px`,
    "--entry-subtitle-size": `${mix(11, 9.8, typePhase).toFixed(1)}px`,
    "--entry-date-size": `${mix(10, 9, typePhase).toFixed(1)}px`,
    "--entry-text-size": `${mix(10.5, 9.4, typePhase).toFixed(1)}px`,
    "--entry-link-size": `${mix(9.5, 8.8, typePhase).toFixed(1)}px`,
    "--skill-text-size": `${mix(10, 9.1, typePhase).toFixed(1)}px`,
    "--skill-label-width": `${mix(95, 76, detailPhase).toFixed(1)}px`,
    "--skill-gap-y": `${mix(7, 4, spacePhase).toFixed(1)}px`,
    "--skill-gap-x": `${mix(20, 13, detailPhase).toFixed(1)}px`,
  } as CSSProperties;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function safeFilename(name: string) {
  return `${name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume"}-resume`;
}
