"use strict";

var redis = require("redis"),
    createResolver = require("../index").createResolver,
    http = require("http"),
    urllib = require("url");

var REDIS_HOST = "localhost";
var REDIS_PORT = false;
var REDIS_DB = 11;

var HTTP_PORT = 1367;

module.exports = {
    setUp: function(next){

        var redisClient = this.redisClient = redis.createClient(REDIS_PORT, REDIS_HOST);

        this.server = http.createServer(function (req, res) {
            var url = urllib.parse(req.url, true, true),
                headers;

            if(url.pathname.match(/^\/direct/)){
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end('Hello World\n');
            }else if(url.pathname == "/status"){
                headers = {'Content-Type': 'text/plain'};
                if(url.query.location){
                    headers.location = url.query.location;
                }
                res.writeHead(url.query.status, headers);
                res.end(url.query.message);
            }else if(url.pathname == "/ua"){
                headers = {
                    'Content-Type': 'text/plain',
                    location: "http://127.0.0.1:" + HTTP_PORT + "/direct/ua?ua=" + encodeURIComponent(req.headers["user-agent"])
                };

                res.writeHead(301, headers);
                res.end();
            }else{
                res.writeHead(404, {'Content-Type': 'text/plain'});
                res.end("Not found");
            }
        });

        this.server.listen(HTTP_PORT, function(){
            redisClient.multi().
                select(REDIS_DB).
                flushdb().
                exec(next);
        });
    },
    tearDown: function(next){
        var redisClient = this.redisClient;
        this.server.close(function(){
            redisClient.multi().
                select(REDIS_DB).
                flushdb().
                exec(function(){
                    redisClient.end();
                    next();
                });
        });
    },
    "Exact match": function(test){
        var resolver = createResolver({
            redis: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                db: REDIS_DB
            },
            userAgent: "testResolver"
        }),

        url = "http://127.0.0.1:" + HTTP_PORT+ "/direct?aaaa",
        expected = url;

        resolver.resolve(url, function(err, resolved, cached){
            test.ifError(err);
            test.equal(resolved, expected);
            test.ok(!cached);
            resolver.resolve(url, function(err, resolved, cached){
                test.ifError(err);
                test.equal(resolved, expected);
                test.ok(cached);
                resolver.close();
                test.done();
            });
        });
    },

    "301": function(test){
        var resolver = createResolver({
            redis: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                db: REDIS_DB
            },
            userAgent: "testResolver"
        }),

        expected = "http://127.0.0.1:" + HTTP_PORT+ "/direct/302",
        url = "http://127.0.0.1:" + HTTP_PORT+ "/status?status=301&location="+encodeURIComponent(expected);

        resolver.resolve(url, function(err, resolved, cached){
            test.ifError(err);
            test.equal(resolved, expected);
            test.ok(!cached);
            resolver.resolve(url, function(err, resolved, cached){
                test.ifError(err);
                test.equal(resolved, expected);
                test.ok(cached);
                resolver.close();
                test.done();
            });
        });
    },

    "User-Agent": function(test){
        var userAgent = "mytest",
            resolver = createResolver({
                redis: {
                    host: REDIS_HOST,
                    port: REDIS_PORT,
                    db: REDIS_DB
                },
                userAgent: userAgent
            }),

        expected = "http://127.0.0.1:" + HTTP_PORT+ "/direct/ua?ua=" + encodeURIComponent(userAgent),
        url = "http://127.0.0.1:" + HTTP_PORT+ "/ua";

        resolver.resolve(url, function(err, resolved, cached){
            test.ifError(err);
            test.equal(resolved, expected);
            test.ok(!cached);
            resolver.resolve(url, function(err, resolved, cached){
                test.ifError(err);
                test.equal(resolved, expected);
                test.ok(cached);
                resolver.close();
                test.done();
            });
        });
    },

    "404": function(test){
        var resolver = createResolver({
            redis: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                db: REDIS_DB
            },
            userAgent: "testResolver"
        }),

        url = "http://127.0.0.1:" + HTTP_PORT+ "/404";

        resolver.resolve(url, function(err, resolved, cached){
            test.ifError(err);
            test.ok(!resolved);
            test.ok(!cached);
            resolver.resolve(url, function(err, resolved, cached){
                test.ifError(err);
                test.ok(!resolved);
                test.ok(!cached);
                resolver.close();
                test.done();
            });
        });
    },

    "non-resolving": function(test){
        var resolver = createResolver({
            redis: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                db: REDIS_DB
            },
            userAgent: "testResolver"
        }),

        url = "http://non-exitant-server/";

        resolver.resolve(url, function(err, resolved, cached){
            test.ifError(err);
            test.ok(!resolved);
            test.ok(!cached);
            resolver.resolve(url, function(err, resolved, cached){
                test.ifError(err);
                test.ok(!resolved);
                test.ok(!cached);
                resolver.close();
                test.done();
            });
        });
    },

    "Set Expire TTL": function(test){
        var resolver = createResolver({
            redis: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                db: REDIS_DB
            },
            userAgent: "testResolver",
            cacheTTL: 2
        }),

        url = "http://127.0.0.1:" + HTTP_PORT+ "/direct?aaaa",
        expected = url;

        resolver.resolve(url, function(err, resolved, cached){
            test.ifError(err);
            test.equal(resolved, expected);
            test.ok(!cached);
            setTimeout(function(){
                resolver.resolve(url, function(err, resolved, cached){
                    test.ifError(err);
                    test.equal(resolved, expected);
                    test.ok(cached);
                    setTimeout(function(){
                        resolver.resolve(url, function(err, resolved, cached){
                            test.ifError(err);
                            test.equal(resolved, expected);
                            test.ok(!cached);
                            resolver.close();
                            test.done();
                        });
                    }, 3000);

                });
            }, 1000);
        });
    },
    "Remove unneeded query params": function(test){
        var resolver = createResolver({
            redis: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                db: REDIS_DB
            },
            userAgent: "testResolver"
        }),

        url = "http://127.0.0.1:" + HTTP_PORT+ "/direct?utm_test?=1&yep=2&rsscount=4",
        expected = "http://127.0.0.1:" + HTTP_PORT+ "/direct?yep=2";

        resolver.resolve(url, function(err, resolved, cached){
            test.ifError(err);
            test.equal(resolved, expected);
            test.ok(!cached);
            resolver.resolve(url, function(err, resolved, cached){
                test.ifError(err);
                test.equal(resolved, expected);
                test.ok(cached);
                resolver.close();
                test.done();
            });
        });
    }
};
