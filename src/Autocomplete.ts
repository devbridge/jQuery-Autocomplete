import { $ } from "./jquery-ref";
import { defaults } from "./defaults";
import { keys, utils } from "./utils";
import type {
    AutocompleteOptions,
    AutocompleteResponse,
    LookupArray,
    LookupCallback,
    Orientation,
    ResolvedOptions,
    ServiceUrl,
    Suggestion,
} from "./types";

interface Classes {
    selected: string;
    suggestion: string;
}

export class Autocomplete {
    static defaults: ResolvedOptions = defaults;
    static utils = utils;

    element: HTMLInputElement;
    el: JQuery;
    suggestions: Suggestion[] = [];
    badQueries: string[] = [];
    selectedIndex = -1;
    currentValue: string;
    cachedResponse: Record<string, AutocompleteResponse> = {};
    onChangeTimeout: ReturnType<typeof setTimeout> | null = null;
    isLocal = false;
    suggestionsContainer!: HTMLDivElement;
    noSuggestionsContainer!: HTMLElement;
    // Cached jQuery wrappers — avoid re-wrapping the same DOM node on every
    // method call (~12 call sites used to invoke `$(this.suggestionsContainer)`).
    $container!: JQuery;
    $noSuggestionsContainer!: JQuery;
    options: ResolvedOptions;
    classes: Classes = {
        selected: "autocomplete-selected",
        suggestion: "autocomplete-suggestion",
    };
    hint: Suggestion | null = null;
    hintValue = "";
    selection: Suggestion | null = null;

    disabled?: boolean;
    visible?: boolean;
    ignoreValueChange?: boolean;
    blurTimeoutId?: ReturnType<typeof setTimeout>;
    fixPositionCapture?: () => void;
    currentRequest: JQuery.jqXHR | null = null;

    constructor(el: HTMLInputElement, options?: AutocompleteOptions) {
        this.element = el;
        this.el = $(el);
        this.currentValue = el.value;
        // Deep merge stays on $.extend — native spread is shallow.
        this.options = $.extend(true, {}, Autocomplete.defaults, options) as ResolvedOptions;

        this.initialize();
        this.setOptions(options);
    }

    initialize(): void {
        // jQuery rebinds `this` inside delegation handlers to the matched DOM
        // element, so handlers that need both `$(this)` (the element) AND
        // access to the Autocomplete instance use `self` for the latter.
        const self = this;
        const suggestionSelector = `.${this.classes.suggestion}`;
        const selected = this.classes.selected;
        const options = this.options;

        this.element.setAttribute("autocomplete", "off");

        // html() deals with many types: htmlString or Element or Array or jQuery
        this.$noSuggestionsContainer = $('<div class="autocomplete-no-suggestion"></div>').html(
            options.noSuggestionNotice as string
        );
        this.noSuggestionsContainer = this.$noSuggestionsContainer.get(0) as HTMLElement;

        this.suggestionsContainer = Autocomplete.utils.createNode(options.containerClass);
        this.$container = $(this.suggestionsContainer);
        this.$container.appendTo(options.appendTo || "body");

        if (options.width !== "auto") {
            this.$container.css("width", options.width);
        }

        const container = this.$container;

        container.on("mouseover.autocomplete", suggestionSelector, function (this: HTMLElement) {
            self.activate($(this).data("index") as number);
        });

        container.on("click.autocomplete", suggestionSelector, function (this: HTMLElement) {
            self.select($(this).data("index") as number);
        });

        container.on("mouseout.autocomplete", () => {
            this.selectedIndex = -1;
            container.children(`.${selected}`).removeClass(selected);
        });

        container.on("click.autocomplete", () => {
            if (this.blurTimeoutId !== undefined) {
                clearTimeout(this.blurTimeoutId);
            }
        });

        this.fixPositionCapture = () => {
            if (this.visible) {
                this.fixPosition();
            }
        };

        $(window).on("resize.autocomplete", this.fixPositionCapture);

        this.el.on("keydown.autocomplete", (e) => this.onKeyPress(e));
        this.el.on("keyup.autocomplete", (e) => this.onKeyUp(e));
        this.el.on("blur.autocomplete", () => this.onBlur());
        this.el.on("focus.autocomplete", () => this.onFocus());
        this.el.on("change.autocomplete", (e) => this.onKeyUp(e));
        this.el.on("input.autocomplete", (e) => this.onKeyUp(e));
    }

    onFocus(): void {
        if (this.disabled) {
            return;
        }
        this.fixPosition();
        if ((this.el.val() as string).length >= this.options.minChars) {
            this.onValueChange();
        }
    }

