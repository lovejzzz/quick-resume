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
    version: "0.3.4",
    date: "2026-07-30",
    notes: [
      "Final Review separates objective blockers from optional rule-based suggestions",
      "Job-posting terms use a literal comparison with no fit score or AI claims",
      "Clearer ATS-readable text preview and review-language disclosures",
    ],
  },
  {
    version: "0.3.3",
    date: "2026-07-30",
    notes: [
      "Transform-independent page measurement across desktop and mobile transitions",
      "Verified mobile preflight and PDF output after responsive layout changes",
    ],
  },
  {
    version: "0.3.2",
    date: "2026-07-30",
    notes: [
      "Job descriptions stay available while moving between Check and editing",
      "Accurate mobile page checks before the resume preview is opened",
      "GitHub Pages HTTPS certificate provisioning restarted for the custom domain",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-07-30",
    notes: [
      "Visible multi-resume switcher with New, import, duplicate, and backup actions",
      "Private job matching, bullet coaching, ATS text preview, and application preflight",
      "Focused Edit and Preview modes on mobile, with visible page-break guidance",
      "Autosave on this device, recovery snapshots, and cross-tab conflict protection",
      "Safer imports, backups, exports, offline upgrades, deployment, and production monitoring",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-07-28",
    notes: [
      "Keep several tailored resumes and switch between them",
      "Import an existing PDF or text resume as a first draft",
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
