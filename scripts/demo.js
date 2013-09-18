﻿/*jslint  browser: true, white: true, plusplus: true */
/*global $: true */

$(function () {
    'use strict';

    // Load countries then initialize plugin:
    $.ajax({
        url: 'content/countries.txt',
        dataType: 'json'
    }).done(function (source) {

        // Setup jQuery ajax mock:
        $.mockjax({
            url: '*',
            responseTime: 2000,
            response: function (settings) {
                var query = settings.data.query,
                    queryLowerCase = query.toLowerCase(),
                    re = new RegExp('\\b' + $.Autocomplete.utils.escapeRegExChars(queryLowerCase), 'i'),
                    suggestions = $.grep(countriesArray, function (country) {
                         // return country.value.toLowerCase().indexOf(queryLowerCase) === 0;
                        return re.test(country.value);
                    }),
                    response = {
                        query: query,
                        suggestions: suggestions
                    };

                this.responseText = JSON.stringify(response);
            }
        });

        // Initialize ajax autocomplete:
        $('#autocomplete-ajax').autocomplete({
            serviceUrl: '/autosuggest/service/url',
            triggerSelectOnValidInput: true,
            minChars: 0,
            showSuggestionsOnFocus: true,
            hideSuggestionsOnBlurDelay: 0,
            onHint: function (hint) {
                $('#autocomplete-ajax-x').val(hint);
            },
            onSelect: function(suggestion) {
                $('#selction-ajax').html('You selected: ' + suggestion.value + ', ' + suggestion.data);
            },
            onInvalidateSelection: function() {
                $('#selction-ajax').html('You selected: none');
            }
        });
    });

    var countriesArray = $.map(countries, function (value, key) { return { value: value, data: key }; });

    // Initialize autocomplete with local lookup:
    $('#autocomplete').autocomplete({
        lookup: countriesArray,
        lookupFilter: function(suggestion, originalQuery, queryLowerCase) {
            var re = new RegExp('\\b' + $.Autocomplete.utils.escapeRegExChars(queryLowerCase), 'i');
            return re.test(suggestion.value);
        },
        triggerSelectOnValidInput: true,
        minChars: 0,
        showSuggestionsOnFocus: true,
        onSelect: function (suggestion) {
            $('#selection').html('You selected: ' + suggestion.value + ', ' + suggestion.data);
        },
        onInvalidateSelection: function() {
            $('#selction').html('You selected: none');
        }
    });

    // Initialize autocomplete with custom appendTo:
    $('#autocomplete-custom-append').autocomplete({
        lookup: countriesArray,
        appendTo: '#suggestions-container'
    });

    // Initialize autocomplete with custom appendTo:
    $('#autocomplete-dynamic').autocomplete({
        lookup: countriesArray
    });
});