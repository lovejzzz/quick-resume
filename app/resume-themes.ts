import type { ResumeLayout, ResumeStyle, SectionKind } from "./resume-model";

export type ResumeTheme = {
  id: ResumeLayout;
  label: string;
  bestFor: string;
  description: string;
  accent: string;
  font: ResumeStyle["font"];
  density: ResumeStyle["density"];
  sectionPriority: SectionKind[];
};

export const resumeThemes: ResumeTheme[] = [
  {
    id: "classic",
    label: "ATS Classic",
    bestFor: "Most applications",
    description: "Conservative typography and familiar hierarchy for fast scanning.",
    accent: "#20252b",
    font: "classic",
    density: "comfortable",
    sectionPriority: ["summary", "experience", "education", "projects", "skills", "awards", "custom"],
  },
  {
    id: "modern",
    label: "Modern Professional",
    bestFor: "Business & nonprofit",
    description: "A crisp, balanced layout with restrained color and clear section rhythm.",
    accent: "#28605d",
    font: "modern",
    density: "comfortable",
    sectionPriority: ["summary", "experience", "projects", "education", "skills", "awards", "custom"],
  },
  {
    id: "executive",
    label: "Executive",
    bestFor: "Leadership roles",
    description: "Leads with impact, a centered identity block, and stronger section authority.",
    accent: "#243b5a",
    font: "classic",
    density: "comfortable",
    sectionPriority: ["summary", "experience", "skills", "projects", "education", "awards", "custom"],
  },
  {
    id: "technical",
    label: "Technical",
    bestFor: "Tech & product",
    description: "Compact, skills-forward structure for tools, projects, and measurable work.",
    accent: "#24577a",
    font: "modern",
    density: "compact",
    sectionPriority: ["summary", "skills", "projects", "experience", "education", "awards", "custom"],
  },
  {
    id: "academic",
    label: "Education & Research",
    bestFor: "Schools & research",
    description: "Education-first hierarchy with a warm, scholarly editorial character.",
    accent: "#7a3045",
    font: "humanist",
    density: "comfortable",
    sectionPriority: ["education", "summary", "experience", "projects", "awards", "skills", "custom"],
  },
];

export const getResumeTheme = (id: ResumeLayout) =>
  resumeThemes.find((theme) => theme.id === id) ?? resumeThemes[1];
