// --- UI elements ---
const connectHRBtn = document.getElementById('connectHRBtn');
const connectAccelBtn = document.getElementById('connectAccelBtn');
const connectGyroBtn = document.getElementById('connectGyroBtn');
const startButton = document.getElementById('startBtn');

const mainText = document.getElementById('mainText');
const subText = document.getElementById('subText');

const hrText = document.getElementById('hrText');
const accText = document.getElementById('accText');
const gyroText = document.getElementById('gyroText');

const testNameInput = document.getElementById('testNameInput');

// --- connection and state ---
let connection = null;
let connecting = false;
let buffer = "";
let testRunning = false;

// --- test data ---
let testData = {};
function initData() {
    testData = {
        startTs: '',
        endTs: '',
        heartRate: [],
        accel: [],
        gyro: []
    };
}

// --- parse incoming data from Bangle ---
function parseLine(line) {
    const d = line.split(",");
    if(d[0] === "A") {
        const accel = {
            ms: parseInt(d[1]),
            x: parseInt(d[2]),
            y: parseInt(d[3]),
            z: parseInt(d[4])
        };
        accText.textContent = `ACC: X=${accel.x} Y=${accel.y} Z=${accel.z}`;
        if(testRunning) testData.accel.push(accel);
    } else if(d[0] === "Y") {
        const gyro = {
            ms: parseInt(d[1]),
            x: parseInt(d[2]),
            y: parseInt(d[3]),
            z: parseInt(d[4])
        };
        gyroText.textContent = `GYRO: X=${gyro.x} Y=${gyro.y} Z=${gyro.z}`;
        if(testRunning) testData.gyro.push(gyro);
    } else if(d[0] === "H") {
        const hr = {
            ms: parseInt(d[1]),
            bpm: parseInt(d[2])
        };
        hrText.textContent = `HR: ${hr.bpm} bpm`;
        if(testRunning) testData.heartRate.push(hr);
    }
}

// --- connect to Bangle.js ---
function connectWatch(callback) {
    if(connection) {
        mainText.textContent = "Already connected";
        if(callback) callback();
        return;
    }

    if(connecting) return;

    connecting = true;
    mainText.textContent = "Connecting...";

    Puck.connect(c => {
        connecting = false;

        if(!c) {
            mainText.textContent = "Connection failed";
            return;
        }

        connection = c;
        mainText.textContent = "Connected to Bangle.js";

        connection.on("data", d => {
            buffer += d;
            let lines = buffer.split("\n");
            buffer = lines.pop();
            lines.forEach(parseLine);
        });

        // Reset watch before sending commands
        connection.write("reset();\n", () => {
            setTimeout(() => {
                if(callback) callback();
            }, 1500);
        });
    });
}

// --- start individual sensors ---
function startHRM() {
    if(!connection) {
        connectWatch(startHRM);
        return;
    }

    connection.write(
        "Bangle.setHRMPower(1);\n"+
        "Bangle.on('HRM', hr => Bluetooth.println('H,'+(Date.now())+','+hr.bpm));\n"
    );
    mainText.textContent = "Heart Rate sensor started";
}

function startAccel() {
    if(!connection) {
        connectWatch(startAccel);
        return;
    }

    connection.write(
        "Bangle.on('accel', a => Bluetooth.println('A,'+(Date.now())+','+
        "Math.round(a.x*8192)+','+Math.round(a.y*8192)+','+Math.round(a.z*8192)));\n"
    );
    mainText.textContent = "Accelerometer started";
}

function startGyro() {
    if(!connection) {
        connectWatch(startGyro);
        return;
    }

    connection.write(
        "Bangle.setGyroPower(1);\n"+
        "Bangle.on('gyro', g => Bluetooth.println('Y,'+(Date.now())+','+
        "Math.round(g.x*1000)+','+Math.round(g.y*1000)+','+Math.round(g.z*1000)));\n"
    );
    mainText.textContent = "Gyroscope started";
}

// --- start/stop test ---
function doTest() {
    if(!testRunning) {
        initData();
        testRunning = true;
        testData.startTs = new Date();
        mainText.textContent = "Test running";
        startButton.textContent = "Stop";
    } else {
        testRunning = false;
        testData.endTs = new Date();
        mainText.textContent = "Test finished";
        startButton.textContent = "Start";
        saveFile();
    }
}

// --- save test data as JSON ---
function saveFile() {
    const testName = testNameInput.value || "test";
    const filename = "test_" + testName + "_" + Date.now() + ".json";
    const file = new File([JSON.stringify(testData)], filename, { type: "application/json" });

    if(navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
            title: 'Test results',
            text: 'This file contains a test done on ' + new Date(),
            files: [file]
        }).catch(err => console.error(err));
    } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// --- attach button events ---
connectHRBtn.addEventListener("click", startHRM);
connectAccelBtn.addEventListener("click", startAccel);
connectGyroBtn.addEventListener("click", startGyro);
startButton.addEventListener("click", doTest);

mainText.textContent = "Ready to connect";
