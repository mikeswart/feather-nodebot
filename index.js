'use strict';

// CHANGE THESE THREE VARIABLES! //
var deviceHost = "192.168.16.186" // This is the IP address shown in Arduino IDE Serial Monitor after uploading Firmata
var deviceID = 'CoverMyBot'; // This is the deviceID you entered in iothub-explorer
var deviceKey = 'H6whsVJA1/K6sx3d/pKmf2TW7rzRjYUt6TfFNYb0kO0='; // This is the primary key returned by iothub-explorer

// Node modules - Don't modify
var moment = require('moment');
var EtherPortClient = require("etherport-client").EtherPortClient;
var Firmata = require("firmata");
var five = require("johnny-five");
var Protocol = require('azure-iot-device-amqp').Amqp;
var Client = require('azure-iot-device').Client;
var Message = require('azure-iot-device').Message;

// Setup - Don't modify
var board = new five.Board({
    io: new Firmata(new EtherPortClient({ host: deviceHost, port: 3030 })), timeout: 60000 });
var connectionString = 'HostName=huzzahbots.azure-devices.net;DeviceId=' + deviceID + ';SharedAccessKey=' + deviceKey + '';
var client = Client.fromConnectionString(connectionString, Protocol);
var currentaction = "offline";
board.on('ready', function () {
    letsPlay();
    var connectCallback = function (err) {
        if (err) { console.error('Your device is not connected to the web dashboard. Could not connect: ' + err.message); } 
        else {
            console.log('Client connected');
            client.on('message', function (msg) {
                currentaction = "home";
                console.log('Id: ' + msg.messageId + ' Body: ' + msg.data);
                client.complete(msg, printResultFor('completed'));
            });
            client.on('error', function (err) {
                currentaction = "offline";
                console.error(err.message);
            });
            client.on('disconnect', function () {
                currentaction = "offline";
                client.removeAllListeners();
                client.open(connectCallback);
            });
        }
    };
    client.open(connectCallback);
});
    function printResultFor(op) {
        return function printResult(err, res) {
            if (err) console.log(op + ' error: ' + err.toString());
            if (res) console.log(op + ' status: ' + res.constructor.name);
        };
    }
function letsPlay(){
    var rightWheel= new five.Motor({ pins: [12, 4], invertPWM: false });
    var leftWheel = new five.Motor({ pins: [14, 5], invertPWM: false });
    var rightWheelRev= new five.Motor({ pins: [0, 16], invertPWM: false });
    var leftWheelRev = new five.Motor({ pins: [15, 13], invertPWM: false });

    var scalar = 256; // Friction coefficient
    var actioncounter = 0;
    var newcommand = "home()";
    var speed = 255;
    leftWheel.rev(0);
    rightWheel.rev(0); 
    leftWheelRev.rev(0);
    rightWheelRev.rev(0); 

    function actionSender(){
        var distance = 0;
        Math.round(actioncounter);
        if (currentaction == "fd" || currentaction == "bk") {
            var a = (moment.now() - actioncounter) * 0.18 * speed / scalar;
            newcommand = "" + currentaction +"(" + a + ")";
            distance = a;
        }
        else if (currentaction == "rt" || currentaction == "lt") {
            var a = (moment.now() - actioncounter) * 0.18 * speed / scalar;
            newcommand = "" + currentaction +"(" + a + ")";
            distance = 0;
        }
        else if (currentaction == "home") {
            newcommand = "home()";
            distance = 0;
        }
        else { 
            newcommand = "fd(0)"; 
            distance = 0;
        };
        distance = distance.toString();
        var data = JSON.stringify({ deviceId: deviceID, command: newcommand, distance: distance });
        var message = new Message(data);
        console.log('Sending message: ' + message.getData());
        client.sendEvent(message, printResultFor('send'));
        actioncounter = moment.now();
    }

////////////////////////////////////////////////////////////////

// Write your Johnny-Five code here!
    

///////////////////////////////////////////////////////////////

    function wheelLeft(forward) {
        if(forward) {
            leftWheelRev.rev(0);
            leftWheel.fwd(0);
        }
        else{
            leftWheel.rev(0);
            leftWheelRev.fwd(0);
        }
    }

    function wheelRight(forward)
    {
        if(forward) {
            rightWheelRev.rev(0);
            rightWheel.fwd(0);
        }
        else{
            rightWheel.rev(0);
            rightWheelRev.fwd(0);
        }
    }
// These functions are for stopping and moving the car with a little workaround specific to the Feather HUZZAH board and Johnny-Five. Leave these as they are.
    function reverse() {
        wheelLeft(false);
        wheelRight(false);

        currentaction = "bk";
        console.log("Reverse!");
    }
    function forward() {
        wheelRight(true);
        wheelLeft(true);

        currentaction = "fd";
        console.log("Forward!");
    }
    function stop() {
        leftWheel.rev(0); // This makes the car stop.
        rightWheel.rev(0); 
        leftWheelRev.rev(0);
        rightWheelRev.rev(0);

        currentaction = "stopped";
        console.log("Stop!");
    }
    function left() {
        wheelRight(true);

        setTimeout(function () {
            stop();
        }, 500);

        currentaction = "lt";
        console.log("Left!");
    }
    function right() {
        wheelLeft(true);

        currentaction = "rt";
        console.log("Right!");

        setTimeout(function () {
            stop();
        }, 500);

    }
    function exit() {
        currentaction = "offline";
        setTimeout(process.exit, 1000);
    }

// This is the code for controlling car actions from the command line
    var keyMap = {
        'up': forward,
        'left': left,
        'right': right,
        'space': stop,
        'down': reverse,
        'q': exit
    };

    var stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("keypress", function (chunk, key) {
        if (!key || !keyMap[key.name]) return;
        actionSender();
        keyMap[key.name]();
    });
}
