var url = require('url');
var qs = require('qs');
var package = require('../package.json');

/**
 * Helper functions for HAR
 */

// Transform objects into an array of key value pairs.
var mapToNameValueMapArray = function(obj) {
  var results = [];
  var names = Object.keys(obj);

  for(var i = names; i--;) {
    results.push({
      name: names[i],
      value: obj[names[i]]
    });
  }
};

// Parse url for a query object.
var parseUrlForQuery = function(parseUrl) {
  var queryString = url.parse(parseUrl).query;
  if (queryString) {
    return qs.parse(queryString);
  } else {
    return {};
  }
}

/**
 * Convert http request and responses to HAR
 */
module.exports = function(req, res, reqReceived) {
  var reqHeaders = mapToNameValueMapArray(req.headers);
  var reqQuery = mapToNameValueMapArray(parseUrlForQuery(req.url));
  var resHeaders = mapToNameValueMapArray(res._headers || {});

  var reqReceivedTime = reqReceived.getTime();
  var waitTime = new Date().getTime() - reqReceivedTime;

  return {
    version: 1.2,
    creator: {
      name: package.name,
      version: package.version
    },
    // browser
    // pages
    entries: [
      {
        // pagerefid:
        startedDateTime: new Date().toISOString(),
        request: {
          method: req.method,
          url: req.url, // TODO construct full URL
          httpVersion: 'HTTP/' + req.httpVersion,
          queryString: reqQuery,
          headers: reqHeaders,
          headersSize: -1, // TODO
          bodySize: -1  // TODO
        },
        response: {
          status: res.statusCode,
          statusText: '', // TODO get status text
          httpVersion: 'HTTP/1.1',
          headers: resHeaders,
          content: {
            size: -1, // TODO get response header & body size
            // compression
            mimeType: res._headers ? res._headers['content-type'] : '',
            // text
            // encoding
          },
          redirectUrl: res._headers ? res._headers['location'] : '',
          headersSize: -1,
          bodySize: -1
        },
        cache: {},
        timings: {
          // dns
          // connect
          // blocked
          send: 0, // TODO
          wait: waitTime,
          receive: 0  // TODO
          // ssl
        },
        //serverIPaddress
        //connection
      }
    ]
  };
};
