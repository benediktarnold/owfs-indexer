This is a quick and dirty written owfs to elasticsearch indexer.

Installation
============
	npm install -g owfs-indexer
	
Arguments
=========
* host		The host running owserver
* port 		The port running owserver
* searchhost	Your elasticsearch host and port

Usage
========
	owfs-indexer --host=raspberrypi --searchhost=logs.vagrant.dev:9200
