'use strict'

var express = require('express')
var galileo = require('galileo-agent')

var app = express()

app.use(galileo('SERVICE_TOKEN'))

app.get('/api', function (req, res) {
  res.send('Hello World!')
})

app.listen()
