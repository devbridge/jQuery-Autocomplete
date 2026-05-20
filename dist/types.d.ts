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
export type LookupFilter = (suggestion: Suggestion, originalQuery: string, queryLowerCase: string) => boolean;
export type TransformResult = (response: string | AutocompleteResponse, originalQuery: string) => AutocompleteResponse;
export type FormatResult = (suggestion: Suggestion, currentValue: string, index?: number) => string;
export type FormatGroup = (suggestion: Suggestion, category: string) => string;
export type SearchStartCallback = (this: HTMLElement, params: Record<string, unknown>) => unknown;
export type SearchCompleteCallback = (this: HTMLElement, query: string, suggestions: Suggestion[]) => void;
export type SearchErrorCallback = (this: HTMLElement, query: string, jqXHR: JQuery.jqXHR, textStatus: string, errorThrown: string) => void;
export type SelectCallback = (this: HTMLElement, suggestion: Suggestion) => void;
export type HintCallback = (this: HTMLElement, hint: string) => void;
export type HideCallback = (this: HTMLElement, container: JQuery) => void;
export type BeforeRenderCallback = (this: HTMLElement, container: JQuery, suggestions: Suggestion[]) => void;
export type InvalidateSelectionCallback = (this: HTMLElement) => void;
export interface AutocompleteOptions {
    ajaxSettings?: JQuery.AjaxSettings;
    autoSelectFirst?: boolean;
    appendTo?: string | Element | JQuery;
    serviceUrl?: ServiceUrl | null;
    lookup?: LookupArray | LookupCallback | null;
    onSelect?: SelectCallback | null;
    onHint?: HintCallback | null;
    width?: WidthOption;
    minChars?: number;
    maxHeight?: number;
    deferRequestBy?: number;
    params?: Record<string, unknown>;
    formatResult?: FormatResult;
    formatGroup?: FormatGroup;
    delimiter?: string | RegExp | null;
    zIndex?: number;
    type?: string;
    noCache?: boolean;
    onSearchStart?: SearchStartCallback;
    onSearchComplete?: SearchCompleteCallback;
    onSearchError?: SearchErrorCallback;
    onHide?: HideCallback;
    beforeRender?: BeforeRenderCallback;
    onInvalidateSelection?: InvalidateSelectionCallback;
    preserveInput?: boolean;
    containerClass?: string;
    tabDisabled?: boolean;
    dataType?: "text" | "json" | "jsonp";
    currentRequest?: JQuery.jqXHR | null;
    triggerSelectOnValidInput?: boolean;
    preventBadQueries?: boolean;
    lookupFilter?: LookupFilter;
    lookupLimit?: number | string;
    paramName?: string;
    transformResult?: TransformResult;
    showNoSuggestionNotice?: boolean;
    noSuggestionNotice?: string | HTMLElement | JQuery;
    orientation?: Orientation;
    forceFixPosition?: boolean;
    groupBy?: string;
    ignoreParams?: boolean;
}
