var PROTOCOL = 'lora';

var MQTT_ADDRESS = '192.168.1.85';
var MQTT_PORT = 1883;
var MQTT_CLIENT = 'smartgarden_emul';

var EUI_ADC = "807B85902000021E";
var EUI_LIT = "807B85902000032D";

var EUI_me = "807B85902000021C";

var TIMER_INTERVAL = 10000;

var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://'+MQTT_ADDRESS+':'+MQTT_PORT, MQTT_CLIENT);
client.on('connect', onConnected);
client.on('message', onMessageReceived);

var GPIO = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];



function onMessageReceived(topic, message) {
	var t = topic.toString();
	var m = message.toString();
	console.log(' > ', t, m);

	if (t != "devices/"+PROTOCOL+"/"+EUI_me+"/mosi/gpio") return;

	if (m == "get all") {
		var data_GPIO = {
			data : {
				gpios: GPIO
			},
			status : {
				devEUI : EUI_me,
				rssi: -16,
				temperature : 28,
				battery : 3300
			}
		};
		client.publish("devices/"+PROTOCOL+"/"+EUI_me+"/miso", JSON.stringify(data_GPIO));
	}
		
}
function onConnected() {
	setInterval(sendData, TIMER_INTERVAL);
	client.subscribe("devices/"+PROTOCOL+"/"+EUI_me+"/#");
}

function sendData() {
	var data_ADC = {
		data : {
			adc2 : Math.floor(Math.random()*90+10),
			adc3 : Math.floor(Math.random()*20+10)
		},
		status : {
			devEUI : EUI_ADC,
			rssi: -16,
			temperature : 30,
			battery : 3300
		}
	};
	var data_LIT = {
		data : {
			luminocity: Math.floor(Math.random()*1000+50)
		},
		status : {
			devEUI : EUI_LIT,
			rssi: -16,
			temperature : 28,
			battery : 3300
		}
	};
	var mADC = JSON.stringify(data_ADC);
	var mLIT = JSON.stringify(data_LIT);
	console.log('Sending: ' + mADC + '; ' + mLIT)
	client.publish("devices/"+PROTOCOL+"/"+EUI_ADC+"/miso/adc", mADC);
	client.publish("devices/"+PROTOCOL+"/"+EUI_LIT+"/miso/opt3001", mLIT);
}