    onBlur(): void {
        const options = this.options;
        const query = this.getQuery(this.el.val() as string);

        this.blurTimeoutId = setTimeout(() => {
            this.hide();
            if (this.selection && this.currentValue !== query) {
                options.onInvalidateSelection?.call(this.element);
            }
        }, 200);
    }

    abortAjax(): void {
        if (this.currentRequest) {
            this.currentRequest.abort();
            this.currentRequest = null;
        }
    }

    setOptions(suppliedOptions?: AutocompleteOptions): void {
        const options = { ...this.options, ...suppliedOptions } as ResolvedOptions;

        this.isLocal = Array.isArray(options.lookup);
        if (this.isLocal) {
            options.lookup = this.verifySuggestionsFormat(options.lookup as LookupArray);
        }
        options.orientation = this.validateOrientation(options.orientation, "bottom");

        this.$container.css({
            "max-height": `${options.maxHeight}px`,
            width: `${options.width}px`,
            "z-index": options.zIndex,
        });

        this.options = options;
    }

    clearCache(): void {
        this.cachedResponse = {};
        this.badQueries = [];
    }

    clear(): void {
        this.clearCache();
        this.currentValue = "";
        this.suggestions = [];
    }

    disable(): void {
        this.disabled = true;
        if (this.onChangeTimeout) {
            clearTimeout(this.onChangeTimeout);
        }
        this.abortAjax();
    }

    enable(): void {
        this.disabled = false;
    }

    fixPosition(): void {
        const $container = this.$container;
        const containerParent = $container.parent().get(0);

        if (containerParent !== document.body && !this.options.forceFixPosition) {
            return;
        }

        let orientation = this.options.orientation;
        const containerHeight = $container.outerHeight() ?? 0;
        const height = this.el.outerHeight() ?? 0;
        const offset = this.el.offset() ?? { top: 0, left: 0 };
        const styles: { top: number; left: number; width?: string } = {
            top: offset.top,
            left: offset.left,
        };

        if (orientation === "auto") {
            const viewPortHeight = $(window).height() ?? 0;
            const scrollTop = $(window).scrollTop() ?? 0;
            const topOverflow = -scrollTop + offset.top - containerHeight;
            const bottomOverflow =
                scrollTop + viewPortHeight - (offset.top + height + containerHeight);

            orientation = Math.max(topOverflow, bottomOverflow) === topOverflow ? "top" : "bottom";
        }

        styles.top += orientation === "top" ? -containerHeight : height;

        if (containerParent !== document.body && containerParent !== undefined) {
            const opacity = $container.css("opacity");

            if (!this.visible) {
                $container.css("opacity", 0).show();
            }

            const parentOffsetDiff = $container.offsetParent().offset() ?? { top: 0, left: 0 };
            styles.top -= parentOffsetDiff.top;
            styles.top += containerParent.scrollTop;
            styles.left -= parentOffsetDiff.left;

            if (!this.visible) {
                $container.css("opacity", opacity).hide();
            }
        }

        if (this.options.width === "auto") {
            styles.width = `${this.el.outerWidth() ?? 0}px`;
        }

        $container.css(styles);
    }

    isCursorAtEnd(): boolean {
        const valLength = (this.el.val() as string).length;
        const { selectionStart } = this.element;
        return typeof selectionStart === "number" ? selectionStart === valLength : true;
    }

    onKeyPress(e: JQuery.KeyDownEvent): void {
        if (!this.disabled && !this.visible && e.which === keys.DOWN && this.currentValue) {
            this.suggest();
            return;
        }

        if (this.disabled || !this.visible) {
            return;
        }

        switch (e.which) {
            case keys.ESC:
                this.el.val(this.currentValue);
                this.hide();
                break;
            case keys.RIGHT:
                if (this.hint && this.options.onHint && this.isCursorAtEnd()) {
                    this.selectHint();
                    break;
                }
                return;
            case keys.TAB:
                if (this.hint && this.options.onHint) {
                    this.selectHint();
                    return;
                }
                if (this.selectedIndex === -1) {
                    this.hide();
                    return;
                }
                this.select(this.selectedIndex);
                if (this.options.tabDisabled === false) {
                    return;
                }
                break;
            case keys.RETURN:
                if (this.selectedIndex === -1) {
                    this.hide();
                    return;
                }
                this.select(this.selectedIndex);
                break;
            case keys.UP:
                this.moveUp();
                break;
            case keys.DOWN:
                this.moveDown();
                break;
            default:
                return;
        }

        e.stopImmediatePropagation();
        e.preventDefault();
    }

