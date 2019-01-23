var PROTOCOL = 'lora';
var SRV_PORT = 8070;
//var DB_NAME = ':memory:'; // memory database
var DB_NAME = 'smartgarden.db';

var MQTT_ADDRESS = '192.168.1.85';
var MQTT_PORT = 1883;
var MQTT_CLIENT = 'smartgarden_server'; // Client name must be unique in space of the MQTT broker

var APP_MODULES = [
	'devices/'+PROTOCOL+'/807B859020000100'
];
var GPIO_MODULE = 'devices/'+PROTOCOL+'/807B859020000100'; // executive module, not has to be the same as one of APP_MODULES

var GPIO_MAP = {
	light: {port: 17, state: -1},
	pump: {port: 16, state: -1},
	auto: {port: -1, state: 0}
}; 


var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

var sql = require('sqlite3').verbose();
var db = new sql.Database(DB_NAME);
db.serialize(function() {
	db.run("CREATE TABLE IF NOT EXISTS temperature (time INT, value INT)");
	db.run("CREATE TABLE IF NOT EXISTS humidity (time INT, value INT)");
	db.run("CREATE TABLE IF NOT EXISTS luminosity (time INT, value INT)");
});

var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://'+MQTT_ADDRESS+':'+MQTT_PORT, MQTT_CLIENT);
client.on('connect', onConnected);
client.on('message', onMessageReceived);



var app = express();

app.use(express.static('garden'));
app.get('/', express.static('garden'));
app.get('/get/:value', get);
app.get('/get/:value/:mode', get);
app.get('/get/:value/:mode/:days', get);
app.get('/cmd/:command/:value', cmd);
app.listen(SRV_PORT);



function subscribeModule(topic) {
	client.subscribe(topic + '/miso/#');
}

function onMessageReceived(topic, message) {
	//console.log('> onMessageReceived: ' + message);
	try {
		var m = message.toString().replace(/([\d]),([\s]*\])/g, '$1$2');
		m = JSON.parse(m);
		if (m.data !== undefined) {
			/*
			 * Implement received data parsing for different sensors here.
			 * Save parsed values in database. Example DB query: INSERT INTO <table> VALUES (<time>, <value>)
			 * Use sensor_emul.js to get possible data object properties.
			 */
			
		} else {
			console.log('No data found: ' + m.toString());
		}
	} catch (e) {
		console.log('Invalid JSON: ' + message + e);
	}
	
}
function onConnected() {
	subscribeModule(GPIO_MODULE);
	APP_MODULES.forEach(subscribeModule);

	var topic = GPIO_MODULE + '/mosi/gpio';
	var msg = 'get all';
	client.publish(topic, msg.toString());
}



// Function to get current datetime in format of UNIX timestamp.
// If dayshift is defined, corresponding correction is applied
function now(dayshift) {
	var days = Math.floor(Date.now()/1000);
	if (typeof dayshift === "number" || typeof dayshift === 'string') {
		days += parseInt(dayshift)*86400;
	}
	return days;
}

function index(req, res) {
	res.send('INDEX');
}

function get(req, res) {
	var p = req.params;

	try {
		switch (p.value) {
			/*
			 * Implement request parsing depending on p.value. Use following SQL query to retreive all stored data from DB:
			  		SELECT humidity.value as Hv, humidity.time as Ht, 
					temperature.value as Tv, temperature.time as Tt, 
					luminosity.value as Lv, luminosity.time as Lt FROM humidity 
					LEFT JOIN temperature ON temperature.time = (SELECT max(time) FROM temperature) 
					LEFT JOIN luminosity ON luminosity.time = (SELECT max(time) FROM luminosity) 
					WHERE humidity.time=(SELECT max(time) FROM humidity)
			 * or following one to get data for exact sensor:
					SELECT * FROM <table> ORDER BY time DESC LIMIT <limit>
			 */
			// case <value>:
			default:
				res.status(200).json(data);
				//res.status(404).json({error:404});
				return;	
		}
	} catch (e) {
		console.log('Invalid parameter');
	}
}

function cmd(req, res) {
	var p = req.params;

	try {
		switch (p.command) {
			/*
			 * Implement command execution depending on p.command. It can be commands to switch light, pump and auto-regulation mode on/off.
			 * Use GPIO_MODULE + '/mosi/gpio' topic change GPIO pin state.
			 */
			// case <value>:
			default:
				res.status(404).json({error:404});
				return;	
		}
	} catch (e) {
		console.log('Wrong command');
	}
}


