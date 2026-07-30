import { tianXingExample } from "../examples/tian-xing";
import { judgeAccent } from "./contrast";
import type { ResumeData, ResumeStyle } from "./resume-model";

export type PreflightTarget = "content" | "style" | "export";
export type PreflightItem = {
  id: string;
  level: "pass" | "warning";
  title: string;
  detail: string;
  target: PreflightTarget;
};

const looksLikeLink = (value: string) =>
  !value.trim() || /^(https?:\/\/|mailto:|www\.|[\w.-]+\.[a-z]{2,})(\S*)$/i.test(value.trim());

export function buildPreflight(
  data: ResumeData,
  style: ResumeStyle,
  pageCount: number,
): PreflightItem[] {
  const items: PreflightItem[] = [];
  const add = (item: PreflightItem) => items.push(item);
  const exampleStillLoaded =
    data.name.trim() === tianXingExample.name &&
    data.email.trim() === tianXingExample.email &&
    data.headline.trim() === tianXingExample.headline;

  add({
    id: "identity",
    level: data.name.trim() && data.headline.trim() ? "pass" : "warning",
    title: data.name.trim() && data.headline.trim() ? "Identity is complete" : "Add your name and headline",
    detail: "Recruiters should immediately know who you are and the role you are targeting.",
    target: "content",
  });
  add({
    id: "contact",
    level: data.email.trim() || data.phone.trim() ? "pass" : "warning",
    title: data.email.trim() || data.phone.trim() ? "Contact method included" : "Add an email or phone number",
    detail: "Include at least one reliable way for an employer to reach you.",
    target: "content",
  });
  if (exampleStillLoaded) {
    add({
      id: "example",
      level: "warning",
      title: "The bundled example is still loaded",
      detail: "Replace Tian Xing’s example content before sending this resume.",
      target: "content",
    });
  }

  const emptySections = data.sections.filter(
    (section) =>
      !section.title.trim() ||
      section.entries.every(
        (entry) =>
          !entry.heading.trim() &&
          !entry.subheading.trim() &&
          !entry.details.trim() &&
          !entry.bullets.some((bullet) => bullet.trim()),
      ),
  );
  add({
    id: "sections",
    level: emptySections.length ? "warning" : "pass",
    title: emptySections.length
      ? `${emptySections.length} empty or untitled section${emptySections.length === 1 ? "" : "s"}`
      : "Sections contain content",
    detail: emptySections.length
      ? "Remove unfinished sections or complete them before exporting."
      : "No empty sections were found.",
    target: "content",
  });

  const links = [data.portfolio, data.secondaryLink, ...data.sections.flatMap((section) =>
    section.entries.map((entry) => entry.link ?? ""),
  )].filter((link) => link.trim());
  const invalidLinks = links.filter((link) => !looksLikeLink(link));
  add({
    id: "links",
    level: invalidLinks.length ? "warning" : "pass",
    title: invalidLinks.length ? "Check a link that may not open" : "Links look usable",
    detail: invalidLinks.length
      ? "Use a complete web address or a recognizable domain."
      : links.length
        ? "The link formats look valid; open the exported PDF once to verify them."
        : "No optional portfolio or project links are included.",
    target: "content",
  });

  const accent = judgeAccent(style.accent);
  add({
    id: "contrast",
    level: accent?.level === "pass" ? "pass" : "warning",
    title: accent?.level === "pass" ? "Accent contrast passes" : "Review accent contrast",
    detail: accent?.message ?? "Choose a valid accent color.",
    target: "style",
  });
  add({
    id: "pages",
    level: pageCount === 1 ? "pass" : "warning",
    title: pageCount === 1 ? `Fits one ${style.pageSize === "a4" ? "A4" : "US Letter"} page` : `${pageCount} pages`,
    detail:
      pageCount === 1
        ? "The current layout fits the selected paper size."
        : "Use Smart Fit or shorten lower-priority content if the role expects a one-page resume.",
    target: "export",
  });
  return items;
}
