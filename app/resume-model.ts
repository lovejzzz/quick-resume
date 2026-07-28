import type { ResumeFontId } from "./resume-fonts";

export type SectionKind =
  | "summary"
  | "experience"
  | "projects"
  | "education"
  | "skills"
  | "awards"
  | "custom";

export type ResumeEntry = {
  id: string;
  heading: string;
  subheading: string;
  date: string;
  details: string;
  bullets: string[];
  link?: string;
};

export type ResumeSection = {
  id: string;
  kind: SectionKind;
  title: string;
  entries: ResumeEntry[];
};

export type ResumeData = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  portfolio: string;
  secondaryLink: string;
  photo: string;
  sections: ResumeSection[];
};

export type ResumeLayout =
  | "classic"
  | "modern"
  | "executive"
  | "technical"
  | "academic";

export type ResumeStyle = {
  accent: string;
  font: "modern" | "classic" | "humanist";
  density: "comfortable" | "compact";
  fitLevel: number;
  fontAdjustments: Record<string, number>;
  layout: ResumeLayout;
  photoX: number;
  photoY: number;
  resumeFont: ResumeFontId;
  showPhoto: boolean;
};
