# Repository Guidelines

## Project Structure & Module Organization

Flomo Web Clipper is a Chrome Manifest V3 extension using JavaScript ES modules, HTML, and CSS.

- `manifest.json` defines permissions, the module service worker, pages, and shortcuts.
- `src/background/` validates message senders and delegates to `src/utils/service.js`.
- `src/utils/api.js` owns HTTP sending; `storage.js` owns migration; `validation.js` validates notes, settings, and backups.
- `src/popup/` and `src/options/` contain the clipping interface and settings. `src/content/` is injected on demand using `activeTab` and `scripting`.
- `icons/` contains assets. `tests/` contains automated regressions; `test.html` contains manual fixtures. Public documentation lives at the repository root.

## Build, Test, and Development Commands

Use Node.js 22.12+ and run from the repository root:

- `npm ci`: install locked dependencies.
- `npm run check`: check JavaScript syntax.
- `npm test`: run Node's built-in test runner with mocked Chrome APIs and jsdom.
- `npm run dev`: watch and build with CSP-compatible source maps.
- `npm run build`: produce a production Webpack build and validate entry paths.
- `node build.js`: create an unbundled package without build dependencies.
- `npm audit --registry=https://registry.npmjs.org`: query dependency advisories.

Both builds preserve the `src/` layout in `dist/`. Load either the root or `dist/` in `chrome://extensions/`; preserve the existing directory when upgrading to retain extension identity and storage.

## Coding Style & Naming Conventions

Match surrounding indentation: two spaces in background/content scripts and Webpack configuration; four in utility and UI modules. Use semicolons, single-quoted strings, camelCase functions, and descriptive filenames. Preserve Chinese UI text. No formatter or linter is configured. Keep network and state mutations in the background service, and handle asynchronous errors explicitly.

## Testing Guidelines

Add regression tests for changed behavior in `tests/*.test.js`. Never send real flomo requests from tests. Cover business failures, ambiguous delivery, counters, migration, drafts, and untrusted inputs. No coverage threshold exists. Check both build paths when packaging changes. Use `test.html` for manual selection and UI checks; document browser validation limits.

## Commit & Pull Request Guidelines

Use focused commits and imperative subjects. PRs should describe behavior, issues, validation, and relevant UI screenshots. See `CONTRIBUTING.md`; stage intended files and run `npm run check:publication` before publishing.

## Security & Configuration

Keep webhook credentials local and exclude them from logs and backups. Render user text with DOM text APIs. Preserve delivery receipts during configuration resets. Local image upload is unsupported: preserve legacy attachments and block silent loss. Avoid new permissions, endpoints, or telemetry without user authorization.
