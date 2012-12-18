/*jslint vars: true*/
/*global describe, it, expect, $*/

describe('Autocomplete', function () {
    'use strict';

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

});