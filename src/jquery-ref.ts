// Module-level live binding for the jQuery instance the plugin was installed
// against. Other modules import { $ } and see the value once setJQuery has run.
// This avoids passing $ through every constructor / function signature while
// still letting the UMD wrapper supply jQuery at install time.

export let $: JQueryStatic = null as unknown as JQueryStatic;

export function setJQuery(jq: JQueryStatic): void {
    $ = jq;
}
