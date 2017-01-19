Router.route("/links/:asin", { where: "server" } ).get( function() {

  // Get asin
  var asin = this.params.asin;

  var answer = Meteor.call('getLocalisedLink', asin);

  // Send response
  this.response.setHeader('Content-Type', 'application/json');
  this.response.end(JSON.stringify(answer));

});

Router.route("/keywords/:keyword", { where: "server" } ).get( function() {

  // Get asin
  var keyword = this.params.keyword;

  var answer = Meteor.call('getProductKeyword', keyword);

  // Send response
  this.response.setHeader('Content-Type', 'application/json');
  this.response.end(JSON.stringify(answer));

});