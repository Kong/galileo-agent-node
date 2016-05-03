'use strict'

var os = require('os')
var ipHeaders = [ // Priority
  'forwarded', // 1
  'x-real-ip', // 2
  'x-forwarded-for', // 3
  'fastly-client-ip', // 4
  'cf-connecting-ip', // 4
  'x-cluster-client-ip', // 5
  'z-forwarded-for', // 5
  'wl-proxy-client-ip', // 5
  'proxy-client-ip' // 5
]

module.exports = {
  /**
   * get server address from network interface
   */
  getServerAddress: function (testOverride) {
    var ret = '127.0.0.1'
    os = testOverride || os
    var interfaces = os.networkInterfaces()

    Object.keys(interfaces).forEach(function (el) {
      interfaces[el].forEach(function (el2) {
        if (!el2.internal && el2.family === 'IPv4') {
          ret = el2.address
        }
      })
    })

    return ret
  },

  getClientAddress: function (req) {
    var address
    ipHeaders.reverse().forEach(function (header) {
      address = req.headers[header] || address
    })
    if (!address) {
      if (req.connection && req.connection.remoteAddress) {
        address = req.connection.remoteAddress
      } else if (req.connection && req.connection.socket && req.connection.socket.remoteAddress) {
        address = req.connection.socket.remoteAddress
      } else if (req.socket && req.socket.remoteAddress) {
        address = req.socket.remoteAddress
      } else {
        address = ''
      }
    }
    if (address && typeof address === 'string' && address.indexOf(',') > -1) {
      address = address.split(',')[0]
    }
    return address
  },

  /**
   * convert header string to assoc array
   */
  parseResponseHeaderString: function (string) {
    if (!string || string === '' || string.indexOf('\r\n') === -1) {
      return {
        version: 'HTTP/1.1',
        statusText: ''
      }
    }

    var lines = string.split('\r\n')
    var status = lines.shift()

    // Remove empty strings
    lines = lines.filter(Boolean)

    // Parse status line
    var output = this.parseStartLine(status)

    // init headers object & array
    output.headersObj = {}
    output.headersArr = []

    // Parse headers
    var header
    for (var i = lines.length; i--;) {
      header = this.parseHeaderLine(lines[i])

      output.headersArr.push(header)
      output.headersObj[header.name] = header.value
    }

    return output
  },

  /**
   * parse status line into an object
   */
  parseStartLine: function (line) {
    var pieces = line.split(' ')

    // Header string pieces
    var output = {
      version: pieces.shift(),
      status: parseFloat(pieces.shift()),
      statusText: pieces.join(' ')
    }

    return output
  },

  /**
   *
   */
  parseHeaderLine: function (line) {
    var pieces = line.split(': ')
    var name = pieces.shift()
    var value = pieces.join(': ')

    return {
      name: name,
      value: value
    }
  },

  /**
   * Transform objects into an array of key value pairs.
   */
  objectToArray: function (obj) {
    // sanity check
    if (!obj || typeof obj !== 'object') {
      return []
    }

    var results = []

    Object.keys(obj).forEach(function (name) {
      // nested values in query string
      if (typeof obj[name] === 'object') {
        obj[name].forEach(function (value) {
          results.push({
            name: name,
            value: value
          })
        })
        return
      }

      results.push({
        name: name,
        value: obj[name]
      })
    })

    return results
  },

  /**
   * uses regex to match a header value
   */
  getHeaderValue: function (headers, key, def) {
    if (headers instanceof Array) {
      var regex = new RegExp(key, 'i')
      for (var i = 0; i < headers.length; i++) {
        if (regex.test(headers[i].name)) {
          return headers[i].value
        }
      }
    }

    return def !== undefined ? def : false
  },

  /**
   * quickly calculates the header size in bytes for a given array of headers
   */
  getReqHeaderSize: function (req) {
    var keys = Object.keys(req.headers)

    var values = keys.map(function (key) {
      return req.headers[key]
    })

    var headers = req.method + req.url + keys.join() + values.join()

    // startline: [method] [url] HTTP/1.1\r\n = 12
    // endline: \r\n = 2
    // every header + \r\n = * 2
    // add 2 for each combined header
    return new Buffer(headers).length + (keys.length * 2) + 2 + 12 + 2
  },
  /*
   * get unique elements of an array
   */
  uniq: function (arr) {
    var hash = {}
    var result = []
    for (var i = 0, l = arr.length; i < l; ++i) {
      if (!hash.hasOwnProperty(arr[i])) {
        hash[arr[i]] = true
        result.push(arr[i])
      }
    }
    return result
  }
}
