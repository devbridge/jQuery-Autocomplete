# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

TypeScript source under `src/` (~700 lines split into ~8 modules) compiles to a UMD bundle + an ESM bundle + a minified UMD + bundled `.d.ts` types in `dist/`. Edits belong in `src/*.ts`; never touch `dist/*` (the build overwrites it). The plugin is jQuery-only — `jQuery >=3.0` is a peer dependency.

`src/` layout:

| File | Role |
|---|---|
| `src/index.ts` | ESM entry point. Imports jquery, calls `installAutocomplete(jQuery)`, re-exports `Autocomplete` and types. |
| `src/umd-body.ts` | UMD entry point. References `$` as a free variable that the hand-written UMD wrapper (in `scripts/build.mjs`) provides as a factory parameter. |
| `src/jquery-plugin.ts` | `installAutocomplete($)` — registers `$.Autocomplete`, `$.fn.devbridgeAutocomplete`, and conditionally `$.fn.autocomplete` (jQuery UI guard). |
| `src/Autocomplete.ts` | The plugin class. |
| `src/defaults.ts` | The `Autocomplete.defaults` options object. |
| `src/format.ts` | Default `formatResult`, `formatGroup`, `lookupFilter`, `transformResult`. |
| `src/utils.ts` | `escapeRegExChars`, `createNode`, `keys` constants. |
| `src/jquery-ref.ts` | `export let $: JQueryStatic` set at install time via `setJQuery`. Live ES-module binding — every importer sees the value once `installAutocomplete` has run. |
| `src/types.ts` | Public types (`AutocompleteOptions`, `ResolvedOptions`, `Suggestion`, callback signatures). |

## Commands

- `npm test` — Vitest run (headless, jsdom). Single-shot, exits nonzero on failure.
- `npm run test:watch` — Vitest watch mode.
- `npm run lint` — ESLint over `test/` and `scripts/build.mjs`. **TS source is not linted by ESLint** — `tsc --noEmit` covers it via the `typecheck` script.
- `npm run typecheck` — `tsc --noEmit`. Strict mode; runs on `src/`.
- `npm run format` — Prettier rewrite of `src/`, `test/`, and `scripts/build.mjs` (100-col, 4-space, ES5 trailing commas). Demo files under `docs/` are intentionally excluded.
- `npm run format:check` — Prettier check-only, same scope. CI gate.
- `npm run build` — runs `scripts/build.mjs` (Node ESM): esbuild emits `dist/jquery.autocomplete.esm.js` (ESM) and `dist/jquery.autocomplete.js` / `.min.js` (UMD, hand-wrapped); `tsc --declaration` emits the `.d.ts` files; the version field in `devbridge-autocomplete.jquery.json` is synced from `package.json`.

## CI

`.github/workflows/ci.yml` runs on every push to `master` and every pull request: `npm ci`, then `lint`, `format:check`, `typecheck`, `test`, `build` — in that order, all required. Node 20 LTS, Ubuntu, single job. The `engines.node` field in `package.json` mirrors the runner version.

## Tests

Vitest + jsdom, headless. Specs live in `test/autocomplete.test.js`. `test/setup.js` attaches a single jQuery instance to `globalThis` / the jsdom `window`, registers `jquery-mockjax`, silences mockjax's per-request console logging, then calls `installAutocomplete(jQuery)` directly (bypassing the UMD wrapper). All test code shares one jQuery instance, one DOM, one set of plugin registrations.

`vitest.config.js` pins `pool: "forks"` with `isolate: false`. **Don't change either.** `threads` pool starved the worker handshake once we moved to TS source (esbuild transform overhead pushed startup past the 60s timeout). `isolate: false` keeps every spec in one process — same shared-module-state model the original Jasmine runner used, so describe blocks that mutate global jQuery state stay consistent.

To run a single test: `npx vitest run -t "test name substring"` or temporarily `describe.only` / `it.only`.

The demo page `docs/index.htm` is the manual test surface (Ajax lookup, local lookup with grouping, custom container, dynamic width) **and** the live demo published at https://devbridge.github.io/jQuery-Autocomplete/ via GitHub Pages (configured to serve from `master/docs`). It loads jQuery, mockjax, and the plugin itself from CDN (`cdn.jsdelivr.net/npm/devbridge-autocomplete@2/...`); open in a browser.

## Build internals

`scripts/build.mjs` does three things in order:

1. **ESM bundle** (`dist/jquery.autocomplete.esm.js`) — esbuild bundles `src/index.ts` with `external: ['jquery']`. Consumers `import 'devbridge-autocomplete'` and the plugin self-registers.
2. **UMD bundles** (`dist/jquery.autocomplete.js` and `.min.js`) — esbuild bundles `src/umd-body.ts` as IIFE (no `external`); the result is wrapped by a hand-written UMD detection shim (AMD / CommonJS / browser-global), with `$` flowing in as the factory parameter. The shim format intentionally matches the JS source that shipped before 2.0.0 so consumers don't see a contract change.
3. **Types** (`dist/*.d.ts`) — `tsc --declaration --emitDeclarationOnly`. One `.d.ts` per source file; `package.json` `types` points at `dist/index.d.ts`.

