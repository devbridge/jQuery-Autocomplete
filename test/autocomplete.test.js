import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { formatGroup, formatResult } from "../src/format.ts";

const $ = globalThis.jQuery;

// Clear mockjax handlers and any leftover suggestion containers between tests
// so describe blocks don't leak state into each other.
afterEach(() => {
    $.mockjax.clear();
    $(".autocomplete-suggestions").remove();
});

describe("Autocomplete Async — onSearchStart", () => {
    const input = document.createElement("input");
    let startQuery;
    let ajaxExecuted = false;
    const autocomplete = new $.Autocomplete(input, {
        serviceUrl: "/test",
        onSearchStart: function (params) {
            startQuery = params.query;
        },
    });

    beforeEach(async () => {
        await new Promise((resolve) => {
            $.mockjax({
                url: "/test",
                responseTime: 50,
                response: function (settings) {
                    ajaxExecuted = true;
                    const query = settings.data.query;
                    this.responseText = JSON.stringify({ query, suggestions: [] });
                    resolve();
                },
            });

            input.value = "A";
            autocomplete.onValueChange();
        });
    });

    it("Should execute onSearchStart", () => {
        expect(ajaxExecuted).toBe(true);
        expect(startQuery).toBe("A");
    });
});

describe("Autocomplete Async — onSearchComplete", () => {
    const input = document.createElement("input");
    const mockupSuggestion = { value: "A", data: "A" };
    let completeQuery;
    let resultSuggestions;
    let ajaxExecuted = false;
    const url = "/test-completed";

    beforeEach(async () => {
        await new Promise((resolve) => {
            const autocomplete = new $.Autocomplete(input, {
                serviceUrl: url,
                onSearchComplete: function (query, suggestions) {
                    completeQuery = query;
                    resultSuggestions = suggestions;
                    resolve();
                },
            });

            $.mockjax({
                url,
                responseTime: 50,
                response: function (settings) {
                    ajaxExecuted = true;
                    const query = settings.data.query;
                    this.responseText = JSON.stringify({
                        query,
                        suggestions: [mockupSuggestion],
                    });
                },
            });

            input.value = "A";
            autocomplete.onValueChange();
        });
    });

    it("Should execute onSearchComplete", () => {
        expect(ajaxExecuted).toBe(true);
        expect(completeQuery).toBe("A");
        expect(resultSuggestions[0].value).toBe("A");
        expect(resultSuggestions[0].data).toBe("A");
    });
});

describe("Autocomplete Async — onSearchError", () => {
    let errorMessage = false;

    beforeEach(async () => {
        await new Promise((resolve) => {
            const input = document.createElement("input");
            const url = "/test-error";
            const autocomplete = new $.Autocomplete(input, {
                serviceUrl: url,
                onSearchError: function (q, jqXHR /*, textStatus, errorThrown */) {
                    errorMessage = jqXHR.responseText;
                    resolve();
                },
            });

            $.mockjax({
                url,
                responseTime: 50,
                status: 500,
                response: function () {
                    this.responseText = "An error occurred";
                },
            });

            input.value = "A";
            autocomplete.onValueChange();
        });
    });

    it("Should execute onSearchError", () => {
        expect(errorMessage).toBe("An error occurred");
    });
});

describe("Autocomplete Async — transformResult", () => {
    let instance;

    beforeEach(async () => {
        await new Promise((resolve) => {
            const input = document.createElement("input");
            const url = "/test-transform";
            const autocomplete = new $.Autocomplete(input, {
                serviceUrl: url,
                transformResult: function (result, query) {
                    // call resolve after we return;
                    setTimeout(resolve, 0);

                    return {
                        query,
                        suggestions: $.map(result.split(","), function (item) {
                            return { value: item, data: null };
                        }),
                    };
                },
            });

            $.mockjax({
                url,
                responseTime: 50,
                response: function () {
                    this.responseText = "Andora,Angola,Argentina";
                },
            });

            instance = autocomplete;

            input.value = "A";
            autocomplete.onValueChange();
        });
    });

    it("Should transform results", () => {
        expect(instance.suggestions.length).toBe(3);
        expect(instance.suggestions[0].value).toBe("Andora");
    });
});

