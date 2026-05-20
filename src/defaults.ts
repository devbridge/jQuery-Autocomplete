import type { ResolvedOptions } from "./types";
import { formatGroup, formatResult, lookupFilter, transformResult } from "./format";

// `() => {}` instead of `$.noop` so this file has no load-time jQuery dependency.
// Specs do not assert on noop identity, only on no-op behavior.
const noop = (): void => {};

// Typed as ResolvedOptions (no Partial<>) — TypeScript will flag any future
// `DefaultedOptions` field added without a default here.
export const defaults: ResolvedOptions = {
    ajaxSettings: {},
    autoSelectFirst: false,
    appendTo: "body",
    width: "auto",
    minChars: 1,
    maxHeight: 300,
    deferRequestBy: 0,
    params: {},
    formatResult,
    formatGroup,
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
    triggerSelectOnValidInput: true,
    preventBadQueries: true,
    lookupFilter,
    paramName: "query",
    transformResult,
    showNoSuggestionNotice: false,
    noSuggestionNotice: "No results",
    orientation: "bottom",
    forceFixPosition: false,
};
