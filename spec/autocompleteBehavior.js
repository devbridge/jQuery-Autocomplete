/*jslint vars: true*/
/*global describe, it, expect, waitsFor, runs, afterEach, $*/

describe('Autocomplete', function () {
    'use strict';

    afterEach(function () {
        $('.autocomplete-suggestions').hide();
    });

    it('Should initialize autocomplete options', function () {
        var input = document.createElement('input'),
            options = { serviceUrl: '/autocomplete/service/url' },
            autocomplete = new $.Autocomplete(input, options);

        expect(autocomplete.options.serviceUrl).toEqual(options.serviceUrl);
        expect(autocomplete.suggestionsContainer).not.toBeNull();
    });

    it('Should set autocomplete attribute to "off"', function () {
        var input = document.createElement('input'),
            autocomplete = new $.Autocomplete(input, {});

        expect(autocomplete).not.toBeNull();
        expect(input.getAttribute('autocomplete')).toEqual('off');
    });

    it('Should get current value', function () {
        var input = document.createElement('input'),
            autocomplete = new $.Autocomplete(input, {
                lookup: [{ value: 'Jamaica', data: 'B' }]
            });

        input.value = 'Jam';
        autocomplete.onValueChange();

        expect(autocomplete.visible).toBe(true);
        expect(autocomplete.currentValue).toEqual('Jam');
    });

    it('Should call formatResult three times', function () {
        var input = document.createElement('input'),
            counter = 0,
            suggestion,
            currentValue,
            autocomplete = new $.Autocomplete(input, {
                lookup: ['Jamaica', 'Jamaica', 'Jamaica'],
                formatResult: function (s, v) {
                    suggestion = s;
                    currentValue = v;
                    counter += 1;
                }
            });

        input.value = 'Jam';
        autocomplete.onValueChange();

        expect(suggestion.value).toBe('Jamaica');
        expect(suggestion.data).toBe(null);
        expect(currentValue).toEqual('Jam');
        expect(counter).toEqual(3);
    });

    it('Verify onSelect callback', function () {
        var input = document.createElement('input'),
            context,
            value,
            data,
            autocomplete = new $.Autocomplete(input, {
                lookup: [{ value: 'A', data: 'B' }],
                onSelect: function (suggestion) {
                    context = this;
                    value = suggestion.value;
                    data = suggestion.data;
                }
            });

        input.value = 'A';
        autocomplete.onValueChange();
        autocomplete.select(0);

        expect(context).toEqual(input);
        expect(value).toEqual('A');
        expect(data).toEqual('B');
    });

    it('Should convert suggestions format', function () {
        var input = document.createElement('input'),
            autocomplete = new $.Autocomplete(input, {
                lookup: ['A', 'B']
            });

        expect(autocomplete.options.lookup[0].value).toBe('A');
        expect(autocomplete.options.lookup[1].value).toBe('B');
    });

    it('Should execute onSearchStart and onSearchCompleted', function () {
        var input = document.createElement('input'),
            startQuery,
            completeQuery,
            ajaxExecuted = false,
            autocomplete = new $.Autocomplete(input, {
                serviceUrl: '/test',
                onSearchStart: function (query) {
                    startQuery = query;
                },
                onSearchComplete: function (query) {
                    completeQuery = query;
                }
            });

        $.mockjax({
            url: '/test',
            responseTime: 50,
            response: function (settings) {
                ajaxExecuted = true;
                var query = settings.data.query,
                    response = {
                        query: query,
                        suggestions: []
                    };
                ajaxExecuted = true;
                this.responseText = JSON.stringify(response);
            }
        });

        input.value = 'A';
        autocomplete.onValueChange();

        waitsFor(function () {
            return ajaxExecuted;
        }, 'Ajax call never completed.', 100);

        runs(function () {
            expect(ajaxExecuted).toBe(true);
            expect(startQuery).toBe('A');
            expect(completeQuery).toBe('A');
        });
    });
});