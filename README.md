# Mashape Analytics Node Agent

> for more information on Mashape Analytics, please visit [apianalytics.com](https://www.apianalytics.com)

## Installation

``` sh
npm install mashape-analytics --save
```

## Usage

``` js
var express = require('express')
var analytics = require('mashape-analytics')

var app = express()
var agent = analytics('SERVICE_TOKEN')

app.use(agent)

app.get('/api', function (req, res) {
  res.send('Hello World!')
})

app.listen()
```

## API

```js
var analytics = require('mashape-analytics')
```

### analytics(serviceToken[, environment[, options]])

- **serviceToken**: `String` *(a Mashape Analytics Service Token)*
- **environment**: `String` *(a Mashape Analytics Environment Slug)*
- **options**: `Object` *(Agent Configuration [Options](#options))*

```js
analytics('SERVICE_TOKEN', 'PRODUCTION', {
  limits: {
    bodySize: 0
  },
  queue: {
    entries: 100
  }
})
```

### Options

| Name              | Description                                                                | Default |
| ----------------- | -------------------------------------------------------------------------- | ------- |
| `queue.entries`   | num of entries per [ALF](https://github.com/Mashape/api-log-format) object | `100`   |
| `limits.bodysize` | limit captured *request & response* body size in bytes                     | `0`     |

## Examples

- [HTTP](https://github.com/Mashape/analytics-agent-node/blob/master/examples/http.js)
- [Express.js](https://github.com/Mashape/analytics-agent-node/blob/master/examples/express.js)
- [Restify](https://github.com/Mashape/analytics-agent-node/blob/master/examples/restify.js)

## Copyright and license

Copyright Mashape Inc, 2015.

Licensed under [the MIT License](https://github.com/Mashape/analytics-agent-node/blob/master/LICENSE)