describe("Autocomplete Async — optional server query field", () => {
    let instance;

    beforeEach(async () => {
        await new Promise((resolve) => {
            const input = document.createElement("input");
            const url = "/test-original-query";
            const autocomplete = new $.Autocomplete(input, { serviceUrl: url });

            $.mockjax({
                url,
                responseTime: 50,
                response: function () {
                    const response = {
                        query: null,
                        suggestions: ["Aa", "Bb", "Cc"],
                    };
                    this.responseText = JSON.stringify(response);
                    setTimeout(resolve, 0);
                },
            });

            input.value = "A";
            instance = autocomplete;
            autocomplete.onValueChange();
        });
    });

    it("Should not require original query value from the server", () => {
        expect(instance.suggestions.length).toBe(3);
        expect(instance.suggestions[0].value).toBe("Aa");
    });
});

describe("Autocomplete Async — custom paramName", () => {
    let paramValue;

    beforeEach(async () => {
        await new Promise((resolve) => {
            const input = document.createElement("input");
            const paramName = "custom";
            const autocomplete = new $.Autocomplete(input, {
                serviceUrl: "/test-query",
                paramName,
            });

            $.mockjax({
                url: "/test-query",
                responseTime: 5,
                response: function (settings) {
                    paramValue = settings.data[paramName];
                    this.responseText = JSON.stringify({
                        query: paramValue,
                        suggestions: [],
                    });
                    resolve();
                },
            });

            input.value = "Jam";
            autocomplete.onValueChange();
        });
    });

    it("Should use custom query parameter name", () => {
        expect(paramValue).toBe("Jam");
    });
});

describe("Autocomplete Async — serviceUrl as callback", () => {
    let dynamicUrl;
    let data;

    beforeEach(async () => {
        await new Promise((resolve) => {
            const input = $(document.createElement("input"));

            input.autocomplete({
                ignoreParams: true,
                serviceUrl: function (query) {
                    return "/dynamic-url/" + encodeURIComponent(query).replace(/%20/g, "+");
                },
            });

            $.mockjax({
                url: "/dynamic-url/*",
                responseTime: 5,
                response: function (settings) {
                    dynamicUrl = settings.url;
                    data = settings.data;
                    this.responseText = JSON.stringify({ suggestions: [] });
                    resolve();
                },
            });

            input.val("Hello World");
            input.autocomplete().onValueChange();
        });
    });

    it("Should construct serviceUrl via callback function.", () => {
        expect(dynamicUrl).toBe("/dynamic-url/Hello+World");
        expect(data).toBeFalsy();
    });
});

describe("Autocomplete Async — cache key", () => {
    let instance;
    let cacheKey;

    beforeEach(async () => {
        await new Promise((resolve) => {
            const input = $("<input />");
            const data = { a: 1, query: "Jam" };
            const serviceUrl = "/autocomplete/cached/url";

            cacheKey = serviceUrl + "?" + $.param(data);

            input.autocomplete({
                serviceUrl,
                params: data,
            });

            $.mockjax({
                url: serviceUrl,
                responseTime: 5,
                response: function () {
                    this.responseText = JSON.stringify({
                        suggestions: [{ value: "Jamaica" }, { value: "Jamaica" }],
                    });
                    setTimeout(resolve, 10);
                },
            });

            input.val("Jam");
            instance = input.autocomplete();
            instance.onValueChange();
        });
    });

    it("Should use serviceUrl and params as cacheKey", () => {
        expect(instance.cachedResponse[cacheKey]).toBeTruthy();
    });
});

describe("Autocomplete Async — preventBadQueries", () => {
    let ajaxCount = 0;

    beforeEach(async () => {
        await new Promise((resolve) => {
            const input = $("<input />");
            let instance;
            const serviceUrl = "/autocomplete/prevent/ajax";

            input.autocomplete({ serviceUrl });

            $.mockjax({
                url: serviceUrl,
                responseTime: 1,
                response: function () {
                    ajaxCount += 1;
                    this.responseText = JSON.stringify({ suggestions: [] });
                    if (ajaxCount === 2) {
                        resolve();
                    }
                },
            });

            setTimeout(() => {
                input.val("Jam");
                instance = input.autocomplete();
                instance.onValueChange();
            }, 10);

            setTimeout(() => {
                input.val("Jama");
                instance.onValueChange();
            }, 20);

            setTimeout(() => {
                instance.setOptions({ preventBadQueries: false });
                input.val("Jamai");
                instance.onValueChange();
            }, 30);
        });
    });

    it("Should prevent Ajax requests if previous query with matching root failed.", () => {
        // Ajax call should have been made twice (then short-circuited by the
        // bad-query guard until preventBadQueries was disabled).
        expect(ajaxCount).toBe(2);
    });
});

