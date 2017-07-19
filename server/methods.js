const { OperationHelper } = require('apac');
Future = Npm.require('fibers/future');

var amazonClient = new OperationHelper({
    awsId: Meteor.settings.awsProduct.key,
    awsSecret: Meteor.settings.awsProduct.secret,
    assocId: Meteor.settings.awsProduct.assocId,
    maxRequestsPerSecond: 1
});

var countriesList = ['FR', 'CA', 'UK', 'DE', 'IT', 'ES'];

Meteor.methods({

    // translate: function(inputText, lang) {

    //     // var myFuture = new Future();

    //     // translate(inputText, { to: 'en' }).then(res => {
    //     //     console.log(res.text);
    //     //     myFuture.return(res.text);
    //     // }).catch(err => {
    //     //     console.error(err);
    //     //     myFuture.return({});
    //     // });

    //     // return myFuture.wait();

    //     var url = 'https://translate.yandex.net/api/v1.5/tr.json/translate?key=';
    //     url += Meteor.settings.yandex.key;
    //     url += '&text=' + inputText;
    //     url += '&lang=' + lang;

    //     var answer = HTTP.get(url);

    //     return answer.data.text;

    // },
    clearLinks: function() {

        Links.remove({});

    },
    getProductKeyword: function(keyword) {

        // Find product
        var items = Meteor.call('findAmazonItems', keyword, 'US');

        if (items.Item) {
            return items.Item;
        } else {
            return [];
        }

    },
    getPrice: function(item, answer) {

        if (item.ItemAttributes.ListPrice) {

            answer.price = parseFloat(item.ItemAttributes.ListPrice.Amount) / 100;
            answer.currency = item.ItemAttributes.ListPrice.CurrencyCode;

        } else if (item.OfferSummary.LowestNewPrice) {
            answer.price = parseFloat(item.OfferSummary.LowestNewPrice.Amount) / 100;
            answer.currency = item.OfferSummary.LowestNewPrice.CurrencyCode;
        } else if (item.VariationSummary) {

            if (item.VariationSummary.LowestPrice && item.VariationSummary.HighestPrice) {

                answer.price = (parseFloat(item.VariationSummary.HighestPrice.Amount) + parseFloat(item.VariationSummary.LowestPrice.Amount)) / 200;
                answer.currency = item.VariationSummary.LowestPrice.CurrencyCode;

            }

        }

        return answer;

    },
    getCommission: function(item, answer) {

        // By category
        if (item.ItemAttributes.ProductGroup) {

            var group = item.ItemAttributes.ProductGroup;

            if (group == 'PC Accessory' || group == 'Personal Computer' || group == 'Speakers') {
                answer.commission = 2.5;
            }

            if (group == 'Kitchen') {
                answer.commission = 4.5;
            }

            if (group == 'Pet Products') {
                answer.commission = 8;
            }

        }

        // By product type name
        if (item.ItemAttributes.ProductTypeName && !answer.commission) {

            var category = item.ItemAttributes.ProductTypeName;

            if (category == 'OUTDOOR_RECREATION_PRODUCT') {
                answer.commission = 5;
            }
            if (category == 'COMPUTER_COMPONENT') {
                answer.commission = 2;
            }
            if (category == 'PET_SUPPLIES') {
                answer.commission = 8;
            }
            if (category == 'KITCHEN') {
                answer.commission = 4.5;
            }

        }

        // If not found
        if (!answer.commission) {
            answer.commission = 4;
        }

        return answer;

    },
    getLocalisedLinks: function(asinArray, locale) {

        var links = [];
        for (i in asinArray) {
            var link = Meteor.call('getLocalisedLink', asinArray[i], locale);
            links.push(link);
        }

        return links;

    },
    getLocalisedLink: function(asin, locale) {

        query = {};
        query[locale + '.ASIN'] = asin;
        console.log(query)

        var answer = {};

        // Check if exists
        if (Links.findOne(query)) {

            answer = Links.findOne(query);

        } else if (locale == 'US') {

            // Check that product exist
            var lookup = Meteor.call('lookupAmazonItem', asin);

            if (lookup.Request.Errors) {
                console.log(lookup.Request.Errors);
            }

            if (lookup.Item) {

                // Refresh if parent
                if (lookup.Item.ParentASIN && !lookup.Item.ItemAttributes.ListPrice) {
                    lookup = Meteor.call('lookupAmazonItem', lookup.Item.ParentASIN);
                }

                console.log(lookup.Item);

                // US
                answer.asin = asin;
                answer['US'] = {};
                answer['US'].ASIN = asin;
                answer['US'].title = lookup.Item.ItemAttributes.Title;

                // Get price
                answer['US'] = Meteor.call('getPrice', lookup.Item, answer['US']);
                answer['US'] = Meteor.call('getCommission', lookup.Item, answer['US']);

                // Other countries
                for (c in countriesList) {

                    answer[countriesList[c]] = {};

                    // Find product
                    var items = Meteor.call('findAmazonItems', answer['US'].title, countriesList[c]);

                    if (items.Item) {

                        if (Array.isArray(items.Item)) {
                            answer[countriesList[c]].ASIN = items.Item[0].ASIN;
                            answer[countriesList[c]].title = items.Item[0].ItemAttributes.Title;
                            answer[countriesList[c]] = Meteor.call('getPrice', items.Item[0], answer[countriesList[c]]);
                            answer[countriesList[c]] = Meteor.call('getCommission', lookup.Item, answer[countriesList[c]]);
                        } else {
                            answer[countriesList[c]].ASIN = items.Item.ASIN;
                            answer[countriesList[c]].title = items.Item.ItemAttributes.Title;
                            answer[countriesList[c]] = Meteor.call('getPrice', items.Item, answer[countriesList[c]]);
                            answer[countriesList[c]] = Meteor.call('getCommission', lookup.Item, answer[countriesList[c]]);

                        }

                    }

                    if (items.MoreSearchResultsUrl) {
                        answer[countriesList[c]].moreLink = items.MoreSearchResultsUrl;
                    }

                }

                // Save
                Links.insert(answer);


            } else {
                answer.message = 'Invalid ASIN';
            }

        } else {
            answer.message = 'Invalid ASIN';
        }

        return answer;

    },
    lookupAmazonItem: function(asin) {

        var myFuture = new Future();

        amazonClient.execute('ItemLookup', {
            'ItemId': asin,
            'ResponseGroup': 'ItemAttributes,Offers,VariationSummary'
        }).then((response) => {
            // console.log("ItemLookup result: ", response.result.ItemLookupResponse);
            myFuture.return(response.result.ItemLookupResponse.Items);
        }).catch((err) => {
            console.error("Something went wrong in lookup! ", err);
            myFuture.return({});
        });

        return myFuture.wait();

    },
    findAmazonItems: function(keyword, domain) {

        // console.log('Domain:' + domain);
        // console.log('Keyword:' + keyword);

        // if (domain == 'DE' || domain == 'IT' || domain == 'ES') {
        //     keyword = Meteor.call('translate', keyword, domain.toLowerCase());
        //     console.log('Translated keyword:' + keyword);
        // }

        var myFuture = new Future();

        var opHelper = new OperationHelper({
            awsId: Meteor.settings.awsProduct.key,
            awsSecret: Meteor.settings.awsProduct.secret,
            assocId: Meteor.settings.awsProduct.assocId,
            maxRequestsPerSecond: 1,
            locale: domain
        });

        opHelper.execute('ItemSearch', {
            'Keywords': keyword,
            'SearchIndex': 'All',
            'ResponseGroup': 'ItemAttributes,Offers,VariationSummary'
        }).then((response) => {
            // console.log("ItemSearch result: ", response.result.ItemSearchResponse.Items);
            myFuture.return(response.result.ItemSearchResponse.Items);
        }).catch((err) => {
            console.error("Something went wrong in search! ", err);
            myFuture.return([]);
        });

        return myFuture.wait();

    },

});
