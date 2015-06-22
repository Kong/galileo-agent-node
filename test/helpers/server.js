'use strict'

var http = require('http')

module.exports = function (app, done) {
  var server = http.createServer(app)

  server.listen(function () {
    done(server.address().port, server)
  })
}
