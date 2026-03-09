// -----------------------------
// UI‑element
// -----------------------------
const connectHRBtn = document.getElementById("connectHRBtn");
const connectMAGBtn = document.getElementById("connectMAGBtn");
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
    mag: []
};

// -----------------------------
// BANGLE CODE – HRM + ACCEL
// -----------------------------
const BANGLE_CODE_HR = `
var start = Date.now();
Bluetooth.println("I," + start);

// ACCEL
Bangle.on('accel', a => {
  Bluetooth.println("A," + (Date.now()-start) + "," +
    Math.round(a.x*8192) + "," +
    Math.round(a.y*8192) + "," +
    Math.round(a.z*8192));
});

// HRM
Bangle.setHRMPower(1);
Bangle.on('HRM', hrm => {
  Bluetooth.println("H," + (Date.now()-start) + "," +
    hrm.bpm + "," + hrm.confidence);
});
`;

// -----------------------------
// BANGLE CODE – MAG + ACCEL
// -----------------------------
const BANGLE_CODE_MAG = `
var start = Date.now();
Bluetooth.println("I," + start);

// ACCEL
Bangle.on('accel', a => {
  Bluetooth.println("A," + (Date.now()-start) + "," +
    Math.round(a.x*8192) + "," +
    Math.round(a.y*8192) + "," +
    Math.round(a.z*8192));
});

// MAG
Bangle.setCompassPower(1);
Bangle.on('mag', mag => {
  Bluetooth.println("C," + (Date.now()-start) + "," +
    mag.x + "," + mag.y + "," + mag.z);
});
`;

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
    connection.write(lines.shift() + "\n", sendNext);
  }
  sendNext();
}

// -----------------------------
// Connect HR‑knapp
// -----------------------------
connectHRBtn.addEventListener("click", () => {
    if (connection) {
        connection.close();
        connection = null;
        statusText.textContent = "Disconnected";
        connectHRBtn.textContent = "Connect HR";
        return;
    }

    Puck.connect(c => {
        if (!c) {
            statusText.textContent = "Failed to connect";
            return;
        }

        connection = c;
        statusText.textContent = "Connected";
        connectHRBtn.textContent = "Disconnect HR";

        let buffer = "";
        connection.on("data", d => {
            buffer += d;
            let lines = buffer.split("\n");
            buffer = lines.pop();
            lines.forEach(handleLine);
        });

        connection.write("\x03", () => {
            setTimeout(() => {
                connection.write("reset();\n", () => {
                    setTimeout(() => {
                        uploadCode(BANGLE_CODE_HR, () => {
                            statusText.textContent = "HRM code uploaded!";
                        });
                    }, 1500);
                });
            }, 300);
        });
    });
});

// -----------------------------
// Connect MAG‑knapp
// -----------------------------
connectMAGBtn.addEventListener("click", () => {
    if (connection) {
        connection.close();
        connection = null;
        statusText.textContent = "Disconnected";
        connectMAGBtn.textContent = "Connect MAG";
        return;
    }

    Puck.connect(c => {
        if (!c) {
            statusText.textContent = "Failed to connect";
            return;
        }

        connection = c;
        statusText.textContent = "Connected";
        connectMAGBtn.textContent = "Disconnect MAG";

        let buffer = "";
        connection.on("data", d => {
            buffer += d;
            let lines = buffer.split("\n");
            buffer = lines.pop();
            lines.forEach(handleLine);
        });

        connection.write("\x03", () => {
            setTimeout(() => {
                connection.write("reset();\n", () => {
                    setTimeout(() => {
                        uploadCode(BANGLE_CODE_MAG, () => {
                            statusText.textContent = "MAG code uploaded!";
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

    if (type === "C") {
        testData.mag.push({
            ms: parseInt(parts[1]),
            x: parseFloat(parts[2]),
            y: parseFloat(parts[3]),
            z: parseFloat(parts[4])
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
        testData.mag = [];
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
