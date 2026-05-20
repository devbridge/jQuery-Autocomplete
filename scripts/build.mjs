import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { minify } from "terser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const path = (p) => resolve(repoRoot, p);

const pkg = JSON.parse(await readFile(path("package.json"), "utf8"));
const version = pkg.version;

// 1. dist/jquery.autocomplete.js: src with %version% substituted.
const srcPath = path("src/jquery.autocomplete.js");
const distPath = path("dist/jquery.autocomplete.js");
const source = await readFile(srcPath, "utf8");
const distSource = source.replace("%version%", version);
console.log(`Updating: ${distPath}`);
await writeFile(distPath, distSource);

// 2. dist/jquery.autocomplete.min.js: terser-minified with a fresh banner.
//    Banner format intentionally matches what gruntfile.js used to emit so
//    consumers tracking the minified file see a minimal diff across the
//    Grunt -> node build switch.
const minPath = path("dist/jquery.autocomplete.min.js");
// Terser's `preamble` is emitted verbatim and then a newline is appended
// before the minified code, so the banner itself must NOT end with one.
const banner = [
    "/**",
    `*  Ajax Autocomplete for jQuery, version ${version}`,
    "*  (c) 2025 Tomas Kirda",
    "*",
    "*  Ajax Autocomplete for jQuery is freely distributable under the terms of an MIT-style license.",
    "*  For details, see the web site: https://github.com/devbridge/jQuery-Autocomplete",
    "*/",
].join("\n");

const minified = await minify(distSource, {
    format: { preamble: banner },
});
if (minified.error) throw minified.error;
console.log(`Updating: ${minPath}`);
await writeFile(minPath, minified.code);

// 3. devbridge-autocomplete.jquery.json: sync version field.
const jqueryJsonPath = path("devbridge-autocomplete.jquery.json");
const jqueryJson = JSON.parse(await readFile(jqueryJsonPath, "utf8"));
if (jqueryJson.version !== version) {
    jqueryJson.version = version;
    console.log(`Updating: ${jqueryJsonPath}`);
    await writeFile(jqueryJsonPath, JSON.stringify(jqueryJson, null, 4) + "\n");
} else {
    console.log(`No updates for: ${jqueryJsonPath}`);
}
