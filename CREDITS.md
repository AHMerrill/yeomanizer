# Credits & attribution

The yeomanizer is open source under **Apache-2.0** (see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE)).
Everything it relies on is public, open material. This file records what was used and how.

## Authorities (U.S. Government, public domain)

The formatting rules and reference data are taken from public U.S. Government publications:

- **SECNAV M-5216.5** — Department of the Navy Correspondence Manual (the core format rules).
- **OPNAVINST 5400.45A** — underlined section-title lead-ins.
- **SECNAV M-5210.2** — Standard Subject Identification Codes (SSIC).
- **DoDI 5200.48**, the **ISOO CUI Marking Handbook**, and **32 CFR 2002** — Controlled Unclassified
  Information marking.

The **Department of Defense** and **Department of War** seals are U.S. Government works in the public
domain, used only at their prescribed size and ink for official letterhead.

## Open-source libraries (the code that runs)

Each is under a permissive license; the full license text ships inside the published package.

| Library | Purpose | License |
|---|---|---|
| [React](https://react.dev) / React-DOM | UI | MIT |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | searchable/vector PDF generation | MIT |
| [docx](https://github.com/dolanmiu/docx) | Word `.docx` generation | MIT |
| [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) | rasterizing PDF enclosure pages for the `.docx` | Apache-2.0 |
| [JSZip](https://github.com/Stuk/jszip) | re-packing the `.docx` to strip metadata | MIT |
| [Vite](https://vite.dev) | build tooling | MIT |
| [TypeScript](https://www.typescriptlang.org) | language/types | Apache-2.0 |

## Ideas learned from other open-source projects (no code copied)

Several open-source naval-correspondence tools informed *feature ideas* here. **No source code was
copied from any of them** — every feature in this app was written from scratch (clean-room). They are
credited in good faith:

- **dondocs** (marinecoders) — MIT app code. Examples, in-context learning, richer menus.
- **SemperScribe** (SemperAdmin) — MIT. A proofread checklist tied to the manual; a published threat model.
- **navalletterformat** (jeranaias) — MIT. Editor UX (reordering, templates), session-only PII handling.
- **mildoc-lint** (cjchanh) — Apache-2.0. The model for deterministic pre-export checks + a threat model.

If a credit is missing or wrong, please open an issue and we'll correct it.
