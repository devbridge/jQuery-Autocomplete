import jQuery from "jquery";
import mockjaxFactory from "jquery-mockjax";

// jsdom provides window/document. Attach jQuery to it and to the Node global so
// both the autocomplete source (which references the `jQuery` global) and the
// specs (which reference `$`) resolve to the same instance.
globalThis.jQuery = jQuery;
globalThis.$ = jQuery;
window.jQuery = jQuery;
window.$ = jQuery;

// Register mockjax on the same jQuery instance.
mockjaxFactory(jQuery, window);

// Silence mockjax's per-request console.log spam.
jQuery.mockjaxSettings.logging = 0;

// Load the plugin under test. Vitest's built-in esbuild transform handles the
// TS source. We import the plugin glue directly and pass it the same jQuery
// instance we attached above so all symbols register on a single jQuery.
const { installAutocomplete } = await import("../src/jquery-plugin.ts");
installAutocomplete(jQuery);
