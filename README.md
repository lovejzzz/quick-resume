# Quicky Resume

Quicky Resume is a privacy-friendly resume editor that runs entirely in the
browser. Edit the form or click directly into the live resume, reorganize
sections, check it against a job description, intelligently fit the document to
one page, and export it as an ATS-friendly PDF, PNG, or JPG.

There is no server, no database, no account, and no analytics. Everything —
including uploaded photos — stays in your browser's local storage.

The repository opens with **Tian Xing's resume as an example case**. The example
is defined in [`app/examples/tian-xing.ts`](app/examples/tian-xing.ts), separate
from the editor itself, so it can be replaced without changing product logic.

## Features

### Writing

- Edit through structured form fields or directly in the resume preview
- Import an existing PDF or plain-text resume as a first draft
- Keep several resumes side by side and tailor one per application
- Navigate sections from a sticky Content sidebar
- Add, remove, rename, and fluidly reorder sections with pointer or keyboard
- Multi-step undo and redo (`⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z`)
- Find U.S. colleges and universities with a local NCES/IPEDS autocomplete

### Review

- Paste a job description to see which of its terms your resume is missing
- Bullet-strength checks for weak openers, missing numbers, first-person
  phrasing, passive voice, and length

### Presentation

- Five research-backed layouts, then fine-tune typography, spacing, and accent
- 30 ranked professional fonts, including bundled open-source and ATS-safe
  system faces
- US Letter and A4, with one-page fitting matched to the selected size
- Per-row font-size adjustments with `−`, `+`, and reset controls
- Smart one-page fitting that compresses spacing before typography
- Upload an optional photo, then drag it anywhere while text reflows around it
- Contrast warning when an accent colour is too light to read on white

### Output

- Export selectable-text PDF through the browser print dialog
- Download high-resolution PNG and configurable-quality JPG
- See approximate file size and page count before export
- Back up and restore every resume as a JSON file
- Works offline once loaded, and can be installed as an app

## Run locally

Quicky Resume requires Node.js `22.13.0` or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server.

Useful checks:

```bash
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # static export into out/
npm test           # Playwright behaviour tests against the built export
```

`npm test` needs a browser once: `npm run test:install`. If your environment
already ships a Chromium that Playwright did not install, point at it with
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm test`.

## Project layout

```
app/
  components/   presentational panels and the resume paper
  hooks/        useWorkspace — state, history, persistence
  lib/          pure logic: storage, fitting, ATS matching, coaching, import
  examples/     the starter resume, kept out of product logic
  fonts/        subset wordmark face
scripts/        post-build service-worker manifest generation
tests/          Playwright behaviour and unit specs
```

Nothing in `lib/` touches the DOM, so it is directly unit-testable; components
receive data and callbacks and own no persistence logic.

## Data and storage

Resumes are stored under the `quick-resume` local-storage key as a versioned
payload:

```jsonc
{ "version": 2, "activeId": "…", "documents": [ /* … */ ] }
```

Loading is defensive by design. Every field is coerced to its expected type and
repaired when possible; an unreadable or malformed payload falls back to the
starter rather than throwing, because a value that crashes on load would be
re-read on every subsequent visit. Payloads written by earlier versions (a bare
`{ data, style }` pair with no version marker) are migrated on read.

Because the browser holds the only copy, **Export → Download backup** is the
supported way to move between devices or guard against clearing site data.

## Use a different starter resume

The data model lives in [`app/lib/resume-model.ts`](app/lib/resume-model.ts).
Create a new `ResumeData` object and import it in place of `tianXingExample`.

```ts
import type { ResumeData } from "../lib/resume-model";

