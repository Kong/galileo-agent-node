## Mashape Analytics

> for more information on Mashape Analytics, please visit [analytics.mashape.com](https://analytics.mashape.com)

## Installation

``` shell
npm install mashape-analytics --save
```

## Usage

``` js
var http = require('http');

var analytics = require('mashape-analytics')
var agent = analytics('SERVICE_TOKEN', 'ENVIRONMENT_NAME', {
  limits: {
    bodySize: 1e10
  },
  queue: {
    entries: 10
  }
})

var server = http.createServer(function (req, res) {
  agent(req, res)

  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello World!')
})

server.listen(3000)
```

### Examples
You can use this agent to intregrate Mashape Analytics with Node.js powered APIs & Microservices. We have created a [working examples](https://github.com/Mashape/analytics-agent-node/tree/master/examples) of using it with standard HTTP, Express and Restify servers.


### Options

| Name              | Description                                             | Default |
| ----------------- | ------------------------------------------------------- | ------- |
| `queue.entries`   | num of entries per ALF object sent                      | `100`   |
| `limits.bodysize` | limit captured *request & response* body size in bytes  | `0`     |