describe("Autocomplete", () => {
    afterEach(() => {
        $(".autocomplete-suggestions").hide();
    });

    it("Should initialize autocomplete options", () => {
        const input = document.createElement("input");
        const options = { serviceUrl: "/autocomplete/service/url" };
        const autocomplete = new $.Autocomplete(input, options);

        expect(autocomplete.options.serviceUrl).toEqual(options.serviceUrl);
        expect(autocomplete.suggestionsContainer).not.toBeNull();
    });

    it('Should set autocomplete attribute to "off"', () => {
        const input = document.createElement("input");
        const autocomplete = new $.Autocomplete(input, {});

        expect(autocomplete).not.toBeNull();
        expect(input.getAttribute("autocomplete")).toEqual("off");
    });

    it("Should get current value", () => {
        const input = document.createElement("input");
        const autocomplete = new $.Autocomplete(input, {
            lookup: [{ value: "Jamaica", data: "B" }],
        });

        input.value = "Jam";
        autocomplete.onValueChange();

        expect(autocomplete.visible).toBe(true);
        expect(autocomplete.currentValue).toEqual("Jam");
    });

    it("Should call formatResult three times", () => {
        const input = document.createElement("input");
        let counter = 0;
        let suggestion;
        let currentValue;
        const autocomplete = new $.Autocomplete(input, {
            lookup: ["Jamaica", "Jamaica", "Jamaica"],
            formatResult: function (s, v) {
                suggestion = s;
                currentValue = v;
                counter += 1;
            },
        });

        input.value = "Jam";
        autocomplete.onValueChange();

        expect(suggestion.value).toBe("Jamaica");
        expect(suggestion.data).toBe(null);
        expect(currentValue).toEqual("Jam");
        expect(counter).toEqual(3);
    });

    it("Verify onSelect callback", () => {
        const input = document.createElement("input");
        let context;
        let value;
        let data;
        const autocomplete = $(input)
            .autocomplete({
                lookup: [{ value: "A", data: "B" }],
                triggerSelectOnValidInput: false,
                onSelect: function (suggestion) {
                    context = this;
                    value = suggestion.value;
                    data = suggestion.data;
                },
            })
            .autocomplete();

        input.value = "A";
        autocomplete.onValueChange();
        autocomplete.select(0);

        expect(context).toEqual(input);
        expect(value).toEqual("A");
        expect(data).toEqual("B");
    });

    it("Should convert suggestions format", () => {
        const input = document.createElement("input");
        const autocomplete = new $.Autocomplete(input, {
            lookup: ["A", "B"],
        });

        expect(autocomplete.options.lookup[0].value).toBe("A");
        expect(autocomplete.options.lookup[1].value).toBe("B");
    });

    it("Should not preventDefault when tabDisabled is set to false", () => {
        const input = document.createElement("input");
        const autocomplete = new $.Autocomplete(input, {
            lookup: [{ value: "Jamaica", data: "B" }],
            tabDisabled: false,
            autoSelectFirst: true,
        });
        input.value = "Jam";
        autocomplete.onValueChange();

        const event = $.Event("keydown");
        event.which = 9; // the tab keycode
        vi.spyOn(event, "stopImmediatePropagation");
        vi.spyOn(event, "preventDefault");
        vi.spyOn(autocomplete, "suggest");

        expect(autocomplete.visible).toBe(true);
        expect(autocomplete.disabled).toBe(undefined);
        expect(autocomplete.selectedIndex).not.toBe(-1);

        $(input).trigger(event);

        expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(autocomplete.suggest).not.toHaveBeenCalled();
    });

    it("Should preventDefault when tabDisabled is set to true", () => {
        const input = document.createElement("input");
        const autocomplete = new $.Autocomplete(input, {
            lookup: [{ value: "Jamaica", data: "B" }],
            tabDisabled: true,
            autoSelectFirst: true,
        });
        input.value = "Jam";
        autocomplete.onValueChange();

        const event = $.Event("keydown");
        event.which = 9; // the tab keycode
        vi.spyOn(autocomplete, "suggest");

        expect(autocomplete.visible).toBe(true);
        expect(autocomplete.disabled).toBe(undefined);
        expect(autocomplete.selectedIndex).not.toBe(-1);

        $(input).trigger(event);

        expect(autocomplete.suggest).not.toHaveBeenCalled();
    });

    it("Should not autoselect first item by default", () => {
        const input = document.createElement("input");
        const autocomplete = new $.Autocomplete(input, {
            lookup: ["Jamaica", "Jamaica", "Jamaica"],
        });

        input.value = "Jam";
        autocomplete.onValueChange();

        expect(autocomplete.selectedIndex).toBe(-1);
    });

    it("Should autoselect first item when autoSelectFirst is true", () => {
        const input = document.createElement("input");
        const autocomplete = new $.Autocomplete(input, {
            lookup: ["Jamaica", "Jamaica", "Jamaica"],
            autoSelectFirst: true,
        });

        input.value = "Jam";
        autocomplete.onValueChange();

        expect(autocomplete.selectedIndex).toBe(0);
    });

    it("Should destroy autocomplete instance", () => {
        const input = $(document.createElement("input"));
        const div = $(document.createElement("div"));

        input.autocomplete({
            serviceUrl: "/test-dispose",
            appendTo: div,
        });

        expect(input.data("autocomplete")).toBeDefined();
        expect(div.children().length).toBeGreaterThan(0);

        input.autocomplete("dispose");

        expect(input.data("autocomplete")).toBeUndefined();
        expect(div.children().length).toBe(0);
    });

    it("Should return Autocomplete instance if called without arguments", () => {
        const input = $(document.createElement("input"));

        input.autocomplete({ serviceUrl: "/test-dispose" });

        const instance = input.autocomplete();

        expect(instance instanceof $.Autocomplete).toBe(true);
    });

    it("Should set width to be greater than zero", () => {
        const input = $(document.createElement("input"));

        input.autocomplete({
            lookup: [{ value: "Jamaica", data: "B" }],
        });

        input.val("Jam");
        input.width(100);

        const instance = input.autocomplete();
        instance.onValueChange();

        const width = $(instance.suggestionsContainer).width();

        expect(width).toBeGreaterThan(0);
    });

    it("Should call beforeRender and pass container jQuery object", () => {
        const element = document.createElement("input");
        const input = $(element);
        let elementCount;
        let context;

        input.autocomplete({
            lookup: [{ value: "Jamaica", data: "B" }],
            beforeRender: function (container) {
                context = this;
                elementCount = container.length;
            },
        });

        input.val("Jam");
        const instance = input.autocomplete();
        instance.onValueChange();

        expect(context).toBe(element);
        expect(elementCount).toBe(1);
    });

    it("Should trigger select when input value matches suggestion", () => {
        const input = $("<input />");
        let suggestionData = false;

        input.autocomplete({
            lookup: [{ value: "Jamaica", data: "J" }],
            triggerSelectOnValidInput: true,
            onSelect: function (suggestion) {
                suggestionData = suggestion.data;
            },
        });

        input.val("Jamaica");
        const instance = input.autocomplete();
        instance.onValueChange();

        expect(suggestionData).toBe("J");
    });

    it("Should NOT trigger select when input value matches suggestion", () => {
        const input = $("<input />");
        let suggestionData = null;

        input.autocomplete({
            lookup: [{ value: "Jamaica", data: "J" }],
            triggerSelectOnValidInput: false,
            onSelect: function (suggestion) {
                suggestionData = suggestion.data;
            },
        });

        input.val("Jamaica");
        const instance = input.autocomplete();
        instance.onValueChange();

        expect(suggestionData).toBeNull();
    });

    it("Should limit results for local request", () => {
        const input = $("<input />");
        const limit = 3;

        input.autocomplete({
            lookup: [
                { value: "Jamaica" },
                { value: "Jamaica" },
                { value: "Jamaica" },
                { value: "Jamaica" },
                { value: "Jamaica" },
            ],
        });

        input.val("Jam");
        const instance = input.autocomplete();
        instance.onValueChange();

        expect(instance.suggestions.length).toBe(5);

        instance.setOptions({ lookupLimit: limit });
        instance.onValueChange();

        expect(instance.suggestions.length).toBe(limit);
    });

    it("Should display no suggestion notice when no matching results", () => {
        const input = document.createElement("input");
        const options = {
            lookup: [{ value: "Colombia", data: "Spain" }],
            showNoSuggestionNotice: true,
            noSuggestionNotice: "Sorry, no matching results",
        };
        const autocomplete = new $.Autocomplete(input, options);
        const suggestionsContainer = $(autocomplete.suggestionsContainer);

        input.value = "Jamaica";
        autocomplete.onValueChange();

        expect(autocomplete.visible).toBe(true);
        expect(autocomplete.selectedIndex).toBe(-1);
        expect(suggestionsContainer.find(".autocomplete-no-suggestion").length).toBe(1);
        expect(suggestionsContainer.find(".autocomplete-no-suggestion").text()).toBe(
            "Sorry, no matching results"
        );
    });

    it("Should call onHide and pass container jQuery object", () => {
        const element = document.createElement("input");
        const input = $(element);
        let elementCount;
        let context;

        input.autocomplete({
            lookup: [{ value: "Jamaica", data: "B" }],
            onHide: function (container) {
                context = this;
                elementCount = container.length;
            },
        });

        input.val("Jam");
        const instance = input.autocomplete();
        instance.onValueChange();

        input.val("Colombia");
        instance.onValueChange();

        expect(context).toBe(element);
        expect(elementCount).toBe(1);
    });
});

