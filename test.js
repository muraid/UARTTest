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
let buffer = "";
let testRunning = false;

let testData = {
  startTs: null,
  endTs: null,
  hr: []
};

// -----------------------------
// Connect
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

    connection.on("data", d => {
      buffer += d;
      let lines = buffer.split("\n");
      buffer = lines.pop();
      lines.forEach(handleLine);
    });
  });
});

// -----------------------------
// Start/Stop
// -----------------------------
startBtn.addEventListener("click", () => {
  if (!connection) return;

  if (!testRunning) {
    testRunning = true;
    testData.hr = [];
    testData.startTs = Date.now();

    connection.write("HR_ON\n");
    connection.write("START\n");

    startBtn.textContent = "Stop";
    statusText.textContent = "Recording...";
  } else {
    testRunning = false;

    connection.write("STOP\n");
    connection.write("HR_OFF\n");

    startBtn.textContent = "Start";
    statusText.textContent = "Stopping...";
  }
});

// -----------------------------
// Handle incoming data
// -----------------------------
function handleLine(line) {
  line = line.trim();
  if (!line) return;

  if (line.startsWith("DATA,HR")) {
    let parts = line.split(",");
    testData.hr.push({
      ms: Number(parts[2]),
      bpm: Number(parts[3]),
      conf: Number(parts[4])
    });
  }

  if (line === "STOPPED") {
    testData.endTs = Date.now();

    const filename = `${testNameInput.value || "hr_test"}_${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(testData)], { type: "application/json" });
    saveAs(blob, filename);

    statusText.textContent = "Test finished";
  }
}
