# Security policy

## Reporting a vulnerability

Please do not disclose a security or privacy vulnerability in a public issue.
Use GitHub’s private vulnerability reporting for this repository instead.

Include the affected browser, a minimal reproduction, expected impact, and
whether the report involves imported files, backups, local storage, exports, or
the service worker. You should receive an initial response within seven days.

## Supported version

The deployed version at <https://quickyresume.com/> is supported. Quicky Resume
is a static application, so fixes are delivered by deploying a new shell and
service worker rather than by maintaining server releases.

## Security boundaries

Quicky Resume does not have a server, database, account system, or analytics.
Resume data and job descriptions stay in the browser. Imported files are
untrusted input and are subject to size, page, expansion, and schema limits.
See [PRIVACY.md](PRIVACY.md) for the data-flow and threat model.
