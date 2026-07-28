import packageJson from "../../package.json" with { type: "json" };

export type Release = {
  version: string;
  date: string;
  notes: string[];
};

/** Single source of truth for the in-app version badge. */
export const appVersion: string = packageJson.version;

export const releases: Release[] = [
  {
    version: "0.3.0",
    date: "2026-07-28",
    notes: [
      "Keep several tailored resumes and switch between them",
      "Import an existing PDF or text resume as a first draft",
      "Job-description keyword matching and bullet-strength review",
      "A4 alongside US Letter, with matching one-page fitting",
      "Back up and restore everything as a JSON file",
      "Offline editing, and a far smaller first load",
    ],
  },
  {
    version: "0.2.9",
    date: "2026-07-28",
    notes: [
      "Clean text-only undo and redo controls with keyboard shortcuts",
      "Adaptive resume preview across screen sizes",
      "Stable navigation during smooth scrolling",
      "Simplified continuous preview without decorative page markers",
    ],
  },
  {
    version: "0.2.8",
    date: "2026-07-28",
    notes: [
      "Multi-step undo and redo beside Save",
      "Click-outside and Escape dismissal for the changelog",
      "Simplified Style and changelog headings",
    ],
  },
  {
    version: "0.2.7",
    date: "2026-07-28",
    notes: [
      "Editorial Glass interface with Swiss Kinetic details",
      "Freeform photo dragging across the full resume page",
      "Obstacle-aware text reflow with precise keyboard movement",
    ],
  },
  {
    version: "0.2.6",
    date: "2026-07-28",
    notes: [
      "Content navigation sidebar with section shortcuts",
      "Fluid pointer and keyboard section reordering",
      "Thirty ranked professional resume fonts",
    ],
  },
  {
    version: "0.2.5",
    date: "2026-07-28",
    notes: [
      "Branded browser tab icon",
      "U.S. college autocomplete powered by an IPEDS directory snapshot",
      "Draggable resume photo with smart header reflow",
    ],
  },
  {
    version: "0.2.4",
    date: "2026-07-28",
    notes: ["Branded confirmation dialogs", "HVD Peace wordmark and simplified header"],
  },
  {
    version: "0.2.3",
    date: "2026-07-28",
    notes: ["Default example action added to Content", "Simplified preview toolbar"],
  },
  {
    version: "0.2.2",
    date: "2026-07-28",
    notes: ["Manual save button replaces automatic saving", "Unsaved-change status and leave-page warning"],
  },
  {
    version: "0.2.1",
    date: "2026-07-28",
    notes: ["Clear all resume text while preserving sections", "Revised Tian Xing starter resume"],
  },
  {
    version: "0.2.0",
    date: "2026-07-28",
    notes: [
      "New artistic Quicky Resume brand mark",
      "Creator credit and in-app version history",
      "Latest Tian Xing resume added as the starter",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-27",
    notes: ["Five professional resume layouts", "Inline editing, smart one-page fit, and exports"],
  },
];
