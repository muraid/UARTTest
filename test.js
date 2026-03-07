// UI elements
const connectHRBtn = document.getElementById('connectHRBtn')
const connectAccelBtn = document.getElementById('connectAccelBtn')
const connectGyroBtn = document.getElementById('connectGyroBtn')
const startButton = document.getElementById('startBtn')

const mainText = document.getElementById('mainText')
const subText = document.getElementById('subText')

const hrText = document.getElementById('hrText')
const accText = document.getElementById('accText')
const gyroText = document.getElementById('gyroText')

const testNameInput = document.getElementById('testNameInput')

// connection variables
let connection
let buffer = ""
let connected = false
let testRunning = false

// test data
let testData = {}

function initData(){
    testData = {
        startTs: '',
        endTs: '',
        heartRate: [],
        accel: [],
        gyro: []
    }
}

// CODE THAT RUNS ON THE WATCH
const BANGLE_CODE = `
var start = Date.now();

Bangle.setHRMPower(1);
Bangle.setGyroPower(1);

Bangle.on('accel', function(a){
 Bluetooth.println("A,"+
   (Date.now()-start)+","+
   Math.round(a.x*8192)+","+
   Math.round(a.y*8192)+","+
   Math.round(a.z*8192));
});

Bangle.on('gyro', function(g){
 Bluetooth.println("Y,"+
   (Date.now()-start)+","+
   Math.round(g.x*1000)+","+
   Math.round(g.y*1000)+","+
   Math.round(g.z*1000));
});

Bangle.on('HRM', function(hr){
 Bluetooth.println("H,"+
   (Date.now()-start)+","+
   hr.bpm);
});
`

// CONNECT WATCH
function connectWatch(){

    if(connection){
        connection.close()
        connection = undefined
        connected = false
        mainText.textContent = "Disconnected"
        return
    }

    mainText.textContent = "Connecting..."

    Puck.connect(function(c){

        if(!c){
            mainText.textContent = "Connection failed"
            return
        }

        connection = c
        connected = true
        mainText.textContent = "Connected to Bangle"

        connection.on("data", function(d){
            buffer += d

            let lines = buffer.split("\n")
            buffer = lines.pop()

            lines.forEach(parseLine)
        })

        // reset watch
        connection.write("reset();\n", function(){

            setTimeout(function(){

                connection.write(
                    "\x03\x10if(1){"+BANGLE_CODE+"}\n"
                )

            },1500)

        })

    })
}

// PARSE SENSOR DATA
function parseLine(line){

    const d = line.split(",")

    // ACCELEROMETER
    if(d[0] === "A"){

        const accel = {
            ms: parseInt(d[1]),
            x: parseInt(d[2]),
            y: parseInt(d[3]),
            z: parseInt(d[4])
        }

        accText.textContent =
            `ACC: X=${accel.x} Y=${accel.y} Z=${accel.z}`

        if(testRunning){
            testData.accel.push(accel)
        }
    }

    // GYRO
    if(d[0] === "Y"){

        const gyro = {
            ms: parseInt(d[1]),
            x: parseInt(d[2]),
            y: parseInt(d[3]),
            z: parseInt(d[4])
        }

        gyroText.textContent =
            `GYRO: X=${gyro.x} Y=${gyro.y} Z=${gyro.z}`

        if(testRunning){
            testData.gyro.push(gyro)
        }
    }

    // HEART RATE
    if(d[0] === "H"){

        const hr = {
            ms: parseInt(d[1]),
            bpm: parseInt(d[2])
        }

        hrText.textContent = "HR: " + hr.bpm + " bpm"

        if(testRunning){
            testData.heartRate.push(hr)
        }
    }

}

// START / STOP TEST
async function doTest(){

    if(!testRunning){

        initData()

        testRunning = true
        testData.startTs = new Date()

        mainText.textContent = "Test running"
        startButton.textContent = "Stop"

    }
    else{

        testRunning = false
        testData.endTs = new Date()

        mainText.textContent = "Test finished"
        startButton.textContent = "Start"

        saveFile()

    }

}

// SAVE FILE
function saveFile(){

    const testName = testNameInput.value || "test"

    const filename =
        "test_" + testName + "_" + Date.now() + ".json"

    const blob =
        new Blob([JSON.stringify(testData)],
        {type:"application/json"})

    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()

}

// BUTTON EVENTS

connectHRBtn.addEventListener("click", connectWatch)
connectAccelBtn.addEventListener("click", connectWatch)
connectGyroBtn.addEventListener("click", connectWatch)

startButton.addEventListener("click", doTest)

mainText.textContent = "Ready to connect"
