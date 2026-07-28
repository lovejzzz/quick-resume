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

export type PageSize = "letter" | "a4";

export type ResumeStyle = {
  accent: string;
  font: "modern" | "classic" | "humanist";
  density: "comfortable" | "compact";
  fitLevel: number;
  fontAdjustments: Record<string, number>;
  layout: ResumeLayout;
  pageSize: PageSize;
  photoX: number;
  photoY: number;
  resumeFont: ResumeFontId;
  showPhoto: boolean;
};

/** A single saved resume. Users keep several to tailor per application. */
export type ResumeDocument = {
  id: string;
  title: string;
  data: ResumeData;
  style: ResumeStyle;
  updatedAt: number;
};

export const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
