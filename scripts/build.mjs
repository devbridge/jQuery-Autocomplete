import { execFileSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const path = (p) => resolve(repoRoot, p);

const pkg = JSON.parse(await readFile(path("package.json"), "utf8"));
const version = pkg.version;

const banner = [
    "/**",
    `*  Ajax Autocomplete for jQuery, version ${version}`,
    "*  (c) 2012-2026 Tomas Kirda and contributors",
    "*",
    "*  Ajax Autocomplete for jQuery is freely distributable under the terms of an MIT-style license.",
    "*  For details, see the web site: https://github.com/devbridge/jQuery-Autocomplete",
    "*/",
].join("\n");

// Hand-written UMD wrapper. Matches the AMD / CommonJS / browser-global
// detection the original JS source shipped, so existing consumers don't have
// to change a thing.
const umdHead =
    `(function (factory) {\n` +
    `    "use strict";\n` +
    `    if (typeof define === "function" && define.amd) {\n` +
    `        define(["jquery"], factory);\n` +
    `    } else if (typeof exports === "object" && typeof require === "function") {\n` +
    `        factory(require("jquery"));\n` +
    `    } else {\n` +
    `        factory(jQuery);\n` +
    `    }\n` +
    `})(function ($) {\n`;
const umdTail = `\n});\n`;

await rm(path("dist"), { recursive: true, force: true });

// 1. ESM bundle. Consumers do `import 'devbridge-autocomplete'` and the plugin
//    self-registers against jquery (imported as an ESM external).
console.log("Building: dist/jquery.autocomplete.esm.js");
await esbuild({
    entryPoints: [path("src/index.ts")],
    bundle: true,
    format: "esm",
    target: "es2020",
    platform: "neutral",
    external: ["jquery"],
    outfile: path("dist/jquery.autocomplete.esm.js"),
    banner: { js: banner },
    legalComments: "none",
});

// 2. UMD bundle. esbuild bundles src/umd-body.ts as IIFE; we wrap that body in
//    the UMD detection shim above. `$` inside umd-body.ts is a free reference
//    that binds to the factory parameter at runtime.
async function buildUmd(outfile, minify) {
    const result = await esbuild({
        entryPoints: [path("src/umd-body.ts")],
        bundle: true,
        write: false,
        format: "iife",
        target: "es2020",
        minify,
        legalComments: "none",
    });
    const body = result.outputFiles[0].text;
    const wrapped = banner + "\n" + umdHead + body + umdTail;
    console.log(`Building: ${outfile}`);
    await writeFile(outfile, wrapped);
}

await buildUmd(path("dist/jquery.autocomplete.js"), false);
await buildUmd(path("dist/jquery.autocomplete.min.js"), true);

// 3. Types: tsc --declaration --emitDeclarationOnly (config in tsconfig.json).
console.log("Building: dist/*.d.ts");
execFileSync("npx", ["--no-install", "tsc"], { stdio: "inherit", cwd: repoRoot, shell: true });

// 4. Sync version in devbridge-autocomplete.jquery.json.
const jqueryJsonPath = path("devbridge-autocomplete.jquery.json");
const jqueryJson = JSON.parse(await readFile(jqueryJsonPath, "utf8"));
if (jqueryJson.version !== version) {
    jqueryJson.version = version;
    console.log(`Updating: ${jqueryJsonPath}`);
    await writeFile(jqueryJsonPath, JSON.stringify(jqueryJson, null, 4) + "\n");
} else {
    console.log(`No updates for: ${jqueryJsonPath}`);
}