describe("Autocomplete non-string suggestion values", () => {
    afterEach(() => {
        $(".autocomplete-suggestions").remove();
    });

    it("coerces numeric value from a local lookup so render does not throw", () => {
        const input = document.createElement("input");
        const autocomplete = new $.Autocomplete(input, {
            lookup: [{ value: 12345, data: "n" }],
            triggerSelectOnValidInput: false,
        });

        input.value = "1";
        expect(() => autocomplete.onValueChange()).not.toThrow();

        expect(typeof autocomplete.suggestions[0].value).toBe("string");
        expect(autocomplete.suggestions[0].value).toBe("12345");
    });

    it("coerces numeric value from a function lookup callback", () => {
        const input = document.createElement("input");
        let completedValueType;
        let selectedValueType;
        const autocomplete = new $.Autocomplete(input, {
            lookup: (_q, done) => done({ suggestions: [{ value: 42, data: "n" }] }),
            onSearchComplete: (_q, suggestions) => {
                completedValueType = typeof suggestions[0].value;
            },
            onSelect: (suggestion) => {
                selectedValueType = typeof suggestion.value;
            },
        });

        input.value = "42";
        autocomplete.onValueChange();

        expect(completedValueType).toBe("string");
        expect(selectedValueType).toBe("string");
    });
});

