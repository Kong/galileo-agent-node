// Requires
var util = require('util');
var url = require('url');
var qs = require('qs');
var os = require('os');
var package = require('../package.json');

// Server interface list
var networkInterfaces = os.networkInterfaces();

// Helper functions

function getServerAddress () {
  for (var name in networkInterfaces) {
    var face = networkInterfaces[name];

    for (var i = face.length; i--;) {
      var alias = face[i];

      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.interface ) {
        return alias.address;
      }
    }
  }

  return '';
}

function setCharAt (str, index, chr) {
  return (index > str.length - 1) ? str : str.substr(0, index) + chr + str.substr(index + 1);
}

function normalizeHeaderName (headerName) {
  var pieces = headerName.split('-');
  var length = pieces.length;
  var index = 0;

  for (; index < length; index++) {
    pieces[index] = setCharAt(pieces[index], 0, pieces[index].charAt(0).toUpperCase());
  }

  return pieces.join('-');
}

function createHeaderStringFromReqObject (req) {
  var headers = util.format('%s %s HTTP/%d.%d\r\n', req.method, req.url, req.versionMajor, req.versionMinor);

  for (var key in req.headers) {
    headers += normalizeHeaderName(key) + ': ' + req.headers[key] + '\r\n';
  }

  return headers + '\r\n';
}

function createHeaderStringFromResObject (res) {
  var headers = util.format('%s %s HTTP/%d.%d\r\n', res.method, res.url, res.versionMajor, res.versionMinor);

  for (var key in res._headers) {
    headers += normalizeHeaderName(key) + ': ' + res._headers[key] + '\r\n';
  }

  return headers + '\r\n';
}

/**
 * Transform objects into an array of key value pairs.
 */
function objectToArray (obj) {
  var results = [];
  var names = Object.keys(obj);

  for(var i = names.length; i--;) {
    results.push({
      name: names[i],
      value: obj[names[i]]
    });
  }

  return results;
}

/**
 * Parse url for a query object.
 */
function getQueryObjectFromUrl (parseUrl) {
  if (typeof parseUrl === 'string') {
    return qs.parse(url.parse(parseUrl).query);
  }

  return {};
}

/**
 * Convert http request and responses to HAR
 */
module.exports = function convertRequestToHar (req, res, reqReceived) {
  var agentResStartTime = new Date();
  var reqHeaders = objectToArray(req.headers);
  var reqHeaderBuffer = new Buffer(createHeaderStringFromReqObject(req));
  var reqQuery = objectToArray(getQueryObjectFromUrl(req.url));
  var reqReceivedTime = reqReceived.getTime();
  var reqBodySize = req.headers['content-length'] ? parseFloat(req.headers['content-length']) : -1;
  var resHeaders = objectToArray(res._headers || {});
  var resHeaderBuffer = new Buffer(res._header || createHeaderStringFromResObject(res));
  var resBodySize = res._headers['content-length'] ? parseFloat(res._headers['content-length']) : -1;
  var waitTime = agentResStartTime.getTime() - reqReceivedTime;
  var protocol = req.connection.encrypted ? 'https' : 'http';
  var resBodyBuffer = 0;

  return {
    // TODO Browser Object
    // TODO Pages Object
    version: 1.2,
    creator: {
      name: package.name,
      version: package.version
    },
    entries: [{
      // TODO pagerefid
      // TODO connection
      serverIPAddress: getServerAddress(),
      startedDateTime: agentResStartTime.toISOString(),
      request: {
        method: req.method,
        url: protocol + '://' + req.headers.host + req.url, // TODO construct full URL
        httpVersion: 'HTTP/' + req.httpVersion,
        queryString: reqQuery,
        headers: reqHeaders,
        headersSize: reqHeaderBuffer.length || -1,
        bodySize: reqBodySize
      },
      response: {
        status: res.statusCode,
        statusText: '', // TODO get status text
        httpVersion: 'HTTP/1.1',
        headers: resHeaders,
        content: {
          // TODO get body size
          // TODO get compression
          // TODO get text
          // TODO get encoding
          size: resBodySize,
          mimeType: res._headers ? res._headers['content-type'] : 'text/plain',
        },
        redirectUrl: res._headers && res._headers.location ? res._headers.location : '',
        headersSize: resHeaderBuffer.length || -1,
        bodySize: resBodySize
      },
      cache: {},
      timings: {
        // TODO dns
        // TODO connect
        // TODO blocked
        // TODO ssl
        send: 0, // TODO
        wait: waitTime,
        receive: 0  // TODO
      }
    }]
  };
};
