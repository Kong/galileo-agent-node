'use strict'

var restify = require('restify')
var galileo = require('galileo-agent')

var server = restify.createServer()

server.use(galileo('SERVICE_TOKEN'))

server.get('/api', function (req, res, next) {
  res.send('Hello World!')
  next()
})

server.listen()
