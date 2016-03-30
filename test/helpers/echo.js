'use strict'

var server = require('./server')

module.exports = function (next, done) {
  server(function (req, res) {
    var body = ''

    req.on('data', function (chunk) {
      body += chunk
    })

    req.on('error', function (err) {
      console.log('error thrown on req', err)
    })
    req.on('end', function () {
      console.log('collector server got request!', body)
      try {
        body = JSON.parse(body)
      } catch(e) {
        console.log('an error occurred while parsing body', body)
      }
      done(body)
    })
  }, next)
}
