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
        // Same escaping channel as formatGroup — let the browser handle entities
        // so an HTML-bearing suggestion.value can't break out of the text node.
        const span = document.createElement("span");
        span.textContent = suggestion.value;
        return span.innerHTML;
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
    const div = document.createElement("div");
    div.className = "autocomplete-group";
    div.textContent = category;
    return div.outerHTML;
}