    onKeyUp(e: JQuery.TriggeredEvent): void {
        if (this.disabled) {
            return;
        }

        if (e.which === keys.UP || e.which === keys.DOWN) {
            return;
        }

        if (this.onChangeTimeout) {
            clearTimeout(this.onChangeTimeout);
        }

        if (this.currentValue !== this.el.val()) {
            this.findBestHint();
            if (this.options.deferRequestBy > 0) {
                this.onChangeTimeout = setTimeout(
                    () => this.onValueChange(),
                    this.options.deferRequestBy
                );
            } else {
                this.onValueChange();
            }
        }
    }

    onValueChange(): void {
        if (this.ignoreValueChange) {
            this.ignoreValueChange = false;
            return;
        }

        const options = this.options;
        const value = this.el.val() as string;
        const query = this.getQuery(value);

        if (this.selection && this.currentValue !== query) {
            this.selection = null;
            options.onInvalidateSelection?.call(this.element);
        }

        if (this.onChangeTimeout) {
            clearTimeout(this.onChangeTimeout);
        }
        this.currentValue = value;
        this.selectedIndex = -1;

        if (options.triggerSelectOnValidInput && this.isExactMatch(query)) {
            this.select(0);
            return;
        }

        if (query.length < options.minChars) {
            this.hide();
        } else {
            this.getSuggestions(query);
        }
    }

    isExactMatch(query: string): boolean {
        const { suggestions } = this;
        return (
            suggestions.length === 1 && suggestions[0]!.value.toLowerCase() === query.toLowerCase()
        );
    }

    getQuery(value: string): string {
        const { delimiter } = this.options;
        if (!delimiter) {
            return value;
        }
        const parts = value.split(delimiter);
        return parts[parts.length - 1]!.trim();
    }

    getSuggestionsLocal(query: string): AutocompleteResponse {
        const options = this.options;
        const queryLowerCase = query.toLowerCase();
        const filter = options.lookupFilter;
        const limit = parseInt(options.lookupLimit as string, 10);

        const lookup = options.lookup as Suggestion[];
        const matched = lookup.filter((suggestion) => filter(suggestion, query, queryLowerCase));

        return {
            suggestions: limit && matched.length > limit ? matched.slice(0, limit) : matched,
        };
    }

    getSuggestions(q: string): void {
        const options = this.options;
        let serviceUrl = options.serviceUrl as ServiceUrl;
        let response: AutocompleteResponse | undefined;
        let cacheKey: string | undefined;

        options.params[options.paramName] = q;

        if (options.onSearchStart.call(this.element, options.params) === false) {
            return;
        }

        const params = options.ignoreParams ? null : options.params;

        if (typeof options.lookup === "function") {
            (options.lookup as LookupCallback)(q, (data) => {
                const suggestions = this.verifySuggestionsFormat(data.suggestions);
                this.suggestions = suggestions;
                // Fire onSearchComplete before suggest() so consumers see
                // "search complete" before any auto-select fires onSelect.
                options.onSearchComplete.call(this.element, q, suggestions);
                this.suggest();
            });
            return;
        }

        if (this.isLocal) {
            response = this.getSuggestionsLocal(q);
        } else {
            if (typeof serviceUrl === "function") {
                serviceUrl = serviceUrl.call(this.element, q);
            }
            cacheKey = `${serviceUrl}?${$.param(params ?? {})}`;
            response = this.cachedResponse[cacheKey];
        }

        if (response && Array.isArray(response.suggestions)) {
            this.suggestions = response.suggestions;
            options.onSearchComplete.call(this.element, q, response.suggestions);
            this.suggest();
        } else if (!this.isBadQuery(q)) {
            this.abortAjax();

            const ajaxSettings: JQuery.AjaxSettings = {
                url: serviceUrl as string,
                data: params ?? undefined,
                type: options.type,
                dataType: options.dataType,
                ...options.ajaxSettings,
            };

            this.currentRequest = $.ajax(ajaxSettings)
                .done((data) => {
                    this.currentRequest = null;
                    const result = options.transformResult(data, q);
                    result.suggestions = this.verifySuggestionsFormat(result.suggestions);
                    options.onSearchComplete.call(this.element, q, result.suggestions);
                    this.processResponse(result, q, cacheKey!);
                })
                .fail((jqXHR, textStatus, errorThrown) => {
                    options.onSearchError.call(this.element, q, jqXHR, textStatus, errorThrown);
                });
        } else {
            options.onSearchComplete.call(this.element, q, []);
        }
    }