The minified UMD is ~13 KB; the unminified is ~26 KB.

## Release/version flow

1. Bump `version` in `package.json`.
2. `npm run build` — propagates the new version into the banner of each `dist/` JS file (via the build script) and syncs `devbridge-autocomplete.jquery.json`.

## Architecture notes that aren't obvious from a glance

- **Dual plugin name**: `$.fn.devbridgeAutocomplete` is always registered. `$.fn.autocomplete` is only aliased to it if not already taken (jQuery UI defines its own). Tests and the README rely on this fallback — don't remove the guard.
- **Live `$` binding**: `src/jquery-ref.ts` exports a `let $` that `installAutocomplete` mutates at install time via `setJQuery`. Every other module (Autocomplete, format, etc.) imports `{ $ }` and sees the live value. This avoids passing `$` through every constructor / function signature.
- **Two options types — pick the right one.** `AutocompleteOptions` is what consumers pass (everything optional). `ResolvedOptions` is what the constructor produces after deep-merging with `Autocomplete.defaults` — the ~29 defaulted fields are required, the ~12 truly optional ones stay optional. `this.options` and the static `defaults` are typed `ResolvedOptions`; method bodies read them directly without `as number` / `as string` casts. When adding a new option: put it in `DefaultedOptions` (and `src/defaults.ts`) if it has a default, otherwise in `OptionalOptionsMixin`. Also add it to the option tables in `readme.md`.
- **Defaults uses `() => {}` not `$.noop`** as the no-op callback. That avoids load-time `$` access (the file is imported before `installAutocomplete` runs). Specs don't assert on identity, only behavior.
- **Cached jQuery wrappers**: `this.$container` and `this.$noSuggestionsContainer` are set once in `initialize()` and used throughout. Don't re-wrap the underlying DOM nodes with `$(this.suggestionsContainer)` — the hot paths (`suggest`, `fixPosition`, `adjustScroll`, `hide`, `activate`) were deliberately refactored away from that.
- **Response normalization**: server responses pass through `transformResult` (default JSON.parse for `dataType: 'text'`). Local `lookup` may be an array or a `function(query, done)` callback; both paths converge on the same `{ value, data }` suggestion shape used everywhere downstream.
- **Caching + bad-query guard**: `cachedResponse` keys by query string; `preventBadQueries` records prefixes that returned no results so future queries with the same prefix short-circuit. `clearCache` / `clear` reset these — when adding new request paths, decide whether they should populate or honor these caches.
- **`findBestHint` is first-match-wins.** It uses `Array.prototype.find` because the original `$.each` callback stopped at the first prefix match by returning `false`. Don't "improve" it to a `for` loop that keeps scanning — that's a different algorithm (last-match wins) and breaks the hint behavior on adjacent matches.

## Conventions

- TypeScript strict mode is on. Don't introduce `any` in public types. Internal `as unknown as X` casts are OK at jQuery boundaries where typings are imprecise.
- Methods use `this` directly. The one exception is `initialize()`, which aliases `const self = this` for the jQuery delegation handlers (`function (this: HTMLElement)`) that need both `$(this)` for the matched element AND access to the Autocomplete instance. Don't add new `that = this` aliases elsewhere — use arrow functions for callbacks instead.
- Prefer native array methods (`.map`, `.filter`, `.find`, `.some`, `.indexOf`) over jQuery's `$.each` / `$.grep` / `$.map` / `$.inArray` in new code; the JS-source equivalents have already been swapped where semantics match.
- Prettier owns formatting. Run `npm run format` before committing source changes.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<optional scope>): <description>`.

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Description is imperative, lowercase, no trailing period (e.g. `fix: handle null suggestion data`).
- Breaking changes: append `!` after the type/scope (`feat!: ...`) and/or add a `BREAKING CHANGE:` footer.
- Scope, when useful, names the area touched: `build`, `test`, `deps`, `autocomplete`.

Examples: `test: port specs to vitest + jsdom`, `build: replace grunt with node script`, `chore(deps): bump prettier to 3.6.2`, `refactor!: rewrite source in typescript`.

## Pushing

**Never push without explicit confirmation.** Make the commit, show the diff if non-trivial, and wait for the user to say "push" (or equivalent) before `git push`. This applies to every branch including `master`, every push including tag pushes that fire the release workflow, and every working tree including this one and any auxiliary clones (e.g. GHSA private forks). Bundling commit + push in one shell invocation counts as pushing without confirmation — split them.
