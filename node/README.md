Mashape Analytics Agent (NodeJS, Express 4)
-------------------------------------------

Middleware agent to report requests to a mashape analytics server.

Install
-------

```bash
npm install mashape-analytics-agent
```

Usage
-----

```javascript
var analytics = require('mashape-analytics-agent');
var app = require('express')();

// Middleware to report
app.use(analytics('MASHAPE-ANALYTICS-KEY'));

// Use as normal
app.get('/', function(req, res) {
  
});
```

If you have a specific API endpoint:
```javascript
app.use('/api', analytics('MASHAPE-ANALYTICS-KEY'));
```


