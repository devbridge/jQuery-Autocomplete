import jQuery from "jquery";
import { installAutocomplete } from "./jquery-plugin";

installAutocomplete(jQuery);

export { Autocomplete } from "./Autocomplete";
export type * from "./types";
