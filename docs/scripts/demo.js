/*global $, countries */

$(function () {
    'use strict';

    // Build the canonical countries lookup array: { value: name, data: code }
    var countriesArray = $.map(countries, function (value, key) {
        return { value: value, data: key };
    });

    // -----------------------------------------------------------------
    // mockjax — intercept demo #01's /api/countries calls so the page
    // works offline. Real consumers would point `serviceUrl` at a real
    // endpoint; the response shape is identical.
    // -----------------------------------------------------------------
    $.mockjax({
        url: '/api/countries',
        responseTime: 150,
        response: function (settings) {
            var query = settings.data.query || '',
                queryLowerCase = query.toLowerCase(),
                re = new RegExp(
                    '\\b' + $.Autocomplete.utils.escapeRegExChars(queryLowerCase),
                    'gi'
                ),
                suggestions = $.grep(countriesArray, function (country) {
                    return re.test(country.value);
                });

            this.responseText = JSON.stringify({
                query: query,
                suggestions: suggestions
            });
        }
    });

    // -----------------------------------------------------------------
    // 01 — Ajax lookup with ghost completion
    // -----------------------------------------------------------------
    var $selectionAjax = $('#selection-ajax');
    var $ghost = $('#autocomplete-ajax-x');

    $('#autocomplete-ajax').devbridgeAutocomplete({
        serviceUrl: '/api/countries',
        onSelect: function (suggestion) {
            $selectionAjax
                .addClass('has-selection')
                .html(
                    'Selected <strong>' + suggestion.value + '</strong>' +
                    ' (code <code>' + suggestion.data + '</code>)'
                );
        },
        onHint: function (hint) {
            $ghost.val(hint);
        },
        onInvalidateSelection: function () {
            $selectionAjax.removeClass('has-selection').text('No selection.');
        }
    });

    // -----------------------------------------------------------------
    // 02 — Local data with grouping
    // -----------------------------------------------------------------
    var nhlTeams = [
        'Anaheim Ducks', 'Atlanta Thrashers', 'Boston Bruins', 'Buffalo Sabres',
        'Calgary Flames', 'Carolina Hurricanes', 'Chicago Blackhawks',
        'Colorado Avalanche', 'Columbus Blue Jackets', 'Dallas Stars',
        'Detroit Red Wings', 'Edmonton Oilers', 'Florida Panthers',
        'Los Angeles Kings', 'Minnesota Wild', 'Montreal Canadiens',
        'Nashville Predators', 'New Jersey Devils', 'New York Islanders',
        'New York Rangers', 'Ottawa Senators', 'Philadelphia Flyers',
        'Phoenix Coyotes', 'Pittsburgh Penguins', 'Saint Louis Blues',
        'San Jose Sharks', 'Tampa Bay Lightning', 'Toronto Maple Leafs',
        'Vancouver Canucks', 'Washington Capitals'
    ];
    var nbaTeams = [
        'Atlanta Hawks', 'Boston Celtics', 'Charlotte Bobcats', 'Chicago Bulls',
        'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
        'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets',
        'Indiana Pacers', 'LA Clippers', 'LA Lakers', 'Memphis Grizzlies',
        'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves',
        'New Jersey Nets', 'New Orleans Hornets', 'New York Knicks',
        'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia Sixers',
        'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings',
        'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz',
        'Washington Wizards'
    ];
    var nhl = $.map(nhlTeams, function (team) {
        return { value: team, data: { category: 'NHL' } };
    });
    var nba = $.map(nbaTeams, function (team) {
        return { value: team, data: { category: 'NBA' } };
    });
    var teams = nhl.concat(nba);

    var $selection = $('#selection');

    $('#autocomplete').devbridgeAutocomplete({
        lookup: teams,
        minChars: 1,
        groupBy: 'category',
        showNoSuggestionNotice: true,
        noSuggestionNotice: 'Sorry, no matching results',
        onSelect: function (suggestion) {
            $selection
                .addClass('has-selection')
                .html(
                    'Selected <strong>' + suggestion.value + '</strong>' +
                    ' &middot; ' + suggestion.data.category
                );
        },
        onInvalidateSelection: function () {
            $selection.removeClass('has-selection').text('No selection.');
        }
    });

    // -----------------------------------------------------------------
    // 03 — Custom suggestion container
    // -----------------------------------------------------------------
    $('#autocomplete-custom-append').devbridgeAutocomplete({
        lookup: countriesArray,
        appendTo: '#suggestions-container'
    });

    // -----------------------------------------------------------------
    // 04 — Dynamic width
    // -----------------------------------------------------------------
    $('#autocomplete-dynamic').devbridgeAutocomplete({
        lookup: countriesArray
    });
});
