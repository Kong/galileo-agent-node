# Mashape Analytics Agent (node.js)

Middleware agent to report HTTP traffic to a [Mashape API Analytics](http://apianalytics.com/).

## Installation

```shell
npm install apianalytics
```

## Usage


```js
var analytics = require('apianalytics');

analytics('SERVICE-TOKEN', {
  sendBody: true,
  reqByteLimit: 1e6, // ~ 1MB
  entriesPerHar: 1
})
```

obtain your `SERVICE-TOKEN` by registering for a free trial at [APIAnalytics.com](http://apianalytics.com)

###### Example: Express

```js
var analytics = require('apianalytics');

var app = require('express')();

// api-analytics middleware
app.use(analytics('SERVICE-TOKEN'));
```

If you have a specific API endpoint:

```js
app.use('/api', analytics('SERVICE-TOKEN'));
```

###### Example: Restify

```js
var analytics = require('apianalytics');

var server = require('restify').createServer({
  name: 'myapp',
  version: '1.0.0'
});

// api-analytics middleware
server.use(analytics('SERVICE-TOKEN'));
```

###### Example: NodeJS HTTP Server

``` javascript
var analytics = require('apianalytics');

// initiate
var middleware = analytics('SERVICE-TOKEN');

var server = require('http').createServer(function (req, res) {  
  // api-analytics middleware
  middleware(req, res);

  // Other logic here...
});
```

Custom Options
--------------

These are all optional.

| Name            | Description                               | Default                                                   |
| --------------- | ----------------------------------------- | --------------------------------------------------------- |
| `host`          | **API Analytics** host                    | `"socket.apianalytics.com:80"` **DO NOT CHANGE!**         |
| `logger`        | Customize the logging `function(message)` | Default uses [debug](https://www.npmjs.org/package/debug) |
| `sendBody`      | send Request and Response bodies          | `false`                                                   |
| `reqByteLimit`  | limit the request body capture size       | `1e10`                                                    |
| `entriesPerHar` | num of entries per HAR object sent        | `1`                                                       |