describe("Autocomplete event ordering", () => {
    afterEach(() => {
        $(".autocomplete-suggestions").remove();
    });

    it("fires onSearchComplete before onSelect when a single match auto-selects", () => {
        const input = document.createElement("input");
        const calls = [];
        const autocomplete = new $.Autocomplete(input, {
            lookup: [{ value: "Apple", data: 1 }],
            onSearchComplete: () => calls.push("searchComplete"),
            onSelect: () => calls.push("select"),
        });

        input.value = "Apple";
        autocomplete.onValueChange();

        expect(calls).toEqual(["searchComplete", "select"]);
    });
});

describe("Autocomplete groupBy", () => {
    afterEach(() => {
        $(".autocomplete-suggestions").remove();
    });

    it("regroups interleaved categories under a single header each", () => {
        const input = document.createElement("input");
        const lookup = [
            { value: "Anaheim Ducks", data: { category: "NHL" } },
            { value: "Portland Trail Blazers", data: { category: "NBA" } },
            { value: "Chicago Blackhawks", data: { category: "NHL" } },
            { value: "Boston BlCeltics", data: { category: "NBA" } },
            { value: "Columbus Blue Jackets", data: { category: "NHL" } },
        ];
        const autocomplete = new $.Autocomplete(input, {
            lookup,
            groupBy: "category",
            triggerSelectOnValidInput: false,
        });

        input.value = "bl";
        autocomplete.onValueChange();

        // 4 of 5 entries match "bl"; reordered so NBA (first-seen group with
        // a match) renders first, then NHL.
        expect(autocomplete.suggestions.map((s) => s.data.category)).toEqual([
            "NBA",
            "NBA",
            "NHL",
            "NHL",
        ]);

        // One group header per distinct category, not per category boundary.
        const headers = $(".autocomplete-group");
        expect(headers.length).toBe(2);
        expect(headers.eq(0).text()).toBe("NBA");
        expect(headers.eq(1).text()).toBe("NHL");
    });

    it("preserves relative order within each category", () => {
        const input = document.createElement("input");
        const lookup = [
            { value: "Boston Bruins", data: { category: "NHL" } },
            { value: "Boston Celtics", data: { category: "NBA" } },
            { value: "Brooklyn Nets", data: { category: "NBA" } },
            { value: "Buffalo Sabres", data: { category: "NHL" } },
        ];
        const autocomplete = new $.Autocomplete(input, {
            lookup,
            groupBy: "category",
            triggerSelectOnValidInput: false,
        });

        input.value = "B";
        autocomplete.onValueChange();

        // NHL came first in lookup, so renders first; within each group,
        // original relative order is preserved.
        expect(autocomplete.suggestions.map((s) => s.value)).toEqual([
            "Boston Bruins",
            "Buffalo Sabres",
            "Boston Celtics",
            "Brooklyn Nets",
        ]);
    });
});

