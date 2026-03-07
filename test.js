// --- UI elements ---
const connectBtn = document.getElementById('connectHRBtn'); // Connect Bangle
const startButton = document.getElementById('startBtn');

const mainText = document.getElementById('mainText');
const subText = document.getElementById('subText');

const hrText = document.getElementById('hrText');
const accText = document.getElementById('accText');
const gyroText = document.getElementById('gyroText');

const testNameInput = document.getElementById('testNameInput');

// --- connection and state ---
let connection = null;
let buffer = "";
let connected = false;
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
    if(d[0]==="A"){
        const accel = { ms:+d[1], x:+d[2], y:+d[3], z:+d[4] };
        accText.textContent = `ACC: X=${accel.x} Y=${accel.y} Z=${accel.z}`;
        if(testRunning) testData.accel.push(accel);
    } else if(d[0]==="Y"){
        const gyro = { ms:+d[1], x:+d[2], y:+d[3], z:+d[4] };
        gyroText.textContent = `GYRO: X=${gyro.x} Y=${gyro.y} Z=${gyro.z}`;
        if(testRunning) testData.gyro.push(gyro);
    } else if(d[0]==="H"){
        const hr = { ms:+d[1], bpm:+d[2] };
        hrText.textContent = `HR: ${hr.bpm} bpm`;
        if(testRunning) testData.heartRate.push(hr);
    }
}

// --- connect to Bangle.js ---
function connectWatch(callback) {
    if(connection){
        mainText.textContent = "Already connected";
        if(callback) callback();
        return;
    }

    mainText.textContent = "Connecting...";
    Puck.connect(c=>{
        if(!c){ mainText.textContent="Connection failed"; return; }
        connection = c;
        connected = true;
        mainText.textContent = "Connected to Bangle.js";

        connection.on("data", d=>{
            buffer += d;
            let lines = buffer.split("\n");
            buffer = lines.pop();
            lines.forEach(parseLine);
        });

        // Reset watch
        connection.write("reset();\n", ()=>{
            setTimeout(()=>{
                if(callback) callback();
            }, 1500);
        });
    });
}

// --- start sensors when test starts ---
function startSensors(){
    if(!connection) return;

    // Accelerometer
    connection.write(
        "Bangle.on('accel', a => Bluetooth.println('A,'+(Date.now())+','+Math.round(a.x*8192)+','+Math.round(a.y*8192)+','+Math.round(a.z*8192)));\n"
    );
    // Gyroscope
    connection.write(
        "Bangle.setGyroPower(1);\n"+
        "Bangle.on('gyro', g => Bluetooth.println('Y,'+(Date.now())+','+Math.round(g.x*1000)+','+Math.round(g.y*1000)+','+Math.round(g.z*1000)));\n"
    );
    // Heart Rate
    connection.write(
        "Bangle.setHRMPower(1);\n"+
        "Bangle.on('HRM', hr => Bluetooth.println('H,'+(Date.now())+','+hr.bpm));\n"
    );
}

// --- start/stop test ---
function doTest(){
    if(!connected){
        mainText.textContent = "Please connect watch first!";
        return;
    }

    if(!testRunning){
        initData();
        testRunning = true;
        testData.startTs = new Date();

        startSensors(); // start collecting sensor data

        mainText.textContent = "Test running...";
        startButton.textContent = "Stop";
    } else {
        testRunning = false;
        testData.endTs = new Date();
        mainText.textContent = "Test finished";
        startButton.textContent = "Start";

        saveFile(); // save collected data
    }
}

// --- save test data as JSON ---
function saveFile(){
    const testName = testNameInput.value || "test";
    const filename = "test_" + testName + "_" + Date.now() + ".json";
    const file = new File([JSON.stringify(testData, null, 2)], filename, { type: "application/json" });

    // Försök med Web Share API först
    if(navigator.canShare && navigator.canShare({ files: [file] })){
        navigator.share({
            title: 'Test results',
            text: 'This file contains a test done on ' + new Date(),
            files: [file]
        }).catch(err => console.error(err));
    } else {
        // fallback via a-link
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// --- attach button events ---
connectBtn.addEventListener("click", ()=>{
    connectWatch(()=>{
        mainText.textContent = "Connected! Ready to start test.";
    });
});
startButton.addEventListener("click", doTest);

mainText.textContent = "Ready to connect";
