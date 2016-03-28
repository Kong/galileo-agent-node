# Galileo Node Agent

Collect and send request records to Galileo for aggregation / logging

> for more information on Galileo, please visit [getgalileo.io](https://getgalileo.io)

## Installation

``` sh
npm install galileo-agent --save
```

## Usage

``` js
var express = require('express')
var galileo = require('galileo-agent')

var app = express()
var agent = galileo('SERVICE_TOKEN')

app.use(agent)

app.get('/api', function (req, res) {
  res.send('Hello World!')
})

app.listen()
```

## API

```js
var galileo = require('galileo-agent')
```

### galileo(serviceToken[, environment[, options]])

- **serviceToken**: `String` *(a Galileo Service Token)*
- **environment**: `String` *(a Galileo Environment Slug)*
- **options**: `Object` *(Agent Configuration [Options](#options))*

```js
galileo('SERVICE_TOKEN', 'PRODUCTION', {
  logBody: false,
  limits: {
    bodySize: 0
  },
  queue: {
    entries: 100
  },
  collector: {
    host: 'collector.galileo.mashape.com',
    port: 443,
    path: '/1.1.0/single',
    ssl: true
  }
})
```

### Options

| Name                 | Description                                                                | Default |
| -------------------- | -------------------------------------------------------------------------- | ------- |
| `logBody`            | send body of request/response with ALF record                              | `false` |
| `queue.entries`      | num of entries per [ALF](https://github.com/Mashape/api-log-format) object | `100`   |
| `limits.bodysize`    | limit captured *request & response* body size in bytes                     | `1000`  |
| `collector.host`     | specify the collector hostname to which you send your data                 | `'collector.galileo.mashape.com'`     |
| `collector.port`     | specify the port of the collector server                                   | `443`     |
| `collector.path`     | specify the versioning path of the collector server                        | `'/1.1.0/single'`     |
| `collector.ssl`      | specify if the collector server has ssl enabled                            | `true`     |

## Examples

- [HTTP](https://github.com/Mashape/galileo-agent-node/blob/master/examples/http.js)
- [Express.js](https://github.com/Mashape/galileo-agent-node/blob/master/examples/express.js)
- [Restify](https://github.com/Mashape/galileo-agent-node/blob/master/examples/restify.js)

## Copyright and license

Copyright Mashape Inc, 2016.

Licensed under [the MIT License](https://github.com/Mashape/galileo-agent-node/blob/master/LICENSE)