describe("XSS in default formatters (GHSA-hvqh-jw65-wcpq)", () => {
    const PAYLOAD = "<img src=x onerror=\"alert('XSS')\">";

    afterEach(() => {
        $(".autocomplete-suggestions").remove();
    });

    it("formatGroup escapes the category", () => {
        const html = formatGroup({ value: "x", data: null }, PAYLOAD);
        expect(html).not.toContain("<img");
        expect(html).toContain("&lt;img");
    });

    it("formatResult escapes the value when currentValue is empty", () => {
        const html = formatResult({ value: PAYLOAD, data: null }, "");
        expect(html).not.toContain("<img");
        expect(html).toContain("&lt;img");
    });

    it("does not inject DOM nodes when groupBy category is poisoned", () => {
        const input = document.createElement("input");
        document.body.appendChild(input);
        const ac = new $.Autocomplete(input, {
            lookup: [
                { value: "Apple", data: { category: PAYLOAD } },
                { value: "Avocado", data: { category: "Safe" } },
            ],
            groupBy: "category",
            minChars: 1,
            triggerSelectOnValidInput: false,
        });

        input.value = "A";
        ac.onValueChange();

        // Poisoned category renders as text inside the group header — no img
        // element is created.
        const container = ac.suggestionsContainer;
        expect(container.querySelectorAll("img").length).toBe(0);
        expect(container.querySelector(".autocomplete-group").textContent).toBe(PAYLOAD);

        document.body.removeChild(input);
    });
});

describe("When options.preserveInput is true", () => {
    const input = $("<input />");
    let instance;
    let suggestionData = null;

    beforeEach(() => {
        input.autocomplete({
            lookup: [
                { value: "Jamaica", data: "J" },
                { value: "Jamaica2", data: "J" },
                { value: "Jamaica3", data: "J" },
            ],
            preserveInput: true,
            onSelect: function (suggestion) {
                suggestionData = suggestion.data;
            },
        });

        input.val("J");
        instance = input.autocomplete();
    });

    afterEach(() => {
        instance.dispose();
    });

    it("Should NOT change input value when item is selected", () => {
        instance.onValueChange();
        instance.select(0);

        expect(input.val()).toEqual("J");
        expect(suggestionData).toBe("J");
    });

    it("Should NOT change input value when move down", () => {
        instance.onValueChange();
        instance.moveDown();

        expect(input.val()).toEqual("J");
    });

    it("Should NOT change input value when move up", () => {
        instance.onValueChange();
        instance.moveUp();

        expect(input.val()).toEqual("J");
    });
});
