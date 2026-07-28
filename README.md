# Quick Resume

Quick Resume is a privacy-friendly resume editor that runs entirely in the
browser. Edit the form or click directly into the live resume, reorganize
sections, intelligently fit the document to one page, and export it as an
ATS-friendly PDF, PNG, or JPG.

The repository opens with **Tian Xing's resume as an example case**. The example
is defined in [`app/examples/tian-xing.ts`](app/examples/tian-xing.ts), separate
from the editor itself, so it can be replaced without changing the product
logic.

## Features

- Edit through structured form fields or directly in the resume preview
- Add, remove, rename, and reorder resume sections
- Locally autosave changes without an account or database
- Apply per-row font-size adjustments with `−`, `+`, and reset controls
- Use smart one-page fitting that compresses spacing before typography
- Upload an optional photo
- Choose typography, spacing, and accent color
- Export selectable-text PDF through the browser print dialog
- Download high-resolution PNG and configurable-quality JPG
- See approximate file size and page count before export

## Run locally

Quick Resume requires Node.js `22.13.0` or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server.

Useful checks:

```bash
npm run build
npm test
npm run lint
```

## Use a different starter resume

The data model lives in [`app/resume-model.ts`](app/resume-model.ts). Create a
new `ResumeData` object and import it in `app/page.tsx` in place of
`tianXingExample`.

```ts
import type { ResumeData } from "../resume-model";

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

Browser edits are saved under the `quick-resume` local-storage key. Resetting
the editor restores the example bundled with the source.

## Smart one-page fitting

The fitting control does not uniformly scale the document. It progressively
uses lower-impact adjustments:

1. section and entry spacing;
2. page margins and detail layout;
3. small, readability-limited typography changes.

The automatic action finds the lightest setting that fits within a print-safe
one-page height. It never removes content.

## Export behavior

- **PDF:** opens the browser print dialog and uses print-specific Letter sizing.
  Choose “Save as PDF.” Text remains selectable for better ATS compatibility.
- **PNG:** captures the complete resume at the selected resolution.
- **JPG:** captures the complete resume with adjustable quality for a smaller
  file.

Editor controls and inline formatting buttons are excluded from exported files.

## Privacy

Resume edits and uploaded photos stay in the browser's local storage. Quick
Resume has no application database, analytics, or account requirement.

## Technology

- React 19 and Next.js App Router
- [vinext](https://github.com/cloudflare/vinext) and Vite
- Cloudflare Workers-compatible build output
- `html2canvas` for image export

## Deployment

Build the deployable worker:

```bash
npm run build
```

The repository includes the Vinext/Cloudflare worker configuration used by the
hosted example. Other compatible Cloudflare Workers deployment workflows can
use the generated `dist/` output.
