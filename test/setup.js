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

// Load the plugin under test. The source is a UMD wrapper that picks up the
// global jQuery we just attached and registers $.Autocomplete and
// $.fn.autocomplete / $.fn.devbridgeAutocomplete.
await import("../src/jquery.autocomplete.js");
