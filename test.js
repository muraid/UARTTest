// -----------------------------
// UI‑element
// -----------------------------
const connectBtn = document.getElementById("connectBtn");
const startBtn = document.getElementById("startBtn");
const statusText = document.getElementById("statusText");
const testNameInput = document.getElementById("testName");

// -----------------------------
// Variabler
// -----------------------------
let connection = null;
let testRunning = false;

let testData = {
    startTs: null,
    endTs: null,
    hr: [],
    accel: [],
    gyro: [],
    raw: [],
    env: [],
    steps: []
};

// -----------------------------
// Kod som laddas upp till Bangle.js
// -----------------------------
const BANGLE_CODE = `… (klistra in koden ovan här) …`;

// -----------------------------
// Chunk‑upload funktion
// -----------------------------
function uploadCode(code, callback) {
  let lines = code.split("\n");
  function sendNext() {
    if (!lines.length) {
      callback();
      return;
    }
    let line = lines.shift() + "\n";
    connection.write(line, sendNext);
  }
  sendNext();
}

// -----------------------------
// Connect‑knapp
// -----------------------------
connectBtn.addEventListener("click", () => {
    if (connection) {
        connection.close();
        connection = null;
        statusText.textContent = "Disconnected";
        connectBtn.textContent = "Connect";
        return;
    }

    Puck.connect(c => {
        if (!c) {
            statusText.textContent = "Failed to connect";
            return;
        }

        connection = c;
        statusText.textContent = "Connected";
        connectBtn.textContent = "Disconnect";

        let buffer = "";

        connection.on("data", d => {
            buffer += d;
            let lines = buffer.split("\n");
            buffer = lines.pop();
            lines.forEach(handleLine);
        });

        // Stop running code, reset, upload new code
        connection.write("\x03", () => {
            setTimeout(() => {
                connection.write("reset();\n", () => {
                    setTimeout(() => {
                        uploadCode(BANGLE_CODE, () => {
                            statusText.textContent = "Code uploaded!";
                        });
                    }, 1500);
                });
            }, 300);
        });
    });
});

// -----------------------------
// Hantera inkommande data
// -----------------------------
function handleLine(line) {
    let parts = line.split(",");
    let type = parts[0];

    if (type === "I") {
        testData.startTs = parseInt(parts[1]);
    }

    if (!testRunning) return;

    if (type === "H") {
        testData.hr.push({
            ms: parseInt(parts[1]),
            bpm: parseInt(parts[2]),
            conf: parseInt(parts[3])
        });
    }

    if (type === "A") {
        testData.accel.push({
            ms: parseInt(parts[1]),
            x: parseFloat(parts[2]),
            y: parseFloat(parts[3]),
            z: parseFloat(parts[4])
        });
    }

    if (type === "G") {
        testData.gyro.push({
            ms: parseInt(parts[1]),
            x: parseFloat(parts[2]),
            y: parseFloat(parts[3]),
            z: parseFloat(parts[4])
        });
    }

    if (type === "R") {
        testData.raw.push({
            ms: parseInt(parts[1]),
            raw: parseInt(parts[2])
        });
    }

    if (type === "E") {
        testData.env.push({
            ms: parseInt(parts[1]),
            env: parseInt(parts[2])
        });
    }

    if (type === "S") {
        testData.steps.push({
            ms: parseInt(parts[1]),
            up: parseInt(parts[2])
        });
    }
}

// -----------------------------
// Start/Stop‑knapp
// -----------------------------
startBtn.addEventListener("click", () => {
    if (!connection) {
        statusText.textContent = "Connect to Bangle.js first";
        return;
    }

    if (!testRunning) {
        testRunning = true;
        testData.hr = [];
        testData.accel = [];
        testData.gyro = [];
        testData.raw = [];
        testData.env = [];
        testData.steps = [];
        startBtn.textContent = "Stop";
        statusText.textContent = "Recording...";
    } else {
        testRunning = false;
        testData.endTs = Date.now();
        startBtn.textContent = "Start";
        statusText.textContent = "Test finished";

        const filename = `${testNameInput.value || "test"}_${Date.now()}.json`;
        const blob = new Blob([JSON.stringify(testData)], { type: "application/json" });
        saveAs(blob, filename);
    }
});
