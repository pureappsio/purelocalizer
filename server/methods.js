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

    clearLinks: function() {

        Links.remove({});

    },
    getProductKeyword: function(keyword) {

        // Find product
        var items = Meteor.call('findAmazonItems', keyword, 'US');

        if (items.Item) {
            return items.Item;
        }
        else {
            return [];
        }

    },
    getLocalisedLink: function(asin) {

        // Check if exists
        if (Links.findOne({ asin: asin })) {
            return Links.findOne({ asin: asin });
        } else {

            var answer = {};

            // Check that product exist
            var lookup = Meteor.call('lookupAmazonItem', asin);

            if (lookup.Item) {

                // US
                answer.asin = asin;
                answer['US'] = {};
                answer['US'].ASIN = asin;
                answer['US'].title = lookup.Item.ItemAttributes.Title;

                // Other countries
                for (c in countriesList) {

                    answer[countriesList[c]] = {};

                    // Find product
                    var items = Meteor.call('findAmazonItems', answer['US'].title, countriesList[c]);
                    console.log(items);

                    if (items.Item) {

                        if (Array.isArray(items.Item)) {
                            answer[countriesList[c]].ASIN = items.Item[0].ASIN;
                            answer[countriesList[c]].title = items.Item[0].ItemAttributes.Title;
                        } else {
                            answer[countriesList[c]].ASIN = items.Item.ASIN;
                            answer[countriesList[c]].title = items.Item.ItemAttributes.Title;

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

            return answer;

        }

    },
    lookupAmazonItem: function(asin) {

        var myFuture = new Future();

        amazonClient.execute('ItemLookup', {
            'ItemId': asin,
        }).then((response) => {
            // console.log("ItemLookup result: ", response.result.ItemLookupResponse);
            myFuture.return(response.result.ItemLookupResponse.Items);
        }).catch((err) => {
            console.error("Something went wrong! ", err);
            myFuture.return({});
        });

        return myFuture.wait();

    },
    findAmazonItems: function(keyword, domain) {

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
            'SearchIndex': 'All'
        }).then((response) => {
            // console.log("ItemSearch result: ", response.result.ItemSearchResponse.Items);
            myFuture.return(response.result.ItemSearchResponse.Items);
        }).catch((err) => {
            console.error("Something went wrong! ", err);
            myFuture.return([]);
        });

        return myFuture.wait();

    },

});
