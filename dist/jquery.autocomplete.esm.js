/**
*  Ajax Autocomplete for jQuery, version 2.0.0
*  (c) 2025 Tomas Kirda
*
*  Ajax Autocomplete for jQuery is freely distributable under the terms of an MIT-style license.
*  For details, see the web site: https://github.com/devbridge/jQuery-Autocomplete
*/

// src/index.ts
import jQuery from "jquery";

// src/jquery-ref.ts
var $ = null;
function setJQuery(jq) {
  $ = jq;
}

// src/utils.ts
var utils = {
  escapeRegExChars(value) {
    return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
  },
  createNode(containerClass) {
    const div = document.createElement("div");
    div.className = containerClass;
    div.style.position = "absolute";
    div.style.display = "none";
    return div;
  }
};
var keys = {
  ESC: 27,
  TAB: 9,
  RETURN: 13,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40
};

// src/format.ts
function lookupFilter(suggestion, _originalQuery, queryLowerCase) {
  return suggestion.value.toLowerCase().indexOf(queryLowerCase) !== -1;
}
function transformResult(response) {
  return typeof response === "string" ? JSON.parse(response) : response;
}
function formatResult(suggestion, currentValue) {
  if (!currentValue) {
    return suggestion.value;
  }
  const pattern = "(" + utils.escapeRegExChars(currentValue) + ")";
  return suggestion.value.replace(new RegExp(pattern, "gi"), "<strong>$1</strong>").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/&lt;(\/?strong)&gt;/g, "<$1>");
}
function formatGroup(_suggestion, category) {
  return '<div class="autocomplete-group">' + category + "</div>";
}

// src/defaults.ts
var noop = () => {
};
var defaults = {
  ajaxSettings: {},
  autoSelectFirst: false,
  appendTo: "body",
  serviceUrl: null,
  lookup: null,
  onSelect: null,
  onHint: null,
  width: "auto",
  minChars: 1,
  maxHeight: 300,
  deferRequestBy: 0,
  params: {},
  formatResult,
  formatGroup,
  delimiter: null,
  zIndex: 9999,
  type: "GET",
  noCache: false,
  onSearchStart: noop,
  onSearchComplete: noop,
  onSearchError: noop,
  preserveInput: false,
  containerClass: "autocomplete-suggestions",
  tabDisabled: false,
  dataType: "text",
  currentRequest: null,
  triggerSelectOnValidInput: true,
  preventBadQueries: true,
  lookupFilter,
  paramName: "query",
  transformResult,
  showNoSuggestionNotice: false,
  noSuggestionNotice: "No results",
  orientation: "bottom",
  forceFixPosition: false
};

