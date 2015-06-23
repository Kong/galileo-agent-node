'use strict'

var express = require('express')
var analytics = require('mashape-analytics')

var app = express()

app.use(analytics('SERVICE_TOKEN'))

app.get('/api', function (req, res) {
  res.send('Hello World!')
})

app.listen()
