import type { AutocompleteResponse, Suggestion } from "./types";
import { utils } from "./utils";

export function lookupFilter(
    suggestion: Suggestion,
    _originalQuery: string,
    queryLowerCase: string
): boolean {
    return suggestion.value.toLowerCase().indexOf(queryLowerCase) !== -1;
}

export function transformResult(response: string | AutocompleteResponse): AutocompleteResponse {
    return typeof response === "string" ? (JSON.parse(response) as AutocompleteResponse) : response;
}

export function formatResult(suggestion: Suggestion, currentValue: string): string {
    if (!currentValue) {
        return suggestion.value;
    }

    const pattern = "(" + utils.escapeRegExChars(currentValue) + ")";

    return suggestion.value
        .replace(new RegExp(pattern, "gi"), "<strong>$1</strong>")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/&lt;(\/?strong)&gt;/g, "<$1>");
}

export function formatGroup(_suggestion: Suggestion, category: string): string {
    return '<div class="autocomplete-group">' + category + "</div>";
}
