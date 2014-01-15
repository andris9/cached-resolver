# resolve

Resolve URLs and cache results to Redis

## Usage

```javascript
var createResolver = require("./resolver").createResolver;

var resolver = createResolver(options);

resolver.resolve(url, function(err, resolved, cached){});
```

Where 

**options** include the following properties

  * **redis** is an object `{host:, port:, db:}`
  * **cacheTTL** is the time resolved URLs will be stored
  * **userAgent** is the User Agent header value for retrieving urls

**resolved** is the resolved URL or false if not found

**cached** is `true` if the data was loaded from db

## License

**MIT**