# Contributing

Thanks for helping improve Quicky Resume.

## Before opening a change

- Search existing issues and pull requests.
- Keep the browser-only privacy model intact: resume content, job descriptions,
  photos, and imported files must not leave the device.
- Prefer small changes with user-visible behavior tests.
- Avoid adding a dependency when the platform already supplies the capability.

## Local workflow

Quicky Resume requires Node.js 22.13.0 or newer.

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
npm run test:exports
```

Install the Playwright browsers once with `npm run test:install`.

## Pull requests

Explain the user problem, the chosen behavior, privacy implications, and how the
change was verified. Include before/after screenshots for visual work. New
imports, storage formats, or export paths need malformed-input and recovery
coverage.

By contributing, you agree that your contribution is licensed under the MIT
License.
