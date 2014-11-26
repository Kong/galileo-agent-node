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

function parseResponseHeaderString (string) {
  if (string === '' || string.indexOf('\r\n') === -1) {
    return false;
  }

  var output = {};
  var lines = string.split('\r\n');
  var status = lines.shift();

  function parseStatusLine (line) {
    var pieces = line.split(' ');
    var versionNumberPieces;
    var versionPieces;

    // Header string pieces
    output.version = pieces.shift();
    output.status = pieces.shift();
    output.responseStatusText = pieces.join(' ');

    // Version major / minor
    versionPieces = output.version.split('/');
    output.httpVersion = versionPieces[1];
    versionNumberPieces = output.httpVersion.split('.');
    output.versionMajor = versionNumberPieces[0];
    output.versionMinor = versionNumberPieces[1];
  }

  function parseHeaderLine (line) {
    var pieces = line.split(': ');
    var name = pieces.shift();
    var value = pieces.join(': ');

    output._headers[name.toLowerCase()] = value;
    output.headers[name] = value;
  }

  // Prepare header object
  output.headers = {};
  output._headers = {};

  // Remove empty strings
  lines = lines.filter(Boolean);

  // Parse status line
  parseStatusLine(status);

  // Parse headers
  for (var i = lines.length; i--;) {
    parseHeaderLine(lines[i]);
  }

  return output;
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
module.exports = function convertRequestToHar (req, res, reqReceived, serviceToken) {
  var resHeadersObject = parseResponseHeaderString(res._header);
  var agentResStartTime = new Date();
  var reqHeaders = objectToArray(req.headers);
  var reqHeaderBuffer = new Buffer(createHeaderStringFromReqObject(req));
  var reqQuery = objectToArray(getQueryObjectFromUrl(req.url));
  var reqReceivedTime = reqReceived.getTime();
  var reqBodySize = req.headers['content-length']
    ? parseFloat(req.headers['content-length'])
    : -1;
  var resHeaders = objectToArray(resHeadersObject.headers || {});
  var resHeaderBuffer = res._header
    ? new Buffer(res._header)
    : -1;
  var resBodySize = resHeadersObject && resHeadersObject._headers['content-length']
    ? parseFloat(resHeadersObject._headers['content-length'])
    : -1;
  var waitTime = agentResStartTime.getTime() - reqReceivedTime;
  var protocol = req.connection.encrypted ? 'https' : 'http';

  return {
    version: 1.2,
    "service-token":serviceToken,
    creator: {
      name: package.name,
      version: package.version
    },
    entries: [{
      serverIPAddress: getServerAddress(),
      startedDateTime: agentResStartTime.toISOString(),
      request: {
        method: req.method,
        url: protocol + '://' + req.headers.host + req.url,
        httpVersion: 'HTTP/' + req.httpVersion,
        queryString: reqQuery,
        headers: reqHeaders,
        headersSize: reqHeaderBuffer.length || -1,
        bodySize: reqBodySize
      },
      response: {
        status: res.statusCode,
        statusText: resHeadersObject ? resHeadersObject.responseStatusText : '',
        httpVersion: resHeadersObject ? resHeadersObject.version : 'HTTP/1.1',
        headers: resHeaders,
        content: {
          size: resBodySize,
          mimeType: resHeadersObject && resHeadersObject.headers
            ? resHeadersObject.headers['content-type']
            : 'text/plain',
        },
        redirectUrl: resHeadersObject && resHeadersObject.headers.location
          ? resHeadersObject.headers.location
          : '',
        headersSize: resHeaderBuffer.length || -1,
        bodySize: resBodySize
      },
      cache: {},
      timings: {
        send: 0, // TODO
        wait: waitTime,
        receive: 0  // TODO
      }
    }]
  };
};
