# API Analytics Node.js Agent

You can use this agent to intregrate API Analytics with node.js powered APIs. We have created [working examples](https://github.com/mashape/analytics-node-agent/tree/master/examples) of using it with standard HTTP, Express and Restify servers.

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

### Options

| Name              | Description                                             | Default |
| ----------------- | ------------------------------------------------------- | ------- |
| `queue.entries`   | num of entries per ALF object sent                      | `100`   |
| `limits.bodysize` | limit captured *request & response* body size in bytes  | `0`     |
