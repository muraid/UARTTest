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
    accel: []
};

// -----------------------------
// Kod som laddas upp till Bangle.js
// (DIN FUNGERANDE VERSION)
// -----------------------------
const BANGLE_CODE = `
var start = Date.now();
Bluetooth.println("I," + start);

// ACCEL
Bangle.on('accel',function(a) {
  var d = [
    "A",
    Math.round(Date.now() - start),
    Math.round(a.x * 8192),
    Math.round(a.y * 8192),
    Math.round(a.z * 8192)
  ];
  Bluetooth.println(d.join(","));
});

// STEPS (vi ignorerar i parsing)
Bangle.on('step', function(up) {
  var d = [
    "S",
    Math.round(Date.now() - start),
    up
  ];
  Bluetooth.println(d.join(","));
});

// HRM
Bangle.setHRMPower(1);
Bangle.on('HRM',function(hrm) {
  var d = [
    "H",
    Math.round(Date.now() - start),
    hrm.bpm,
    hrm.confidence
  ];
  Bluetooth.println(d.join(","));
});

// HRM RAW (vi ignorerar i parsing)
Bangle.on('HRM-raw',function(hrm) {
  var d = [
    "G",
    Math.round(Date.now() - start),
    hrm.raw
  ];
  Bluetooth.println(d.join(","));
});

// HRM ENV (vi ignorerar i parsing)
Bangle.on('HRM-env', function(env) { 
  var d = [
    "E",
    Math.round(Date.now() - start),
    env
  ];
  Bluetooth.println(d.join(","));
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

    // Vi ignorerar S, G, E helt
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