    isBadQuery(q: string): boolean {
        if (!this.options.preventBadQueries) {
            return false;
        }
        return this.badQueries.some((bad) => q.indexOf(bad) === 0);
    }

    hide(): void {
        if (this.options.onHide && this.visible) {
            this.options.onHide.call(this.element, this.$container);
        }

        this.visible = false;
        this.selectedIndex = -1;
        if (this.onChangeTimeout) {
            clearTimeout(this.onChangeTimeout);
        }
        this.$container.hide();
        this.onHint(null);
    }

    groupSuggestionsByCategory(suggestions: Suggestion[], key: string): Suggestion[] {
        const groups = new Map<unknown, Suggestion[]>();
        for (const s of suggestions) {
            const cat = (s.data as Record<string, unknown>)[key];
            const arr = groups.get(cat);
            if (arr) {
                arr.push(s);
            } else {
                groups.set(cat, [s]);
            }
        }
        return Array.from(groups.values()).flat();
    }

    suggest(): void {
        if (!this.suggestions.length) {
            if (this.options.showNoSuggestionNotice) {
                this.noSuggestions();
            } else {
                this.hide();
            }
            return;
        }

        const options = this.options;
        const { groupBy, formatResult: formatResultFn, beforeRender } = options;
        const value = this.getQuery(this.currentValue);
        const className = this.classes.suggestion;
        const classSelected = this.classes.selected;
        const container = this.$container;

        if (options.triggerSelectOnValidInput && this.isExactMatch(value)) {
            this.select(0);
            return;
        }

        // Reorder so all items in a category render under a single header.
        // Without this, interleaved categories produce a repeated header per
        // category boundary in the array.
        if (groupBy) {
            this.suggestions = this.groupSuggestionsByCategory(this.suggestions, groupBy);
        }

        let category: string | undefined;
        const formatGroupFn = (suggestion: Suggestion): string => {
            const currentCategory = (suggestion.data as Record<string, string>)[groupBy!]!;
            if (category === currentCategory) {
                return "";
            }
            category = currentCategory;
            return options.formatGroup(suggestion, category);
        };

        const html = this.suggestions
            .map((suggestion, i) => {
                const group = groupBy ? formatGroupFn(suggestion) : "";
                return `${group}<div class="${className}" data-index="${i}">${formatResultFn(suggestion, value, i)}</div>`;
            })
            .join("");

        this.adjustContainerWidth();

        this.$noSuggestionsContainer.detach();
        container.html(html);

        beforeRender?.call(this.element, container, this.suggestions);

        this.fixPosition();
        container.show();

        if (options.autoSelectFirst) {
            this.selectedIndex = 0;
            container.scrollTop(0);
            container.children(`.${className}`).first().addClass(classSelected);
        }

        this.visible = true;
        this.findBestHint();
    }

    noSuggestions(): void {
        const { beforeRender } = this.options;
        const container = this.$container;

        this.adjustContainerWidth();
        this.$noSuggestionsContainer.detach();
        container.empty().append(this.$noSuggestionsContainer);

        beforeRender?.call(this.element, container, this.suggestions);

        this.fixPosition();
        container.show();
        this.visible = true;
    }

    adjustContainerWidth(): void {
        const { width } = this.options;
        if (width === "auto") {
            const w = this.el.outerWidth() ?? 0;
            this.$container.css("width", w > 0 ? w : 300);
        } else if (width === "flex") {
            this.$container.css("width", "");
        }
    }

    findBestHint(): void {
        const value = (this.el.val() as string).toLowerCase();
        if (!value) {
            return;
        }

        // Original $.each callback stopped at the first prefix match by
        // returning false — Array.prototype.find has the same first-match-wins
        // semantics.
        const bestMatch =
            this.suggestions.find((s) => s.value.toLowerCase().indexOf(value) === 0) ?? null;

        this.onHint(bestMatch);
    }

    onHint(suggestion: Suggestion | null): void {
        const { onHint: onHintCallback } = this.options;
        const hintValue = suggestion
            ? this.currentValue + suggestion.value.substr(this.currentValue.length)
            : "";

        if (this.hintValue !== hintValue) {
            this.hintValue = hintValue;
            this.hint = suggestion;
            onHintCallback?.call(this.element, hintValue);
        }
    }

