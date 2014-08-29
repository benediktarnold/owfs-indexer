#! /usr/bin/env node

var Client = require("owfs").Client,
	argv = require('minimist')(process.argv.slice(2)),
	async = require('async'),
	timers = require("timers"),
	elasticsearch = require('elasticsearch'),
	logger = require("winston");

logger.cli();

if(argv.debug){
	logger.remove(logger.transports.Console);
	logger.add(logger.transports.Console, { level: 'debug', colorize:true });
}

var HOST = argv.host ? argv.host : 'localhost';
var PORT = argv.port ? argv.port : 4304;
var ESHOST = argv.searchhost ? argv.searchhost : 'localhost:9200';
logger.info("Connecting to " + HOST + ":" + PORT);

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
		logger.error('elasticsearch cluster is down!');
	} else {
		logger.info('Connected to', ESHOST);
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

logger.info("Detecting devices...");

con.getslash("/", function(error,devices) {
	logger.info("Found:",devices.join(", "));
	indexDevices(devices);
});

function indexDevices(devices) {
	timers.setInterval(function() {
		//TODO other devices
		var path = devices[0];
		con.getslash(path, function(error,sensors) {
			sensors = sensors.filter(function(sensor){return sensor.indexOf("errata") == -1});
			async.map(sensors, function(sensor, done) {
				logger.debug("reading", sensor)
				con.read(sensor, function(error,data) {
					var name = sensor.split("/")[2];

					done(error, {
						key: name,
						value: data
					});
				});
			}, function(err, all) {
				if (err) {
					logger.error("ERROR", err);
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
							logger.error(error, response);
						} else {
							logger.info("written to elasticsearch",doc);
						}

					});
				}

			})
		});
	}, 5000);

}