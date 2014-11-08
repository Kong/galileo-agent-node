/**
 * Convert Express request and responses to HAR
 */
 var package = require('../package.json');

// Helper function
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

// HAR Conversion method
module.exports = function(req, res, reqReceived) {
  //console.log(req);
  var reqHeaders = mapToNameValueMapArray(req.headers);
  var reqQueryString = mapToNameValueMapArray(req.query); // TODO parse properly - this may leave "name" as an array
  var resHeaders = mapToNameValueMapArray(res._headers); // TODO not safe

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
        // pagerefit:
        startedDateTime: new Date(),
        time: 0,
        request: {
          method: req.method,
          url: req.url, // TODO construct full URL
          httpVersion: req.httpVersion,
          headers: reqHeaders,
          headersSize: req.header.length
          // bodySize
        },
        response: {
          status: res.statusCode,
          statusText: '', // TODO get status text
          httpVersion: 'HTTP/1.1',
          headers: resHeaders,
          content: {
            size: 0, // TODO get response header & body size
            mimeType: res._headers['content-type'],
            // text
          },
          redirectUrl: res._headers['location'],
          // headersSize
          // bodySize
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
        }
      }
    ]
  };
};
