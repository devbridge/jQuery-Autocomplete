# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

This is a single-file jQuery plugin (Ajax Autocomplete). The entire implementation lives in `src/jquery.autocomplete.js` (~1k lines). Everything else — `dist/`, `typings/`, `spec/`, `scripts/`, `index.htm` — is produced from, tests, types, or demos that one source file. Edits almost always belong in `src/jquery.autocomplete.js`; never edit `dist/*` directly (the build overwrites it).

## Commands

- `npm test` — Vitest run (headless, jsdom). Single-shot, exits nonzero on failure.
- `npm run test:watch` — Vitest watch mode for local TDD.
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`) over `src/`, `test/`, and `scripts/build.mjs`.
- `npm run format` — Prettier rewrite of `src/`, `test/`, and `scripts/build.mjs` (100-col, 4-space, ES5 trailing commas — config in `package.json`). Demo files under `scripts/` (`countries.js`, `demo.js`) are intentionally excluded.
- `npm run format:check` — Prettier check-only, same scope. Used by CI; fails if anything would be rewritten.
- `npm run build` — runs `scripts/build.mjs` (Node ESM, no bundler): copies `src/jquery.autocomplete.js` to `dist/jquery.autocomplete.js` while substituting the `%version%` placeholder with `package.json` `version`, minifies to `dist/jquery.autocomplete.min.js` via terser with a fresh banner, and syncs `devbridge-autocomplete.jquery.json` version. Run this before release/commit when source changes.

## CI

`.github/workflows/ci.yml` runs on every push to `master` and every pull request: `npm ci`, then `lint`, `format:check`, `test`, `build` — in that order, all required. Node 20 LTS, Ubuntu, single job. The `engines.node` field in `package.json` mirrors the runner version.

## Tests

Vitest + jsdom, headless. Specs live in `test/autocomplete.test.js`. `test/setup.js` attaches a single jQuery instance to the jsdom `window` and `globalThis`, registers `jquery-mockjax` against it, silences mockjax's per-request console logging, then loads `src/jquery.autocomplete.js`. The plugin's UMD wrapper picks up `globalThis.jQuery` and registers `$.Autocomplete` plus `$.fn.autocomplete`/`$.fn.devbridgeAutocomplete` against that same instance.

The Vitest pool is pinned to `threads` in `vitest.config.js` — the default `forks` pool times out the worker handshake on Windows when the setup file does heavy synchronous work (jQuery + mockjax + UMD plugin load). Don't switch pools without re-verifying.

To run a single test, use `npx vitest run -t "test name substring"` or temporarily change `describe`/`it` to `describe.only`/`it.only`.

The demo page `index.htm` is the manual test surface (Ajax lookup, local lookup with grouping, custom container, dynamic width). It loads jQuery + mockjax from CDN; just open in a browser.

## Release/version flow

1. Bump `version` in `package.json`.
2. `npm run build` — this propagates the new version into `dist/jquery.autocomplete.js` (via `%version%` placeholder) and `devbridge-autocomplete.jquery.json`. The placeholder only exists in `src/`; do not hand-edit version strings in `dist/`.

## Architecture notes that aren't obvious from a single file

- **UMD wrapper** at the top of `src/jquery.autocomplete.js` registers under AMD, CommonJS, or browser global — keep all three branches working when touching the wrapper.
- **Dual plugin name**: registers `$.fn.devbridgeAutocomplete` unconditionally, and aliases `$.fn.autocomplete` only if it is not already taken (jQuery UI defines one). Tests and the README rely on this fallback behavior — don't remove the guard.
- **Defaults live on `Autocomplete.defaults`** and are merged per-instance via `$.extend(true, {}, defaults, options)`. New options must be added to the defaults object so deep-merge picks them up, and mirrored in `typings/jquery.autocomplete.d.ts` and the option tables in `readme.md`.
- **Response normalization**: server responses pass through `transformResult` (default JSON.parse for `dataType: 'text'`). Local `lookup` may be an array or a `function(query, done)` callback; both paths converge on the same `{ value, data }` suggestion shape used everywhere downstream (`formatResult`, `onSelect`, grouping).
- **Caching + bad-query guard**: `cachedResponse` keys by query string, and `preventBadQueries` records prefixes that returned no results so future queries with the same prefix short-circuit. `clearCache` / `clear` reset these — when adding new request paths, decide whether they should populate or honor these caches.

## Conventions

- Source style is the existing one: ES5 inside the IIFE (no `let`/`const`/arrow funcs in `src/jquery.autocomplete.js`), `"use strict"`, `var that = this` pattern. ESLint config targets `ecmaVersion: 2022` but the file is intentionally written to run in old browsers — match the existing style rather than modernizing.
- Prettier owns formatting; run `npm run format` before committing source changes.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<optional scope>): <description>`.

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Description is imperative, lowercase, no trailing period (e.g. `fix: handle null suggestion data`).
- Breaking changes: append `!` after the type/scope (`feat!: ...`) and/or add a `BREAKING CHANGE:` footer.
- Scope, when useful, names the area touched: `build`, `test`, `deps`, `autocomplete`.

Examples: `test: port specs to vitest + jsdom`, `build: replace grunt with node script`, `chore(deps): bump prettier to 3.6.2`, `feat!: drop ie11 support`.
