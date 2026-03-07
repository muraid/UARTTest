// UI elements
const connectBtn = document.getElementById('connectHRBtn') // en knapp
const startButton = document.getElementById('startBtn')

const mainText = document.getElementById('mainText')
const subText = document.getElementById('subText')

const hrText = document.getElementById('hrText')
const accText = document.getElementById('accText')
const gyroText = document.getElementById('gyroText')

const testNameInput = document.getElementById('testNameInput')

// connection variables
let connection, buffer="", connected=false, testRunning=false

// test data
let testData = {}

function initData(){
    testData = { startTs:'', endTs:'', heartRate:[], accel:[], gyro:[] }
}

// Bangle.js code
const BANGLE_CODE = `
var start = Date.now();

Bangle.setHRMPower(1);
Bangle.setGyroPower(1);

Bangle.on('accel', a => Bluetooth.println("A,"+(Date.now()-start)+","+Math.round(a.x*8192)+","+Math.round(a.y*8192)+","+Math.round(a.z*8192)));
Bangle.on('gyro', g => Bluetooth.println("Y,"+(Date.now()-start)+","+Math.round(g.x*1000)+","+Math.round(g.y*1000)+","+Math.round(g.z*1000)));
Bangle.on('HRM', hr => Bluetooth.println("H,"+(Date.now()-start)+","+hr.bpm));
`

// Connect watch
function connectWatch(){
    if(connection){ connection.close(); connection=undefined; connected=false; mainText.textContent="Disconnected"; return }
    mainText.textContent="Connecting..."
    Puck.connect(c=>{
        if(!c){ mainText.textContent="Connection failed"; return }
        connection=c; connected=true; mainText.textContent="Connected"

        connection.on("data", d=>{
            buffer += d
            let lines = buffer.split("\n")
            buffer = lines.pop()
            lines.forEach(parseLine)
        })

        // reset watch and upload code
        connection.write("reset();\n", ()=>{
            setTimeout(()=> connection.write("\x03\x10if(1){"+BANGLE_CODE+"}\n"), 1500)
        })
    })
}

// Parse sensor data
function parseLine(line){
    const d=line.split(",")
    if(d[0]==="A"){ const accel={ms:+d[1],x:+d[2],y:+d[3],z:+d[4]}; accText.textContent=`ACC: X=${accel.x} Y=${accel.y} Z=${accel.z}`; if(testRunning) testData.accel.push(accel) }
    if(d[0]==="Y"){ const gyro={ms:+d[1],x:+d[2],y:+d[3],z:+d[4]}; gyroText.textContent=`GYRO: X=${gyro.x} Y=${gyro.y} Z=${gyro.z}`; if(testRunning) testData.gyro.push(gyro) }
    if(d[0]==="H"){ const hr={ms:+d[1],bpm:+d[2]}; hrText.textContent=`HR: ${hr.bpm} bpm`; if(testRunning) testData.heartRate.push(hr) }
}

// Start / stop test
function doTest(){
    if(!testRunning){
        initData()
        testRunning=true
        testData.startTs=new Date()
        mainText.textContent="Test running"
        startButton.textContent="Stop"
    } else {
        testRunning=false
        testData.endTs=new Date()
        mainText.textContent="Test finished"
        startButton.textContent="Start"
        saveFile()
    }
}

// Save file
function saveFile(){
    const testName = testNameInput.value || "test"
    const filename = "test_" + testName + "_" + Date.now() + ".json"
    const blob = new Blob([JSON.stringify(testData)], {type:"application/json"})
    saveAs(blob, filename)
}

// Events
connectBtn.addEventListener("click", connectWatch)
startButton.addEventListener("click", doTest)

mainText.textContent="Ready to connect"