export const exampleResume: ResumeData = {
  name: "Your Name",
  headline: "Your professional headline",
  email: "you@example.com",
  phone: "",
  location: "",
  portfolio: "",
  secondaryLink: "",
  photo: "",
  sections: [],
};
```

## Smart one-page fitting

The fitting control does not uniformly scale the document. It progressively
uses lower-impact adjustments:

1. section and entry spacing;
2. page margins and detail layout;
3. small, readability-limited typography changes.

The automatic action binary-searches for the lightest setting that fits within a
print-safe one-page height for the selected paper size. It never removes
content.

## Resume layouts

Quicky Resume includes five single-column layouts designed around common hiring
contexts:

- **ATS Classic** for conservative, general-purpose applications
- **Modern Professional** for business and nonprofit roles
- **Executive** for leadership candidates
- **Technical** for skills- and project-heavy applications
- **Education & Research** for schools, universities, and research roles

Selecting a layout changes visual hierarchy and places the most relevant
sections first without deleting content. Users can continue to reorder them.

The layouts deliberately avoid decorative columns, text boxes, and graphics.
That decision follows current guidance from
[UC Berkeley Career Engagement](https://www.career.berkeley.edu/prepare-for-success/resumes/),
[Harvard MCS](https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/),
and
[Penn Career Services](https://careerservices.upenn.edu/channels/resume/):
keep formatting simple, skimmable, consistent, and compatible with PDF export
and applicant tracking systems.

## Importing an existing resume

Content → **Import file** reads a PDF or plain-text resume with a dynamically
loaded [pdf.js](https://mozilla.github.io/pdf.js/) and maps recognised headings
onto sections. The file never leaves the browser.

This is a best-effort first draft, not a faithful conversion. Multi-column and
heavily designed PDFs extract poorly, and image-only scans contain no text at
all — the importer says so rather than producing silent nonsense. Always review
every section afterwards.

## Keyword matching

Review → paste a job description. The posting is tokenised, ranked by frequency
(favouring recurring two-word phrases), and diffed against your resume text, so
you can see which prominent terms a keyword-matching applicant tracking system
will not find.

It runs entirely in the browser. Add a term only when it is genuinely true of
your experience — keyword stuffing is obvious to the human who reads the resume
after the filter.

## Export behavior

- **PDF:** opens the browser print dialog using print-specific sizing for the
  selected paper size. Choose "Save as PDF." Text remains selectable for better
  ATS compatibility.
- **PNG / JPG:** captures the complete resume at the selected resolution.

Editor controls and inline formatting buttons are excluded from exported files.

## Technology

- React 19 and Next.js App Router, exported as a fully static site
- `html2canvas` for image export and `pdf.js` for import, both dynamically
  imported so neither is in the initial bundle
- A service worker precaches the shell for offline editing

## Deployment

```bash
npm run build   # emits a static site in out/
```

`out/` can be served by any static host. Every push to `main` publishes it to
<https://quickyresume.com/> via GitHub Actions.

To serve from a subdirectory instead of a domain root, set
`NEXT_PUBLIC_BASE_PATH` at build time (for example `/quick-resume`). It drives
Next's `basePath` and `assetPrefix`, the runtime asset helper in
[`app/lib/asset-path.ts`](app/lib/asset-path.ts), and the service-worker scope,
so runtime `fetch` calls stay correct.

## Release versioning

Release versions advance by exactly `0.0.1` each time. The version badge is read
from `package.json`, so a release means bumping that version and adding an entry
to [`app/lib/changelog.ts`](app/lib/changelog.ts).

## Credits

The wordmark uses **HVD Peace** by Hannes von Döhren
([HVD Fonts](https://www.fontspace.com/hvd-peace-font-f23071)), licensed
CC BY 3.0. The bundled face is subset to the glyphs of the wordmark; the
licence permits this provided the unmodified readme ships alongside it
([`app/fonts/HvdPeace-Readme.txt`](app/fonts/HvdPeace-Readme.txt)) and the
designer attribution remains in the font metadata, which it does.

College data is a snapshot of the U.S. Department of Education NCES/IPEDS
institution directory; see [`public/data/README.md`](public/data/README.md).
