module.exports = {
  getServerAddress: function () {
    var os = require('os');
    // Server interface list
    var networkInterfaces = os.networkInterfaces();

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
  },

  parseResponseHeaderString: function (string) {
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

      output.headers[name] = value;
    }

    // Prepare header object
    output.headers = {};

    // Remove empty strings
    lines = lines.filter(Boolean);

    // Parse status line
    parseStatusLine(status);

    // Parse headers
    for (var i = lines.length; i--;) {
      parseHeaderLine(lines[i]);
    }

    return output;
  },

  /**
   * Transform objects into an array of key value pairs.
   */
  objectToArray: function (obj) {
    var results = [];
    var names = Object.keys(obj);

    while (name = names.pop() ) {
      results.push({
        name: name,
        value: obj[name]
      });
    }

    return results;
  },

  /**
   * uses the Content-Length header for body size
   *
   * TODO fall back to manual measurement when Content-Length is not available
   */
  getBodySize: function (obj, headers) {
    if (headers && !!headers['content-length']) {
      return parseInt(headers['content-length'])
    } else {
      return -1;
    }
  },

  getHeaderSize: function (req) {
    var keys = Object.keys(req.headers);

    var values = keys.map(function(key) {
      return req.headers[key];
    });

    return new Buffer(
      req.method + req.url + req.versionMajor + req.versionMinor + keys.join() + values.join()
    ).length + (keys.length * 2) + 14;
  }
};