// src/Autocomplete.ts
var _Autocomplete = class _Autocomplete {
  constructor(el, options) {
    this.suggestions = [];
    this.badQueries = [];
    this.selectedIndex = -1;
    this.timeoutId = null;
    this.cachedResponse = {};
    this.onChangeTimeout = null;
    this.onChange = null;
    this.isLocal = false;
    this.suggestionsContainer = null;
    this.noSuggestionsContainer = null;
    this.classes = {
      selected: "autocomplete-selected",
      suggestion: "autocomplete-suggestion"
    };
    this.hint = null;
    this.hintValue = "";
    this.selection = null;
    this.currentRequest = null;
    this.element = el;
    this.el = $(el);
    this.currentValue = el.value;
    this.options = $.extend(true, {}, _Autocomplete.defaults, options);
    this.initialize();
    this.setOptions(options);
  }
  initialize() {
    const that = this;
    const suggestionSelector = "." + that.classes.suggestion;
    const selected = that.classes.selected;
    const options = that.options;
    that.element.setAttribute("autocomplete", "off");
    that.noSuggestionsContainer = $('<div class="autocomplete-no-suggestion"></div>').html(options.noSuggestionNotice).get(0);
    that.suggestionsContainer = _Autocomplete.utils.createNode(options.containerClass);
    const container = $(that.suggestionsContainer);
    container.appendTo(options.appendTo || "body");
    if (options.width !== "auto") {
      container.css("width", options.width);
    }
    container.on("mouseover.autocomplete", suggestionSelector, function() {
      that.activate($(this).data("index"));
    });
    container.on("mouseout.autocomplete", function() {
      that.selectedIndex = -1;
      container.children("." + selected).removeClass(selected);
    });
    container.on("click.autocomplete", suggestionSelector, function() {
      that.select($(this).data("index"));
    });
    container.on("click.autocomplete", function() {
      if (that.blurTimeoutId !== void 0) {
        clearTimeout(that.blurTimeoutId);
      }
    });
    that.fixPositionCapture = function() {
      if (that.visible) {
        that.fixPosition();
      }
    };
    $(window).on("resize.autocomplete", that.fixPositionCapture);
    that.el.on("keydown.autocomplete", function(e) {
      that.onKeyPress(e);
    });
    that.el.on("keyup.autocomplete", function(e) {
      that.onKeyUp(e);
    });
    that.el.on("blur.autocomplete", function() {
      that.onBlur();
    });
    that.el.on("focus.autocomplete", function() {
      that.onFocus();
    });
    that.el.on("change.autocomplete", function(e) {
      that.onKeyUp(e);
    });
    that.el.on("input.autocomplete", function(e) {
      that.onKeyUp(e);
    });
  }
  onFocus() {
    if (this.disabled) {
      return;
    }
    this.fixPosition();
    if (this.el.val().length >= this.options.minChars) {
      this.onValueChange();
    }
  }
  onBlur() {
    const that = this;
    const options = that.options;
    const value = that.el.val();
    const query = that.getQuery(value);
    that.blurTimeoutId = setTimeout(function() {
      that.hide();
      if (that.selection && that.currentValue !== query) {
        (options.onInvalidateSelection || $.noop).call(that.element);
      }
    }, 200);
  }
  abortAjax() {
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
    }
  }
  setOptions(suppliedOptions) {
    const that = this;
    const options = $.extend({}, that.options, suppliedOptions);
    that.isLocal = Array.isArray(options.lookup);
    if (that.isLocal) {
      options.lookup = that.verifySuggestionsFormat(options.lookup);
    }
    options.orientation = that.validateOrientation(options.orientation, "bottom");
    $(that.suggestionsContainer).css({
      "max-height": options.maxHeight + "px",
      width: options.width + "px",
      "z-index": options.zIndex
    });
    this.options = options;
  }
  clearCache() {
    this.cachedResponse = {};
    this.badQueries = [];
  }
  clear() {
    this.clearCache();
    this.currentValue = "";
    this.suggestions = [];
  }
  disable() {
    this.disabled = true;
    if (this.onChangeTimeout) {
      clearTimeout(this.onChangeTimeout);
    }
    this.abortAjax();
  }
  enable() {
    this.disabled = false;
  }
  fixPosition() {
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
    const styles = {
      top: offset.top,
      left: offset.left
    };
    if (orientation === "auto") {
      const viewPortHeight = $(window).height() ?? 0;
      const scrollTop = $(window).scrollTop() ?? 0;
      const topOverflow = -scrollTop + offset.top - containerHeight;
      const bottomOverflow = scrollTop + viewPortHeight - (offset.top + height + containerHeight);
      orientation = Math.max(topOverflow, bottomOverflow) === topOverflow ? "top" : "bottom";
    }
    if (orientation === "top") {
      styles.top += -containerHeight;
    } else {
      styles.top += height;
    }
    if (containerParent !== document.body && containerParent !== void 0) {
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
  isCursorAtEnd() {
    const valLength = this.el.val().length;
    const selectionStart = this.element.selectionStart;
    if (typeof selectionStart === "number") {
      return selectionStart === valLength;
    }
    const legacyDoc = document;
    if (legacyDoc.selection) {
      const range = legacyDoc.selection.createRange();
      range.moveStart("character", -valLength);
      return valLength === range.text.length;
    }
    return true;
  }
  onKeyPress(e) {
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
  onKeyUp(e) {
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
        that.onChangeTimeout = setTimeout(function() {
          that.onValueChange();
        }, that.options.deferRequestBy);
      } else {
        that.onValueChange();
      }
    }
  }
  onValueChange() {
    if (this.ignoreValueChange) {
      this.ignoreValueChange = false;
      return;
    }
    const that = this;
    const options = that.options;
    const value = that.el.val();
    const query = that.getQuery(value);
    if (that.selection && that.currentValue !== query) {
      that.selection = null;
      (options.onInvalidateSelection || $.noop).call(
        that.element
      );
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
  isExactMatch(query) {
    const suggestions = this.suggestions;
    return suggestions.length === 1 && suggestions[0].value.toLowerCase() === query.toLowerCase();
  }
  getQuery(value) {
    const delimiter = this.options.delimiter;
    if (!delimiter) {
      return value;
    }
    const parts = value.split(delimiter);
    return parts[parts.length - 1].trim();
  }
  getSuggestionsLocal(query) {
    const options = this.options;
    const queryLowerCase = query.toLowerCase();
    const filter = options.lookupFilter;
    const limit = parseInt(options.lookupLimit, 10);
    const data = {
      suggestions: $.grep(options.lookup, function(suggestion) {
        return filter(suggestion, query, queryLowerCase);
      })
    };
    if (limit && data.suggestions.length > limit) {
      data.suggestions = data.suggestions.slice(0, limit);
    }
    return data;
  }
  getSuggestions(q) {
    const that = this;
    const options = that.options;
    let serviceUrl = options.serviceUrl;
    let response;
    let cacheKey;
    options.params[options.paramName] = q;
    if (options.onSearchStart.call(that.element, options.params) === false) {
      return;
    }
    const params = options.ignoreParams ? null : options.params;
    if (typeof options.lookup === "function") {
      options.lookup(q, function(data) {
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
      cacheKey = serviceUrl + "?" + $.param(params || {});
      response = that.cachedResponse[cacheKey];
    }
    if (response && Array.isArray(response.suggestions)) {
      that.suggestions = response.suggestions;
      that.suggest();
      options.onSearchComplete.call(that.element, q, response.suggestions);
    } else if (!that.isBadQuery(q)) {
      that.abortAjax();
      const ajaxSettings = {
        url: serviceUrl,
        data: params ?? void 0,
        type: options.type,
        dataType: options.dataType
      };
      $.extend(ajaxSettings, options.ajaxSettings);
      that.currentRequest = $.ajax(ajaxSettings).done(function(data) {
        that.currentRequest = null;
        const result = options.transformResult(data, q);
        that.processResponse(result, q, cacheKey);
        options.onSearchComplete.call(that.element, q, result.suggestions);
      }).fail(function(jqXHR, textStatus, errorThrown) {
        options.onSearchError.call(that.element, q, jqXHR, textStatus, errorThrown);
      });
    } else {
      options.onSearchComplete.call(that.element, q, []);
    }
  }
  isBadQuery(q) {
    if (!this.options.preventBadQueries) {
      return false;
    }
    const badQueries = this.badQueries;
    let i = badQueries.length;
    while (i--) {
      if (q.indexOf(badQueries[i]) === 0) {
        return true;
      }
    }
    return false;
  }
  hide() {
    const that = this;
    const container = $(that.suggestionsContainer);
    if (typeof that.options.onHide === "function" && that.visible) {
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
  suggest() {
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
    let category;
    const formatGroupFn = (suggestion) => {
      const currentCategory = suggestion.data[groupBy];
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
    $.each(that.suggestions, function(i, suggestion) {
      if (groupBy) {
        html += formatGroupFn(suggestion);
      }
      html += '<div class="' + className + '" data-index="' + i + '">' + formatResultFn(suggestion, value, i) + "</div>";
    });
    this.adjustContainerWidth();
    noSuggestionsContainer.detach();
    container.html(html);
    if (typeof beforeRender === "function") {
      beforeRender.call(that.element, container, that.suggestions);
    }
    that.fixPosition();
    container.show();
    if (options.autoSelectFirst) {
      that.selectedIndex = 0;
      container.scrollTop(0);
      container.children("." + className).first().addClass(classSelected);
    }
    that.visible = true;
    that.findBestHint();
  }
  noSuggestions() {
    const that = this;
    const beforeRender = that.options.beforeRender;
    const container = $(that.suggestionsContainer);
    const noSuggestionsContainer = $(that.noSuggestionsContainer);
    this.adjustContainerWidth();
    noSuggestionsContainer.detach();
    container.empty();
    container.append(noSuggestionsContainer);
    if (typeof beforeRender === "function") {
      beforeRender.call(that.element, container, that.suggestions);
    }
    that.fixPosition();
    container.show();
    that.visible = true;
  }
  adjustContainerWidth() {
    const options = this.options;
    const container = $(this.suggestionsContainer);
    if (options.width === "auto") {
      const width = this.el.outerWidth() ?? 0;
      container.css("width", width > 0 ? width : 300);
    } else if (options.width === "flex") {
      container.css("width", "");
    }
  }
  findBestHint() {
    const that = this;
    const value = that.el.val().toLowerCase();
    let bestMatch = null;
    if (!value) {
      return;
    }
    $.each(that.suggestions, function(_i, suggestion) {
      const foundMatch = suggestion.value.toLowerCase().indexOf(value) === 0;
      if (foundMatch) {
        bestMatch = suggestion;
      }
      return !foundMatch;
    });
    that.onHint(bestMatch);
  }
  onHint(suggestion) {
    const that = this;
    const onHintCallback = that.options.onHint;
    let hintValue = "";
    if (suggestion) {
      hintValue = that.currentValue + suggestion.value.substr(that.currentValue.length);
    }
    if (that.hintValue !== hintValue) {
      that.hintValue = hintValue;
      that.hint = suggestion;
      if (typeof onHintCallback === "function") {
        onHintCallback.call(that.element, hintValue);
      }
    }
  }
  verifySuggestionsFormat(suggestions) {
    if (suggestions.length && typeof suggestions[0] === "string") {
      return $.map(suggestions, function(value) {
        return { value, data: null };
      });
    }
    return suggestions;
  }
  validateOrientation(orientation, fallback) {
    const normalized = (orientation || "").trim().toLowerCase();
    if ($.inArray(normalized, ["auto", "bottom", "top"]) === -1) {
      return fallback;
    }
    return normalized;
  }
  processResponse(result, originalQuery, cacheKey) {
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
  activate(index) {
    const that = this;
    const selected = that.classes.selected;
    const container = $(that.suggestionsContainer);
    const children = container.find("." + that.classes.suggestion);
    container.find("." + selected).removeClass(selected);
    that.selectedIndex = index;
    if (that.selectedIndex !== -1 && children.length > that.selectedIndex) {
      const activeItem = children.get(that.selectedIndex);
      $(activeItem).addClass(selected);
      return activeItem;
    }
    return null;
  }
  selectHint() {
    const i = $.inArray(this.hint, this.suggestions);
    this.select(i);
  }
  select(i) {
    this.hide();
    this.onSelect(i);
  }
  moveUp() {
    const that = this;
    if (that.selectedIndex === -1) {
      return;
    }
    if (that.selectedIndex === 0) {
      $(that.suggestionsContainer).children("." + that.classes.suggestion).first().removeClass(that.classes.selected);
      that.selectedIndex = -1;
      that.ignoreValueChange = false;
      that.el.val(that.currentValue);
      that.findBestHint();
      return;
    }
    that.adjustScroll(that.selectedIndex - 1);
  }
  moveDown() {
    if (this.selectedIndex === this.suggestions.length - 1) {
      return;
    }
    this.adjustScroll(this.selectedIndex + 1);
  }
  adjustScroll(index) {
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
      that.el.val(that.getValue(that.suggestions[index].value));
    }
    that.onHint(null);
  }
  onSelect(index) {
    const that = this;
    const onSelectCallback = that.options.onSelect;
    const suggestion = that.suggestions[index];
    that.currentValue = that.getValue(suggestion.value);
    if (that.currentValue !== that.el.val() && !that.options.preserveInput) {
      that.el.val(that.currentValue);
    }
    that.onHint(null);
    that.suggestions = [];
    that.selection = suggestion;
    if (typeof onSelectCallback === "function") {
      onSelectCallback.call(that.element, suggestion);
    }
  }
  getValue(value) {
    const delimiter = this.options.delimiter;
    if (!delimiter) {
      return value;
    }
    const currentValue = this.currentValue;
    const parts = currentValue.split(delimiter);
    if (parts.length === 1) {
      return value;
    }
    return currentValue.substr(0, currentValue.length - parts[parts.length - 1].length) + value;
  }
  dispose() {
    this.el.off(".autocomplete").removeData("autocomplete");
    if (this.fixPositionCapture) {
      $(window).off("resize.autocomplete", this.fixPositionCapture);
    }
    $(this.suggestionsContainer).remove();
  }
};
_Autocomplete.defaults = defaults;
_Autocomplete.utils = utils;
var Autocomplete = _Autocomplete;

// src/jquery-plugin.ts
var dataKey = "autocomplete";
function installAutocomplete($2) {
  setJQuery($2);
  $2.Autocomplete = Autocomplete;
  $2.fn.devbridgeAutocomplete = function(options, args) {
    if (!arguments.length) {
      return this.first().data(dataKey);
    }
    return this.each(function() {
      const inputElement = $2(this);
      let instance = inputElement.data(dataKey);
      if (typeof options === "string") {
        if (instance && typeof instance[options] === "function") {
          instance[options](
            args
          );
        }
      } else {
        if (instance && instance.dispose) {
          instance.dispose();
        }
        instance = new Autocomplete(this, options);
        inputElement.data(dataKey, instance);
      }
    });
  };
  if (!$2.fn.autocomplete) {
    $2.fn.autocomplete = $2.fn.devbridgeAutocomplete;
  }
}

// src/index.ts
installAutocomplete(jQuery);
export {
  Autocomplete
};
