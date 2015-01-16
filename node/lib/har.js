// Requires
var util = require('util');
var url = require('url');
var os = require('os');
var pkg = require('../package.json');

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

/**
 * Transform objects into an array of key value pairs.
 */
function objectToArray (obj) {
  var results = [];
  var names = Object.keys(obj);

  while (name = names.pop() ) {
    results.push({
      name: name,
      value: obj[name]
    });
  }

  return results;
}

/**
 * uses the Content-Length header for body size
 *
 * TODO fall back to manual measurement when Content-Length is not available
 */
function getBodySize (obj, headers) {
  if (headers && !!headers['content-length']) {
    return parseInt(headers['content-length'])
  } else {
    return -1;
  }
}

function getHeaderSize (req) {
  var keys = Object.keys(req.headers);

  var values = keys.map(function(key) {
    return req.headers[key];
  });

  return new Buffer(
    req.method + req.url + req.versionMajor + req.versionMinor + keys.join() + values.join()
  ).length + (keys.length * 2) + 14;
}

/**
 * Convert http request and responses to HAR
 */
module.exports = function convertRequestToHar (req, res, reqReceived, serviceToken) {
  var resHeaders = parseResponseHeaderString(res._header);
  var agentResStartTime = new Date();
  var reqHeaders = objectToArray(req.headers);
  var reqQuery = objectToArray(url.parse(req.url, true).query);

  console.log(JSON.stringify(req.headers, null, 2));

  var resHeaderSize = res._header ? new Buffer(res._header).length : -1;
  var resBodySize = getBodySize(res, resHeaders);
  var waitTime = agentResStartTime.getTime() - reqReceived.getTime();
  var protocol = req.connection.encrypted ? 'https' : 'http';

  return {
    version: '1.2',
    serviceToken: serviceToken,
    creator: {
      name: pkg.name,
      version: pkg.version
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
        headersSize: getHeaderSize(req),
        bodySize: getBodySize(req, req.headers)
      },
      response: {
        status: res.statusCode,
        statusText: resHeaders ? resHeaders.responseStatusText : '',
        httpVersion: resHeaders ? resHeaders.version : 'HTTP/1.1',
        headers: objectToArray(resHeaders.headers || {}),
        content: {
          // TODO measure before compression
          size: resBodySize,
          mimeType: resHeaders && resHeaders.headers
            ? resHeaders.headers['content-type']
            : 'application/octet-stream',
        },
        redirectUrl: resHeaders && resHeaders.headers.location
          ? resHeaders.headers.location
          : '',
        headersSize: resHeaderSize,
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
