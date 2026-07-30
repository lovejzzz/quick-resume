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
- Import an existing PDF, Word `.docx`, or plain-text resume as a first draft
- Read scanned PDFs with on-device text recognition, downloaded only when needed
- Keep several resumes side by side and tailor one per application
- Navigate sections from a sticky Content sidebar
- Add, remove, rename, and fluidly reorder sections with pointer or keyboard
- Multi-step undo and redo (`⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z`)
- Find U.S. colleges and universities with a local NCES/IPEDS autocomplete

### Check

- Paste a job description to see which of its terms your resume is missing
- Bullet-strength checks for weak openers, missing numbers, first-person
  phrasing, passive voice, and length
- Run a pre-export check for contact details, links, unfinished/example
  content, contrast, and page fit
- Preview the plain-text reading order an applicant tracking system can see

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
- Switch between focused Edit and Preview modes on mobile

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
npm run test:exports # desktop/mobile Chromium/WebKit export matrix
```

The Playwright suites need their browsers once: `npm run test:install`. If your environment
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

Edits are autosaved locally after a short delay, with one recovery snapshot
kept on the same device. Because the browser still holds the only copies,
**Export → Download backup** is the supported way to move between devices or
guard against clearing site data. Multiple open tabs detect competing edits
instead of silently overwriting each other.

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

Content → **Import file** reads a PDF, a Word `.docx`, or plain text, entirely
in the browser. The file never leaves the machine.

The pipeline runs in stages, each in its own module under
[`app/lib/import/`](app/lib/import):

1. **Extract** — pdf.js is loaded on demand and its text fragments are
   reassembled into visual lines. Word gaps are measured rather than assumed, so
   a letter-spaced heading does not become `E D U C A T I O N`; baselines are
   clustered with tolerance, so a right-aligned date stays on the same line as
   the job title it belongs to. A `.docx` is unzipped with `DecompressionStream`
   and read from its XML, which still carries list membership and bold runs.
2. **Arrange** — pages are split into columns by finding a vertical gutter no
   text crosses, so a sidebar is read as its own column instead of interleaving
   with the main one. Running headers, footers, and page numbers are dropped by
   spotting repeats in the top and bottom bands.
3. **Detect headings** — known section vocabulary first, then typographic
   evidence (caps, larger face, distinct font) so bespoke sections are still
   found. The header block is delimited by vocabulary only, because a name is
   also short, large, and distinctly set.
4. **Parse** — lines are grouped into entries. The role is chosen by evidence
   rather than position, so both the common "title then employer" order and
   LinkedIn's reverse order work. Indented or long unprefixed lines are treated
   as bullets, since PDF text extraction routinely drops list markers, and
   soft-wrapped lines are rejoined.

### When a PDF cannot be read

"No text found" covers several unrelated problems, so each is identified and
explained separately: a **scan** (ink but no text layer), a **broken font
encoding** (text that decodes to nonsense although the page looks perfect), a
**partial** text layer, and a genuinely **blank** file. The broken-encoding case
is the one worth naming — it is otherwise invisible, since the reader sees a
legible page and a tool claiming it cannot read it.

Detection is conservative: nonsense is only declared when vowel frequency and
common-word frequency both fail, at thresholds measured against the fixture
corpus, and the word list spans the major Latin-script languages so a French or
German resume is not mistaken for garbage.

### Text recognition

For a scan or a broken encoding, the editor offers to read the rendered pixels
instead. Recognition runs on-device with
[tesseract.js](https://github.com/naptha/tesseract.js); the engine, its WASM
core, and the language model are all served from this site rather than a CDN
(see [`scripts/copy-ocr-assets.mjs`](scripts/copy-ocr-assets.mjs)), so importing
a document still tells no one anything. About 6.7 MB downloads on first use and
is then cached for offline use; none of it is in the initial page load.

Recognition is never automatic and never silent. It is offered with its cost
stated, shows progress, and can be cancelled.

**Its output is checked differently from a text layer.** OCR confuses `0` with
`O`, `1` with `l`, and — observed in the test corpus — `y` with `v`, often at
full confidence. A wrong character in a bullet is obvious on reading; a wrong
character in an email address is not, and it silently breaks the only way an
employer can reply. So after recognition the editor quotes back exactly what it
read for the email, phone, and link, rather than merely advising you to check
them: seeing `priva.r@example.com` is what makes the error findable.

This remains a best-effort first draft, not a faithful conversion. Heavily
designed layouts still extract imperfectly. After an import you are told how
many sections, items, and bullets were recovered, and asked to check them.

Coverage is measured against a corpus of deliberately awkward layouts in
[`tests/fixtures/resumes/`](tests/fixtures/resumes) — letter-spaced headings, a
two-column sidebar, running headers across pages, wrapped bullets, a LinkedIn
export, and typographic edge cases. Each is rendered to a real PDF and imported
through the actual UI by
[`tests/import-fixtures.spec.ts`](tests/import-fixtures.spec.ts).

## Keyword matching

Check → paste a job description. The posting is tokenised, ranked by frequency
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

## Privacy and security

The product data flow and browser-storage risks are documented in
[`PRIVACY.md`](PRIVACY.md). Please report vulnerabilities privately as described
in [`SECURITY.md`](SECURITY.md).

## Contributing and license

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the local verification workflow.
Quicky Resume is available under the [MIT License](LICENSE).

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
