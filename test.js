document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------
    // UI‑element
    // -----------------------------
    const connectBtn = document.getElementById("connectBtn");
    const startHRBtn = document.getElementById("startHRBtn");
    const startMAGBtn = document.getElementById("startMAGBtn");
    const startACCELBtn = document.getElementById("startACCELBtn");
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
    // BANGLE CODE
    // -----------------------------
    const BANGLE_CODE = `
var start = Date.now();
Bluetooth.println("I," + start);

function startACCEL() {
  Bangle.on('accel', a => {
    Bluetooth.println("A," + (Date.now()-start) + "," +
      Math.round(a.x*8192) + "," +
      Math.round(a.y*8192) + "," +
      Math.round(a.z*8192));
  });
}

function startHRM() {
  Bangle.setHRMPower(1);
  Bangle.on('HRM', hrm => {
    Bluetooth.println("H," + (Date.now()-start) + "," +
      hrm.bpm + "," + hrm.confidence);
  });
}

function startMAG() {
  Bangle.setCompassPower(1);
  Bangle.on('mag', mag => {
    Bluetooth.println("C," + (Date.now()-start) + "," +
      mag.x + "," + mag.y + "," + mag.z);
  });
}

Bluetooth.on('data', d => {
  d = d.trim();
  if (d === "ACCEL") startACCEL();
  if (d === "HR") startHRM();
  if (d === "MAG") startMAG();
});
`;

    // -----------------------------
    // Upload helper
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
    // Connect‑knapp
    // -----------------------------
    connectBtn.addEventListener("click", () => {
        if (connection) {
            connection.close();
            connection = null;
            statusText.textContent = "Disconnected";
            connectBtn.textContent = "Connect watch";
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

            // ⭐ Starta datainsamling direkt
            testRunning = true;

            let buffer = "";
            connection.on("data", d => {
                buffer += d;
                let lines = buffer.split("\n");
                buffer = lines.pop();
                lines.forEach(handleLine);
            });

            // Reset + upload code
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
    // Sensor‑startknappar
    // -----------------------------
    startHRBtn.addEventListener("click", () => {
        if (connection) {
            connection.write("HR\n");
            statusText.textContent = "HRM started";
        }
    });

    startMAGBtn.addEventListener("click", () => {
        if (connection) {
            connection.write("MAG\n");
            statusText.textContent = "MAG started";
        }
    });

    startACCELBtn.addEventListener("click", () => {
        if (connection) {
            connection.write("ACCEL\n");
            statusText.textContent = "ACCEL started";
        }
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

        if (testRunning) {
            // Stop recording
            testRunning = false;
            testData.endTs = Date.now();
            startBtn.textContent = "Start";
            statusText.textContent = "Test finished";

            const filename = `${testNameInput.value || "test"}_${Date.now()}.json`;
            const blob = new Blob([JSON.stringify(testData)], { type: "application/json" });
            saveAs(blob, filename);
        }
    });

});
