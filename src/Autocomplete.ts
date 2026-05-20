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
        this.options = $.extend(true, {}, Autocomplete.defaults, options) as ResolvedOptions;

        this.initialize();
        this.setOptions(options);
    }

    initialize(): void {
        const that = this;
        const suggestionSelector = "." + that.classes.suggestion;
        const selected = that.classes.selected;
        const options = that.options;

        that.element.setAttribute("autocomplete", "off");

        // html() deals with many types: htmlString or Element or Array or jQuery
        that.noSuggestionsContainer = $('<div class="autocomplete-no-suggestion"></div>')
            .html(options.noSuggestionNotice as string)
            .get(0) as HTMLElement;

        that.suggestionsContainer = Autocomplete.utils.createNode(options.containerClass);

        const container = $(that.suggestionsContainer);

        container.appendTo(options.appendTo || "body");

        if (options.width !== "auto") {
            container.css("width", options.width);
        }

        container.on("mouseover.autocomplete", suggestionSelector, function (this: HTMLElement) {
            that.activate($(this).data("index") as number);
        });

        container.on("mouseout.autocomplete", function () {
            that.selectedIndex = -1;
            container.children("." + selected).removeClass(selected);
        });

        container.on("click.autocomplete", suggestionSelector, function (this: HTMLElement) {
            that.select($(this).data("index") as number);
        });

        container.on("click.autocomplete", function () {
            if (that.blurTimeoutId !== undefined) {
                clearTimeout(that.blurTimeoutId);
            }
        });

        that.fixPositionCapture = function () {
            if (that.visible) {
                that.fixPosition();
            }
        };

        $(window).on("resize.autocomplete", that.fixPositionCapture);

        that.el.on("keydown.autocomplete", function (e) {
            that.onKeyPress(e);
        });
        that.el.on("keyup.autocomplete", function (e) {
            that.onKeyUp(e);
        });
        that.el.on("blur.autocomplete", function () {
            that.onBlur();
        });
        that.el.on("focus.autocomplete", function () {
            that.onFocus();
        });
        that.el.on("change.autocomplete", function (e) {
            that.onKeyUp(e);
        });
        that.el.on("input.autocomplete", function (e) {
            that.onKeyUp(e);
        });
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
        const that = this;
        const options = that.options;
        const value = that.el.val() as string;
        const query = that.getQuery(value);

        that.blurTimeoutId = setTimeout(function () {
            that.hide();

            if (that.selection && that.currentValue !== query) {
                options.onInvalidateSelection?.call(that.element);
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
        const that = this;
        const options = $.extend({}, that.options, suppliedOptions) as ResolvedOptions;

        that.isLocal = Array.isArray(options.lookup);

        if (that.isLocal) {
            options.lookup = that.verifySuggestionsFormat(options.lookup as LookupArray);
        }

        options.orientation = that.validateOrientation(options.orientation, "bottom");

        $(that.suggestionsContainer).css({
            "max-height": options.maxHeight + "px",
            width: options.width + "px",
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
        const that = this;
        const $container = $(that.suggestionsContainer);
        const containerParent = $container.parent().get(0);

        if (containerParent !== document.body && !that.options.forceFixPosition) {
            return;
        }

        let orientation = that.options.orientation;
        const containerHeight = $container.outerHeight() ?? 0;
        const height = that.el.outerHeight() ?? 0;
        const offset = that.el.offset() ?? { top: 0, left: 0 };
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

        if (orientation === "top") {
            styles.top += -containerHeight;
        } else {
            styles.top += height;
        }

        if (containerParent !== document.body && containerParent !== undefined) {
            const opacity = $container.css("opacity");

            if (!that.visible) {
                $container.css("opacity", 0).show();
            }

            const parentOffsetDiff = $container.offsetParent().offset() ?? { top: 0, left: 0 };
            styles.top -= parentOffsetDiff.top;
            styles.top += containerParent.scrollTop;
            styles.left -= parentOffsetDiff.left;

            if (!that.visible) {
                $container.css("opacity", opacity).hide();
            }
        }

        if (that.options.width === "auto") {
            styles.width = (that.el.outerWidth() ?? 0) + "px";
        }

        $container.css(styles);
    }

    isCursorAtEnd(): boolean {
        const valLength = (this.el.val() as string).length;
        const selectionStart = this.element.selectionStart;
        return typeof selectionStart === "number" ? selectionStart === valLength : true;
    }

    onKeyPress(e: JQuery.KeyDownEvent): void {
        const that = this;

        if (!that.disabled && !that.visible && e.which === keys.DOWN && that.currentValue) {
            that.suggest();
            return;
        }

        if (that.disabled || !that.visible) {
            return;
        }

        switch (e.which) {
            case keys.ESC:
                that.el.val(that.currentValue);
                that.hide();
                break;
            case keys.RIGHT:
                if (that.hint && that.options.onHint && that.isCursorAtEnd()) {
                    that.selectHint();
                    break;
                }
                return;
            case keys.TAB:
                if (that.hint && that.options.onHint) {
                    that.selectHint();
                    return;
                }
                if (that.selectedIndex === -1) {
                    that.hide();
                    return;
                }
                that.select(that.selectedIndex);
                if (that.options.tabDisabled === false) {
                    return;
                }
                break;
            case keys.RETURN:
                if (that.selectedIndex === -1) {
                    that.hide();
                    return;
                }
                that.select(that.selectedIndex);
                break;
            case keys.UP:
                that.moveUp();
                break;
            case keys.DOWN:
                that.moveDown();
                break;
            default:
                return;
        }

        e.stopImmediatePropagation();
        e.preventDefault();
    }

    onKeyUp(e: JQuery.TriggeredEvent): void {
        const that = this;

        if (that.disabled) {
            return;
        }

        switch (e.which) {
            case keys.UP:
            case keys.DOWN:
                return;
        }

        if (that.onChangeTimeout) {
            clearTimeout(that.onChangeTimeout);
        }

        if (that.currentValue !== that.el.val()) {
            that.findBestHint();
            if (that.options.deferRequestBy > 0) {
                that.onChangeTimeout = setTimeout(function () {
                    that.onValueChange();
                }, that.options.deferRequestBy);
            } else {
                that.onValueChange();
            }
        }
    }

    onValueChange(): void {
        if (this.ignoreValueChange) {
            this.ignoreValueChange = false;
            return;
        }

        const that = this;
        const options = that.options;
        const value = that.el.val() as string;
        const query = that.getQuery(value);

        if (that.selection && that.currentValue !== query) {
            that.selection = null;
            options.onInvalidateSelection?.call(that.element);
        }

        if (that.onChangeTimeout) {
            clearTimeout(that.onChangeTimeout);
        }
        that.currentValue = value;
        that.selectedIndex = -1;

        if (options.triggerSelectOnValidInput && that.isExactMatch(query)) {
            that.select(0);
            return;
        }

        if (query.length < options.minChars) {
            that.hide();
        } else {
            that.getSuggestions(query);
        }
    }

    isExactMatch(query: string): boolean {
        const suggestions = this.suggestions;
        return (
            suggestions.length === 1 && suggestions[0]!.value.toLowerCase() === query.toLowerCase()
        );
    }

    getQuery(value: string): string {
        const delimiter = this.options.delimiter;
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

        const data: AutocompleteResponse = {
            suggestions: $.grep(options.lookup as Suggestion[], function (suggestion) {
                return filter(suggestion, query, queryLowerCase);
            }),
        };

        if (limit && data.suggestions.length > limit) {
            data.suggestions = data.suggestions.slice(0, limit);
        }

        return data;
    }

    getSuggestions(q: string): void {
        const that = this;
        const options = that.options;
        let serviceUrl = options.serviceUrl as ServiceUrl;
        let response: AutocompleteResponse | undefined;
        let cacheKey: string | undefined;

        options.params[options.paramName] = q;

        if (options.onSearchStart.call(that.element, options.params) === false) {
            return;
        }

        const params = options.ignoreParams ? null : options.params;

        if (typeof options.lookup === "function") {
            (options.lookup as LookupCallback)(q, function (data) {
                that.suggestions = data.suggestions;
                that.suggest();
                options.onSearchComplete.call(that.element, q, data.suggestions);
            });
            return;
        }

        if (that.isLocal) {
            response = that.getSuggestionsLocal(q);
        } else {
            if (typeof serviceUrl === "function") {
                serviceUrl = serviceUrl.call(that.element, q);
            }
            cacheKey = serviceUrl + "?" + $.param(params ?? {});
            response = that.cachedResponse[cacheKey];
        }

        if (response && Array.isArray(response.suggestions)) {
            that.suggestions = response.suggestions;
            that.suggest();
            options.onSearchComplete.call(that.element, q, response.suggestions);
        } else if (!that.isBadQuery(q)) {
            that.abortAjax();

            const ajaxSettings: JQuery.AjaxSettings = {
                url: serviceUrl as string,
                data: params ?? undefined,
                type: options.type,
                dataType: options.dataType,
            };

            $.extend(ajaxSettings, options.ajaxSettings);

            that.currentRequest = $.ajax(ajaxSettings)
                .done(function (data) {
                    that.currentRequest = null;
                    const result = options.transformResult(data, q);
                    that.processResponse(result, q, cacheKey!);
                    options.onSearchComplete.call(that.element, q, result.suggestions);
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    options.onSearchError.call(that.element, q, jqXHR, textStatus, errorThrown);
                });
        } else {
            options.onSearchComplete.call(that.element, q, []);
        }
    }

    isBadQuery(q: string): boolean {
        if (!this.options.preventBadQueries) {
            return false;
        }

        const badQueries = this.badQueries;
        let i = badQueries.length;
        while (i--) {
            if (q.indexOf(badQueries[i]!) === 0) {
                return true;
            }
        }
        return false;
    }

    hide(): void {
        const that = this;
        const container = $(that.suggestionsContainer);

        if (that.options.onHide && that.visible) {
            that.options.onHide.call(that.element, container);
        }

        that.visible = false;
        that.selectedIndex = -1;
        if (that.onChangeTimeout) {
            clearTimeout(that.onChangeTimeout);
        }
        $(that.suggestionsContainer).hide();
        that.onHint(null);
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

        const that = this;
        const options = that.options;
        const groupBy = options.groupBy;
        const formatResultFn = options.formatResult;
        const value = that.getQuery(that.currentValue);
        const className = that.classes.suggestion;
        const classSelected = that.classes.selected;
        const container = $(that.suggestionsContainer);
        const noSuggestionsContainer = $(that.noSuggestionsContainer);
        const beforeRender = options.beforeRender;
        let html = "";
        let category: string | undefined;
        const formatGroupFn = (suggestion: Suggestion): string => {
            const currentCategory = (suggestion.data as Record<string, string>)[groupBy!]!;
            if (category === currentCategory) {
                return "";
            }
            category = currentCategory;
            return options.formatGroup(suggestion, category);
        };

        if (options.triggerSelectOnValidInput && that.isExactMatch(value)) {
            that.select(0);
            return;
        }

        $.each(that.suggestions, function (i, suggestion) {
            if (groupBy) {
                html += formatGroupFn(suggestion);
            }
            html +=
                '<div class="' +
                className +
                '" data-index="' +
                i +
                '">' +
                formatResultFn(suggestion, value, i) +
                "</div>";
        });

        this.adjustContainerWidth();

        noSuggestionsContainer.detach();
        container.html(html);

        beforeRender?.call(that.element, container, that.suggestions);

        that.fixPosition();
        container.show();

        if (options.autoSelectFirst) {
            that.selectedIndex = 0;
            container.scrollTop(0);
            container
                .children("." + className)
                .first()
                .addClass(classSelected);
        }

        that.visible = true;
        that.findBestHint();
    }

    noSuggestions(): void {
        const that = this;
        const beforeRender = that.options.beforeRender;
        const container = $(that.suggestionsContainer);
        const noSuggestionsContainer = $(that.noSuggestionsContainer);

        this.adjustContainerWidth();

        noSuggestionsContainer.detach();
        container.empty();
        container.append(noSuggestionsContainer);

        beforeRender?.call(that.element, container, that.suggestions);

        that.fixPosition();
        container.show();
        that.visible = true;
    }

    adjustContainerWidth(): void {
        const options = this.options;
        const container = $(this.suggestionsContainer);

        if (options.width === "auto") {
            const width = this.el.outerWidth() ?? 0;
            container.css("width", width > 0 ? width : 300);
        } else if (options.width === "flex") {
            container.css("width", "");
        }
    }

    findBestHint(): void {
        const that = this;
        const value = (that.el.val() as string).toLowerCase();
        let bestMatch: Suggestion | null = null;

        if (!value) {
            return;
        }

        $.each(that.suggestions, function (_i, suggestion) {
            const foundMatch = suggestion.value.toLowerCase().indexOf(value) === 0;
            if (foundMatch) {
                bestMatch = suggestion;
            }
            return !foundMatch;
        });

        that.onHint(bestMatch);
    }

    onHint(suggestion: Suggestion | null): void {
        const that = this;
        const onHintCallback = that.options.onHint;
        let hintValue = "";

        if (suggestion) {
            hintValue = that.currentValue + suggestion.value.substr(that.currentValue.length);
        }
        if (that.hintValue !== hintValue) {
            that.hintValue = hintValue;
            that.hint = suggestion;
            onHintCallback?.call(that.element, hintValue);
        }
    }

    verifySuggestionsFormat(suggestions: LookupArray): Suggestion[] {
        if (suggestions.length && typeof suggestions[0] === "string") {
            return $.map(suggestions as string[], function (value) {
                return { value: value, data: null };
            });
        }
        return suggestions as Suggestion[];
    }

    validateOrientation(orientation: string | undefined, fallback: Orientation): Orientation {
        const normalized = (orientation || "").trim().toLowerCase();
        if (normalized === "auto" || normalized === "top" || normalized === "bottom") {
            return normalized;
        }
        return fallback;
    }

    processResponse(result: AutocompleteResponse, originalQuery: string, cacheKey: string): void {
        const that = this;
        const options = that.options;

        result.suggestions = that.verifySuggestionsFormat(result.suggestions);

        if (!options.noCache) {
            that.cachedResponse[cacheKey] = result;
            if (options.preventBadQueries && !result.suggestions.length) {
                that.badQueries.push(originalQuery);
            }
        }

        if (originalQuery !== that.getQuery(that.currentValue)) {
            return;
        }

        that.suggestions = result.suggestions;
        that.suggest();
    }

    activate(index: number): HTMLElement | null {
        const that = this;
        const selected = that.classes.selected;
        const container = $(that.suggestionsContainer);
        const children = container.find("." + that.classes.suggestion);

        container.find("." + selected).removeClass(selected);

        that.selectedIndex = index;

        if (that.selectedIndex !== -1 && children.length > that.selectedIndex) {
            const activeItem = children.get(that.selectedIndex) as HTMLElement;
            $(activeItem).addClass(selected);
            return activeItem;
        }

        return null;
    }

    selectHint(): void {
        const i = $.inArray(this.hint, this.suggestions);
        this.select(i);
    }

    select(i: number): void {
        this.hide();
        this.onSelect(i);
    }

    moveUp(): void {
        const that = this;

        if (that.selectedIndex === -1) {
            return;
        }

        if (that.selectedIndex === 0) {
            $(that.suggestionsContainer)
                .children("." + that.classes.suggestion)
                .first()
                .removeClass(that.classes.selected);
            that.selectedIndex = -1;
            that.ignoreValueChange = false;
            that.el.val(that.currentValue);
            that.findBestHint();
            return;
        }

        that.adjustScroll(that.selectedIndex - 1);
    }

    moveDown(): void {
        if (this.selectedIndex === this.suggestions.length - 1) {
            return;
        }
        this.adjustScroll(this.selectedIndex + 1);
    }

    adjustScroll(index: number): void {
        const that = this;
        const activeItem = that.activate(index);

        if (!activeItem) {
            return;
        }

        const heightDelta = $(activeItem).outerHeight() ?? 0;
        const offsetTop = activeItem.offsetTop;
        const upperBound = $(that.suggestionsContainer).scrollTop() ?? 0;
        const lowerBound = upperBound + that.options.maxHeight - heightDelta;

        if (offsetTop < upperBound) {
            $(that.suggestionsContainer).scrollTop(offsetTop);
        } else if (offsetTop > lowerBound) {
            $(that.suggestionsContainer).scrollTop(
                offsetTop - that.options.maxHeight + heightDelta
            );
        }

        if (!that.options.preserveInput) {
            that.ignoreValueChange = true;
            that.el.val(that.getValue(that.suggestions[index]!.value));
        }

        that.onHint(null);
    }

    onSelect(index: number): void {
        const that = this;
        const onSelectCallback = that.options.onSelect;
        const suggestion = that.suggestions[index]!;

        that.currentValue = that.getValue(suggestion.value);

        if (that.currentValue !== that.el.val() && !that.options.preserveInput) {
            that.el.val(that.currentValue);
        }

        that.onHint(null);
        that.suggestions = [];
        that.selection = suggestion;

        onSelectCallback?.call(that.element, suggestion);
    }

    getValue(value: string): string {
        const delimiter = this.options.delimiter;
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
        $(this.suggestionsContainer).remove();
    }
}
