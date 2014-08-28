#! /usr/bin/env node

var Client = require("owfs").Client,
	argv = require('optimist').argv,
	async = require('async'),
	timers = require("timers"),
	elasticsearch = require('elasticsearch');


var HOST = argv.host ? argv.host : 'localhost';
var PORT = argv.port ? argv.port : 4304;
var ESHOST = argv.searchhost ? argv.searchhost : 'localhost:9200';
console.log("Connecting to " + HOST + ":" + PORT);

var con = new Client(HOST, PORT);
var es = new elasticsearch.Client({
	host: ESHOST,
	//log: 'trace'
});

es.ping({
	requestTimeout: 1000,
	// undocumented params are appended to the query string
	hello: "elasticsearch!"
}, function(error) {
	if (error) {
		console.error('elasticsearch cluster is down!');
	} else {
		console.log('Connected to', ESHOST);
	}
});

es.indices.exists({
	index: "temperature"
}, function(err, exists, status) {
	if (!exists) {
		es.indices.create({
			index: "temperature",
			body: {
				mappings: {
					_default_: {
						_timestamp: {
							enabled: true,
							store: true
						},
						properties: {
							temperature: {
								type: "float"
							}
						}
					}
				}
			}
		})
	}
});

console.log("Detecting devices...");

con.getslash("/", function(devices) {
	console.log("Found:",devices.join(", "));
	indexDevices(devices);
});

function indexDevices(devices) {
	timers.setInterval(function() {
		//TODO other devices
		var path = devices[0];
		con.getslash(path, function(sensors) {
			async.map(sensors, function(sensor, done) {
				//console.log("reading", sensor)
				con.read(sensor, function(data) {
					var name = sensor.split("/")[2];

					done(null, {
						key: name,
						value: data
					});
				});
			}, function(err, all) {
				if (err) {
					console.error("ERROR", err);
				} else {
					var doc = {
						path: path,
						_timestamp: new Date().toISOString()
					};
					all.forEach(function(kv) {
						doc[kv.key] = kv.value;
					});
					es.create({
						index: 'temperature',
						type: doc.type,
						body: doc
					}, function(error, response) {
						if (error) {
							console.log(error, response);
						}

					});
				}

			})
		});
	}, 5000);

}