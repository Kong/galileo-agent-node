'use strict'

var server = require('./server')

module.exports = function (next, done) {
  server(function (req, res) {
    var body = ''

    req.on('data', function (chunk) {
      body += chunk
    })

    req.on('end', function () {
      done(JSON.parse(body))
    })
  }, next)
}
