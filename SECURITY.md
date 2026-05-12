# Security Policy

Cumplø is a local-first browser application served from `127.0.0.1` and designed to connect only to the user's local Ollama instance.

## Supported versions

Security fixes are prioritised for the latest public beta release.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through the repository issue tracker or by contacting the maintainer. Do not include sensitive personal data in public reports.

Useful information in a report:

- Cumplø version.
- Operating system and browser.
- Whether Ollama was running and which model was active.
- Steps to reproduce.
- Expected and observed behaviour.

## Scope

In scope:

- Local server security issues.
- CSP or browser isolation regressions.
- Unsafe import/export behaviour.
- Accidental persistence or distribution of local/private data.
- Prompt-output handling that could result in unsafe rendering.

Out of scope:

- Quality of task decomposition by a specific local model.
- Issues caused by modified third-party distributions.
- Vulnerabilities in Ollama or in local models themselves.
