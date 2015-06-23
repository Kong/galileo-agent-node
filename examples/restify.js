'use strict'

var restify = require('restify')
var analytics = require('mashape-analytics')

var server = restify.createServer()

server.use(analytics('SERVICE_TOKEN'))

server.get('/api', function (req, res, next) {
  res.send('Hello World!')
  next()
})

server.listen()
