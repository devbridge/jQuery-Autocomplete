import type { AutocompleteOptions } from "./types";
import { formatGroup, formatResult, lookupFilter, transformResult } from "./format";

// `() => {}` instead of `$.noop` so this file has no load-time jQuery dependency.
// Specs do not assert on noop identity, only on no-op behavior.
const noop = (): void => {};

export const defaults: AutocompleteOptions = {
    ajaxSettings: {},
    autoSelectFirst: false,
    appendTo: "body",
    serviceUrl: null,
    lookup: null,
    onSelect: null,
    onHint: null,
    width: "auto",
    minChars: 1,
    maxHeight: 300,
    deferRequestBy: 0,
    params: {},
    formatResult: formatResult,
    formatGroup: formatGroup,
    delimiter: null,
    zIndex: 9999,
    type: "GET",
    noCache: false,
    onSearchStart: noop,
    onSearchComplete: noop,
    onSearchError: noop,
    preserveInput: false,
    containerClass: "autocomplete-suggestions",
    tabDisabled: false,
    dataType: "text",
    currentRequest: null,
    triggerSelectOnValidInput: true,
    preventBadQueries: true,
    lookupFilter: lookupFilter,
    paramName: "query",
    transformResult: transformResult,
    showNoSuggestionNotice: false,
    noSuggestionNotice: "No results",
    orientation: "bottom",
    forceFixPosition: false,
};
