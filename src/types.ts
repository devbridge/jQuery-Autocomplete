export interface Suggestion {
    value: string;
    data: unknown;
}

export interface AutocompleteResponse {
    query?: string | null;
    suggestions: Suggestion[];
}

export type LookupCallback = (query: string, done: (result: AutocompleteResponse) => void) => void;
export type LookupArray = string[] | Suggestion[];
export type ServiceUrl = string | ((this: HTMLElement, query: string) => string);

export type Orientation = "auto" | "top" | "bottom";
export type WidthOption = number | "auto" | "flex";

export type LookupFilter = (
    suggestion: Suggestion,
    originalQuery: string,
    queryLowerCase: string
) => boolean;

export type TransformResult = (
    response: string | AutocompleteResponse,
    originalQuery: string
) => AutocompleteResponse;

export type FormatResult = (suggestion: Suggestion, currentValue: string, index?: number) => string;

export type FormatGroup = (suggestion: Suggestion, category: string) => string;

export type SearchStartCallback = (this: HTMLElement, params: Record<string, unknown>) => unknown;
export type SearchCompleteCallback = (
    this: HTMLElement,
    query: string,
    suggestions: Suggestion[]
) => void;
export type SearchErrorCallback = (
    this: HTMLElement,
    query: string,
    jqXHR: JQuery.jqXHR,
    textStatus: string,
    errorThrown: string
) => void;
export type SelectCallback = (this: HTMLElement, suggestion: Suggestion) => void;
export type HintCallback = (this: HTMLElement, hint: string) => void;
export type HideCallback = (this: HTMLElement, container: JQuery) => void;
export type BeforeRenderCallback = (
    this: HTMLElement,
    container: JQuery,
    suggestions: Suggestion[]
) => void;
export type InvalidateSelectionCallback = (this: HTMLElement) => void;

// Fields that always have a value after the constructor merges supplied options
// with Autocomplete.defaults. Keeping these required in ResolvedOptions removes
// dozens of `as number` / `as string` / `!` casts from the implementation.
interface DefaultedOptions {
    ajaxSettings: JQuery.AjaxSettings;
    autoSelectFirst: boolean;
    appendTo: string | Element | JQuery;
    width: WidthOption;
    minChars: number;
    maxHeight: number;
    deferRequestBy: number;
    params: Record<string, unknown>;
    formatResult: FormatResult;
    formatGroup: FormatGroup;
    zIndex: number;
    type: string;
    noCache: boolean;
    onSearchStart: SearchStartCallback;
    onSearchComplete: SearchCompleteCallback;
    onSearchError: SearchErrorCallback;
    preserveInput: boolean;
    containerClass: string;
    tabDisabled: boolean;
    dataType: "text" | "json" | "jsonp";
    triggerSelectOnValidInput: boolean;
    preventBadQueries: boolean;
    lookupFilter: LookupFilter;
    paramName: string;
    transformResult: TransformResult;
    showNoSuggestionNotice: boolean;
    noSuggestionNotice: string | HTMLElement | JQuery;
    orientation: Orientation;
    forceFixPosition: boolean;
}

// Fields that are genuinely optional — no default exists. Code paths that read
// them must handle `undefined` (or `null` where the JS source documented it).
interface OptionalOptionsMixin {
    serviceUrl?: ServiceUrl | null;
    lookup?: LookupArray | LookupCallback | null;
    onSelect?: SelectCallback | null;
    onHint?: HintCallback | null;
    onHide?: HideCallback;
    beforeRender?: BeforeRenderCallback;
    onInvalidateSelection?: InvalidateSelectionCallback;
    delimiter?: string | RegExp | null;
    groupBy?: string;
    ignoreParams?: boolean;
    lookupLimit?: number | string;
}

// What consumers pass to `new Autocomplete(el, options)` and `setOptions(...)`:
// everything is optional.
export interface AutocompleteOptions extends Partial<DefaultedOptions>, OptionalOptionsMixin {}

// What `Autocomplete.options` and `Autocomplete.defaults` hold internally after
// merging. Defaulted fields are guaranteed present; truly optional ones aren't.
export interface ResolvedOptions extends DefaultedOptions, OptionalOptionsMixin {}
