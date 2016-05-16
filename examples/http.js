'use strict'

var http = require('http')

var galileo = require('galileo-agent')
var agent = galileo('SERVICE_TOKEN')

var server = http.createServer(function (req, res) {
  agent(req, res)
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello World!')
})

server.listen()
