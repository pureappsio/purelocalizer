Router.route("/links/:asin", { where: "server" }).get(function() {

    // Get asin
    var asin = this.params.asin;

    // Check if multiple asins
    var array = asin.split(',');

    // Locale?
    if (this.params.query.locale) {
        var locale = this.params.query.locale;
    } else {
        locale = 'US';
    }

    if (array.length > 1) {

        // Several
        var answer = Meteor.call('getLocalisedLinks', array, locale);

    } else {

        var answer = Meteor.call('getLocalisedLink', asin, locale);

    }

    // Send response
    this.response.setHeader('Content-Type', 'application/json');
    this.response.end(JSON.stringify(answer));

});

Router.route("/keywords/:keyword", { where: "server" }).get(function() {

    // Get asin
    var keyword = this.params.keyword;

    var answer = Meteor.call('getProductKeyword', keyword);

    // Send response
    this.response.setHeader('Content-Type', 'application/json');
    this.response.end(JSON.stringify(answer));

});