    verifySuggestionsFormat(suggestions: LookupArray): Suggestion[] {
        if (suggestions.length && typeof suggestions[0] === "string") {
            return (suggestions as string[]).map((value) => ({ value, data: null }));
        }
        // Coerce non-string `value` so downstream string methods (toLowerCase,
        // replace, substr, indexOf) don't throw on numeric or other types.
        return (suggestions as Suggestion[]).map((s) =>
            typeof s.value === "string" ? s : { ...s, value: String(s.value) }
        );
    }

    validateOrientation(orientation: string | undefined, fallback: Orientation): Orientation {
        const normalized = (orientation || "").trim().toLowerCase();
        if (normalized === "auto" || normalized === "top" || normalized === "bottom") {
            return normalized;
        }
        return fallback;
    }

    processResponse(result: AutocompleteResponse, originalQuery: string, cacheKey: string): void {
        const options = this.options;
        result.suggestions = this.verifySuggestionsFormat(result.suggestions);

        if (!options.noCache) {
            this.cachedResponse[cacheKey] = result;
            // Guard against pushing an empty `originalQuery`. `isBadQuery`
            // matches by prefix (`q.indexOf(bad) === 0`); an empty entry
            // would match every subsequent query and silently block all
            // ajax requests after the first empty-query response.
            if (options.preventBadQueries && !result.suggestions.length && originalQuery) {
                this.badQueries.push(originalQuery);
            }
        }

        if (originalQuery !== this.getQuery(this.currentValue)) {
            return;
        }

        this.suggestions = result.suggestions;
        this.suggest();
    }

    activate(index: number): HTMLElement | null {
        const selected = this.classes.selected;
        const container = this.$container;
        const children = container.find(`.${this.classes.suggestion}`);

        container.find(`.${selected}`).removeClass(selected);
        this.selectedIndex = index;

        if (this.selectedIndex !== -1 && children.length > this.selectedIndex) {
            const activeItem = children.get(this.selectedIndex) as HTMLElement;
            $(activeItem).addClass(selected);
            return activeItem;
        }

        return null;
    }

    selectHint(): void {
        this.select(this.suggestions.indexOf(this.hint!));
    }

    select(i: number): void {
        this.hide();
        this.onSelect(i);
    }

    moveUp(): void {
        if (this.selectedIndex === -1) {
            return;
        }

        if (this.selectedIndex === 0) {
            this.$container
                .children(`.${this.classes.suggestion}`)
                .first()
                .removeClass(this.classes.selected);
            this.selectedIndex = -1;
            this.ignoreValueChange = false;
            this.el.val(this.currentValue);
            this.findBestHint();
            return;
        }

        this.adjustScroll(this.selectedIndex - 1);
    }

    moveDown(): void {
        if (this.selectedIndex === this.suggestions.length - 1) {
            return;
        }
        this.adjustScroll(this.selectedIndex + 1);
    }

    adjustScroll(index: number): void {
        const activeItem = this.activate(index);
        if (!activeItem) {
            return;
        }

        const heightDelta = $(activeItem).outerHeight() ?? 0;
        const offsetTop = activeItem.offsetTop;
        const container = this.$container;
        const upperBound = container.scrollTop() ?? 0;
        const lowerBound = upperBound + this.options.maxHeight - heightDelta;

        if (offsetTop < upperBound) {
            container.scrollTop(offsetTop);
        } else if (offsetTop > lowerBound) {
            container.scrollTop(offsetTop - this.options.maxHeight + heightDelta);
        }

        if (!this.options.preserveInput) {
            this.ignoreValueChange = true;
            this.el.val(this.getValue(this.suggestions[index]!.value));
        }

        this.onHint(null);
    }

    onSelect(index: number): void {
        const onSelectCallback = this.options.onSelect;
        const suggestion = this.suggestions[index]!;

        this.currentValue = this.getValue(suggestion.value);

        if (this.currentValue !== this.el.val() && !this.options.preserveInput) {
            this.el.val(this.currentValue);
        }

        this.onHint(null);
        this.suggestions = [];
        this.selection = suggestion;

        onSelectCallback?.call(this.element, suggestion);
    }

    getValue(value: string): string {
        const { delimiter } = this.options;
        if (!delimiter) {
            return value;
        }

        const currentValue = this.currentValue;
        const parts = currentValue.split(delimiter);

        if (parts.length === 1) {
            return value;
        }

        return (
            currentValue.substr(0, currentValue.length - parts[parts.length - 1]!.length) + value
        );
    }

    dispose(): void {
        this.el.off(".autocomplete").removeData("autocomplete");
        if (this.fixPositionCapture) {
            $(window).off("resize.autocomplete", this.fixPositionCapture);
        }
        this.$container.remove();
    }
}
