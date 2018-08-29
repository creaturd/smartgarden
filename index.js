var SRV_PORT = 8070;
var DB_NAME = ':memory:';

var MQTT_ADDRESS = '127.0.0.1';
var MQTT_PORT = 1883;
var MQTT_CLIENT = 'greenhouse_srv';

var APP_MODULES = [
	'devices/lora/807B85902000021E',
	'devices/lora/807B85902000032D',
	'devices/test'
];
var GPIO_MODULE = 'devices/lora/807B85902000021C';

var GPIO_MAP = {
	light: {port: 17, state: -1},
	pump: {port: 16, state: -1}
};


var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

var sql = require('sqlite3').verbose();
var db = new sql.Database(DB_NAME);
db.serialize(function() {
	db.run("CREATE TABLE temperature (time INT, value INT)");
	db.run("CREATE TABLE humidity (time INT, value INT)");
	db.run("CREATE TABLE luminosity (time INT, value INT)");

	//TODO: remove this
	/*for (i = 0; i < 30; i++) {
		db.run("INSERT INTO temperature VALUES ("+now(-i)+", "+Math.floor(Math.random()*20+10)+")");
		db.run("INSERT INTO humidity VALUES ("+now(-i)+", "+Math.floor(Math.random()*90+10)+")");
		db.run("INSERT INTO luminosity VALUES ("+now(-i)+", "+Math.floor(Math.random()*200+300)+")");
	}	
	*/
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
		var m = JSON.parse(message.toString());
		if (m.data !== undefined) {
			var val = undefined;
			var t = undefined;
			if (m.data.adc2 !== undefined) {
				t = 'humidity';
				val = parseInt(m.data.adc2.toString());
				db.run("INSERT INTO " + t + " VALUES ("+now()+", "+val+")");
			}
			if (m.data.adc3 !== undefined) {
				t = 'temperature';
				val = parseInt(m.data.adc3.toString());
				db.run("INSERT INTO " + t + " VALUES ("+now()+", "+val+")");
			}
			if (m.data.luminocity !== undefined) {
				t = 'luminosity';
				val = parseInt(m.data.luminocity.toString());
				db.run("INSERT INTO " + t + " VALUES ("+now()+", "+val+")");
			}

			if (m.data.gpios !== undefined) {
				for(var cmd in GPIO_MAP) {
					GPIO_MAP[cmd].state = parseInt(m.data.gpios[GPIO_MAP[cmd].port]);
				};
			}
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
			case "latest":
/**/
				db.get("SELECT humidity.value as Hv, humidity.time as Ht, \
					temperature.value as Tv, temperature.time as Tt, \
					luminosity.value as Lv, luminosity.time as Lt FROM humidity \
					LEFT JOIN temperature ON temperature.time = (SELECT max(time) FROM temperature) \
					LEFT JOIN luminosity ON luminosity.time = (SELECT max(time) FROM luminosity) \
					WHERE humidity.time=(SELECT max(time) FROM humidity)", function(err, row) {

					var data = {
						history : {
							temperature : null,				
							humidity : null,
							luminosity : null
						},
						status : GPIO_MAP
					};
					if (row !== undefined) {
						console.log(JSON.stringify(row));
						data.history.temperature = {time : row.Tt, value: row.Tv};				
						data.history.humidity = {time : row.Ht, value: row.Hv};
						data.history.luminosity = {time : row.Lt, value: row.Lv};
						res.json(data);	
					} else {
						console.error('Error:',err);
						res.status(200).json(data);
						return;
					}
				});

				break;
			case "data":
				var mode = '';
				switch (p.mode) {
					case 'temperature': case 'humidity': case 'luminosity': mode = p.mode; break;
					default:
						res.status(404).json({error:404});
						return;
				}
/*
				if (typeof p.days !== 'undefined') {
					var from = parseInt(p.days.toString());
					from = now(-from); //in seconds
				}
*/
				if (typeof p.days !== 'undefined') {
					var limit = parseInt(p.days.toString());
				}

				db.all("SELECT * FROM " + mode + " ORDER BY time DESC" + (limit ? " LIMIT "+limit : ''), function(err, rows) {
					res.json(rows);
				});
				break;
			default:
				res.status(404).json({error:404});
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
			case "light": case "pump":
				if (p.value.toString() == '1' || p.value.toString() == '0') {
					var state = parseInt(p.value);
					var gpio = GPIO_MAP[p.command].port;
					var topic = GPIO_MODULE + '/mosi/gpio';
					var msg = 'set ' + gpio + ' ' + state;
					client.publish(topic, msg);
					GPIO_MAP[p.command].state = state;
					res.status(200).json({result:'OK'});
				} else {
					console.log('Invalid parameter');
					res.status(404).json({error:404});
				}
				break;
			case "auto":
				res.status(200).json({result:'OK'});
				break;
			default:
				res.status(404).json({error:404});
				return;	
		}
	} catch (e) {
		console.log('Wrong command');
	}
}


