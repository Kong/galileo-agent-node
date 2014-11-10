Mashape Analytics Agent (node.js)
-------------------------------------------

Middleware agent to report requests to a mashape analytics server.

Install
-------

```bash
npm install mashape-analytics-agent
```

Usage with Express
------------------

```javascript
var analytics = require('mashape-analytics-agent');
var app = require('express')();

// Middleware to report all calls
app.use(analytics('MASHAPE-ANALYTICS-KEY'));
```

If you have a specific API endpoint:
```javascript
app.use('/api', analytics('MASHAPE-ANALYTICS-KEY'));
```

Usage with Restify
------------------

```javascript
var analytics = require('mashape-analytics-agent');
var server = require('restify').createServer({
  name: 'myapp',
  version: '1.0.0'
});

// Middleware to report all calls
server.use(analytics('MASHAPE-ANALYTICS-KEY'));
```

Usage with HTTP Server
----------------------

``` javascript
var analytics = require('mashape-analytics-agent')('MASHAPE-ANALYTICS-KEY');
var server = require('http').createServer(function (req, res) {
    
    analytics(req, res);

    // Other logic here...
    
});
```

It may be easier to use
