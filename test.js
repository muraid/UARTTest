const startButton = document.getElementById('startBtn');
const mainText = document.getElementById('mainText');
const subText = document.getElementById('subText');
const hrText = document.getElementById('hrText');
const rscText = document.getElementById('rscText');
const cscText = document.getElementById('cscText');
const testNameInput = document.getElementById('testNameInput');

let device, server, uartService, txChar, rxChar;

// UUIDs for BangleJS UART
const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX      = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // Bangle → Web
const UART_RX      = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Web → Bangle

let testRunning = false;
let testData = {};

function initData() {
    testData = {
        startTs: '',
        endTs: '',
        accel: [],
        heartRate: [],
        gps: [],
    }
}

//--------------------------------------------------------------
// CONNECT TO BANGLEJS
//--------------------------------------------------------------
async function connectBangle() {
    device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "Bangle" }],
        optionalServices: [UART_SERVICE]
    });

    server = await device.gatt.connect();
    uartService = await server.getPrimaryService(UART_SERVICE);

    txChar = await uartService.getCharacteristic(UART_TX);
    rxChar = await uartService.getCharacteristic(UART_RX);

    // incoming Bangle data
    await txChar.startNotifications();
    txChar.addEventListener("characteristicvaluechanged", e => {
        let str = new TextDecoder().decode(e.target.value);
        parseIncomingData(str);
    });

    mainText.textContent = "Connected to Bangle!";
}

//--------------------------------------------------------------
// PARSE INCOMING SENSOR STREAM (from BangleJS)
//--------------------------------------------------------------
function parseIncomingData(str) {
    try {
        const json = JSON.parse(str);

        // Accelerometer
        if (json.accel !== undefined) {
            testData.accel.push({
                ts: Date.now(),
                value: json.accel
            });
        }

        // HRM
        if (json.hr !== undefined) {
            hrText.textContent = "HR: " + json.hr + " bpm";
            testData.heartRate.push({
                ts: Date.now(),
                hr: json.hr,
                conf: json.hrConfidence
            });
        }

        // GPS
        if (json.gps !== undefined) {
            testData.gps.push({
                ts: Date.now(),
                ...json.gps
            });
        }

    } catch (err) {
        console.log("RAW:", str);
    }
}

//--------------------------------------------------------------
// SEND COMMAND TO BANGLEJS
//--------------------------------------------------------------
function sendJSON(obj) {
    if (!rxChar) return;
    rxChar.writeValue(new TextEncoder().encode(JSON.stringify(obj) + "\n"));
}

//--------------------------------------------------------------
// START / STOP TEST
//--------------------------------------------------------------
async function doTest() {
    if (!testRunning) {

        if (!device || !device.gatt.connected) {
            await connectBangle();
        }

        // Init data
        initData();
        testData.startTs = new Date();
        testRunning = true;

        // Tell Bangle to start streaming
        sendJSON({
            cmd: "start",
            sensors: ["accel", "hrm", "gps"],
            interval: 500
        });

        mainText.textContent = "Test running...";
        startButton.textContent = "Stop";

    } else {

        // Stop streaming on Bangle
        sendJSON({ cmd: "stop" });

        testRunning = false;
        testData.endTs = new Date();

        mainText.textContent = "Test completed";
        startButton.textContent = "Start";

        // Save file
        const filename = "bangle_test_" + Date.now() + ".json";
        const file = new File([JSON.stringify(testData)], filename, {
            type: "application/json"
        });

        const msg = {
            title: "Test data",
            files: [file]
        };

        if (navigator.canShare(msg)) {
            await navigator.share(msg);
        } else {
            alert("Sharing not supported on this device");
        }
    }
}

//--------------------------------------------------------------
// UI BUTTON
//--------------------------------------------------------------
startButton.addEventListener('click', doTest);
