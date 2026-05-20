import { installAutocomplete } from "./jquery-plugin";

// `$` is supplied at runtime by the surrounding UMD wrapper (factory parameter
// — see scripts/build.mjs). esbuild leaves this as a free reference because
// it's only declared at type level here.
declare const $: JQueryStatic;

installAutocomplete($);
