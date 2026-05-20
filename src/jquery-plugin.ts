import { Autocomplete } from "./Autocomplete";
import { setJQuery } from "./jquery-ref";
import type { AutocompleteOptions } from "./types";

declare global {
    interface JQueryStatic {
        Autocomplete: typeof Autocomplete;
    }
    interface JQuery {
        autocomplete(options?: AutocompleteOptions | string, args?: unknown): JQuery | Autocomplete;
        devbridgeAutocomplete(
            options?: AutocompleteOptions | string,
            args?: unknown
        ): JQuery | Autocomplete;
    }
}

const dataKey = "autocomplete";

export function installAutocomplete($: JQueryStatic): void {
    setJQuery($);

    $.Autocomplete = Autocomplete;

    // Chainable jQuery plugin entry. Mirrors the behavior of the JS source:
    // - no args -> returns the Autocomplete instance on the first matched el
    // - string  -> dispatches that method on each matched instance
    // - options -> (re)constructs an Autocomplete instance per matched element
    $.fn.devbridgeAutocomplete = function (
        this: JQuery,
        options?: AutocompleteOptions | string,
        args?: unknown
    ): JQuery | Autocomplete {
        if (!arguments.length) {
            return this.first().data(dataKey) as Autocomplete;
        }

        return this.each(function (this: HTMLElement) {
            const inputElement = $(this);
            let instance = inputElement.data(dataKey) as Autocomplete | undefined;

            if (typeof options === "string") {
                if (
                    instance &&
                    typeof (instance as unknown as Record<string, unknown>)[options] === "function"
                ) {
                    (instance as unknown as Record<string, (arg?: unknown) => void>)[options]!(
                        args
                    );
                }
            } else {
                if (instance && instance.dispose) {
                    instance.dispose();
                }
                instance = new Autocomplete(this as HTMLInputElement, options);
                inputElement.data(dataKey, instance);
            }
        });
    } as JQuery["devbridgeAutocomplete"];

    // jQuery UI defines $.fn.autocomplete; only alias if it's free.
    if (!$.fn.autocomplete) {
        $.fn.autocomplete = $.fn.devbridgeAutocomplete;
    }
}
