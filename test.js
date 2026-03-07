// --- UI elements ---
const connectBtn = document.getElementById('connectHRBtn'); // enda anslutningsknappen
const startButton = document.getElementById('startBtn');

const mainText = document.getElementById('mainText');
const testNameInput = document.getElementById('testNameInput');

// --- connection and state ---
let connection = null;
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
        if(testRunning) testData.accel.push(accel);
    } else if(d[0] === "Y") {
        const gyro = {
            ms: parseInt(d[1]),
            x: parseInt(d[2]),
            y: parseInt(d[3]),
            z: parseInt(d[4])
        };
        if(testRunning) testData.gyro.push(gyro);
    } else if(d[0] === "H") {
        const hr = {
            ms: parseInt(d[1]),
            bpm: parseInt(d[2])
        };
        if(testRunning) testData.heartRate.push(hr);
    }
}

// --- start all sensors ---
function startSensors() {
    if(!connection) return;

    // Accelerometer
    connection.write("Bangle.on('accel', a => Bluetooth.println('A,'+(Date.now())+','+Math.round(a.x*8192)+','+Math.round(a.y*8192)+','+Math.round(a.z*8192)));\n");

    // Gyroscope
    connection.write("Bangle.setGyroPower(1);\nBangle.on('gyro', g => Bluetooth.println('Y,'+(Date.now())+','+Math.round(g.x*1000)+','+Math.round(g.y*1000)+','+Math.round(g.z*1000)));\n");

    // Heart rate
    connection.write("Bangle.setHRMPower(1);\nBangle.on('HRM', hr => Bluetooth.println('H,'+(Date.now())+','+hr.bpm));\n");
}

// --- connect watch ---
function connectWatch() {
    if(connection) {
        mainText.textContent = "Already connected";
        return;
    }

    mainText.textContent = "Connecting...";

    Puck.connect(c => {
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

        // reset watch then start all sensors
        connection.write("reset();\n", () => {
            setTimeout(() => startSensors(), 1500);
        });
    });
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

// --- save file ---
function saveFile() {
    const testName = testNameInput.value || "test";
    const filename = "test_" + testName + "_" + Date.now() + ".json";
    const blob = new Blob([JSON.stringify(testData)], {type:"application/json"});

    // fallback med a-tag (fil laddas ner)
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- attach button events ---
connectBtn.addEventListener("click", connectWatch);
startButton.addEventListener("click", doTest);

mainText.textContent = "Ready to connect";
