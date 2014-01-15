"use strict";

var resolver = require("resolver"),
    crypto = require("crypto"),
    redis = require("redis");

module.exports.createResolver = function(config){
    var resolver = new Resolver(config);
    return resolver;
};

function Resolver(config){
    config = config || {};
    this.redisClient = redis.createClient(config.redis.port, config.redis.host);
    this.db = config.redis.db;
    this.userAgent = config.userAgent || "Resolver";
    this.cacheTTL = config.cacheTTL || 30 * 24 * 3600;
    this.debug = config.debug;
}

Resolver.prototype.close = function(){
    this.redisClient.end();
};

Resolver.prototype.resolve = function(url, callback){
    this.resolveRedis(url, (function(err, resolvedUrl){
        if(err){
            if(this.debug){
                console.log("Redis error for %s", url);
                console.log(err);
            }
        }

        if(resolvedUrl){
            return callback(null, resolvedUrl, true);
        }

        this.resolveUrl(url, (function(err, resolvedUrl){
            if(err){
                if(this.debug){
                    console.log("Resolver error for %s", url);
                    console.log(err);
                    console.log(err.stack);
                }
            }
            return callback(null, resolvedUrl || false, false);
        }).bind(this));
    }).bind(this));
};

Resolver.prototype.resolveRedis = function(url, callback){
    var key = "l~" + crypto.createHash("md5").update(url).digest("hex");
    this.redisClient.multi().
        select(this.db).
        get(key).
        expire(key, this.cacheTTL).
        exec((function(err, replies){
            if(err){
                return callback(err);
            }
            return callback(null, replies && replies[1] || false);
        }).bind(this));
};

Resolver.prototype.resolveUrl = function(url, callback){
    resolver.resolve(url, {
      removeParams: [/^utm_/, "ref", "rsscount"],
      userAgent: this.userAgent
    },  (function(err, resolvedUrl){
        if(err){
            return callback(err);
        }

        if(!resolvedUrl){
            return callback(null, false);
        }

        var key = crypto.createHash("md5").update(url).digest("hex");
        this.redisClient.multi().
            select(this.db).
            set("l~" + key, resolvedUrl).
            expire("l~" + key, this.cacheTTL).
            exec((function(){
                return callback(null, resolvedUrl);
            }).bind(this));
    }).bind(this));
};
