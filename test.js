import { HeartRateSensor } from './ble/heartratesensor.js'

const connectHRBtn = document.getElementById('connectHRBtn')
const connectAccelBtn = document.getElementById('connectAccelBtn');
const connectGyroBtn = document.getElementById('connectGyroBtn');
const startButton = document.getElementById('startBtn')
const mainText = document.getElementById('mainText')
const subText = document.getElementById('subText')
const hrText = document.getElementById('hrText')
const accText = document.getElementById('accText');
const gyroText = document.getElementById('gyroText');
const testNameInput = document.getElementById('testNameInput')

let connectedAccel = false
let connectedGyro = false
let accelDevice, gyroDevice

// object containing the data of the test
let testData = {}
// initialization of an empty test data
const initData = function () {
    testData = {
        startTs: '',
        endTs: '',
        motion: [],
        orientation: [],
        heartRate: [],
        gyro: []
    }
}

const HRsensor = new HeartRateSensor('Polar', (meas) => {
    console.log(meas)
    hrText.textContent = "HR: " + meas.heartRate + " bpm"
    if (testData && testData.startTs) {
        meas.msFromStart = new Date().getTime() - testData.startTs.getTime()
    }
    if (testRunning) {
        testData.heartRate.push(meas)
    }
})

connectHRBtn.addEventListener('click', async () => {
    if (!HRsensor.isConnected()) {
        await HRsensor.connect()
        if (HRsensor.isConnected()) {
            HRsensor.startNotificationsHeartRateMeasurement()
            connectHRBtn.textContent = "Disconnect Heart Rate sensor"
        }
    } else {
        // HRsensor.stopNotificationsHeartRateMeasurement()
        HRsensor.disconnect()
        if (!HRsensor.isConnected()) {
            connectHRBtn.textContent = "Connect Heart Rate sensor"
            hrText.textContent = " "
        }
    }
})

connectAccelBtn.addEventListener('click', async () => {
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Bangle' }],
        optionalServices: ['e95d0753-251d-470a-a062-fa1922dfa9a8']
    })
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService('e95d0753-251d-470a-a062-fa1922dfa9a8')
    const characteristic = await service.getCharacteristic('e95dca4b-251d-470a-a062-fa1922dfa9a8')

    characteristic.addEventListener('characteristicvaluechanged', evt => {
        const data = evt.target.value
        const x = data.getInt16(0,true)
        const y = data.getInt16(2,true)
        const z = data.getInt16(4,true)
        accText.textContent = `ACC: X=${x}, Y=${y}, Z=${z}`
        if(testRunning) testData.motion.push({x,y,z,ts:Date.now()})
    })

    await characteristic.startNotifications()
})

// --- Gyroscope ---
connectGyroBtn.addEventListener('click', async () => {
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Bangle' }],
        optionalServices: ['e95d6b53-251d-470a-a062-fa1922dfa9a8']
    })
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService('e95d6b53-251d-470a-a062-fa1922dfa9a8')
    const characteristic = await service.getCharacteristic('e95dfb24-251d-470a-a062-fa1922dfa9a8')

    characteristic.addEventListener('characteristicvaluechanged', evt => {
        const data = evt.target.value
        const x = data.getInt16(0,true)
        const y = data.getInt16(2,true)
        const z = data.getInt16(4,true)
        gyroText.textContent = `GYRO: X=${x}, Y=${y}, Z=${z}`
        if(testRunning) testData.gyro.push({x,y,z,ts:Date.now()})
    })

    await characteristic.startNotifications()
})

let testRunning = false
mainText.textContent = 'Ready to start'
// Reference for the Wake Lock.
let wakeLock = null

let doTest = async function () {
    if (!testRunning) {
        try {
            
        } catch (err) {
            console.error(err)
            mainText.textContent = 'ERROR'
            subText.textContent = 'Sensor needs permission, retry'
            return
        }

        if ("wakeLock" in navigator) {
            // request a wake lock
            try {
                wakeLock = await navigator.wakeLock.request("screen")
            } catch (err) {
                console.error(err)
            }
        } else {
            subText.textContent = "Wake lock is not supported by this browser"
        }

        // all permission working, start the test
        initData()
        testRunning = true
        testData.startTs = new Date()


        mainText.textContent = 'Test started!'
        startButton.textContent = 'Stop'
    } else {
        // release wake lock
        if (wakeLock) {
            wakeLock.release().then(() => {
                wakeLock = null
            })
        }

        testRunning = false

        testData.endTs = new Date()
        mainText.textContent = 'Test completed, ready to start again'
        startButton.textContent = 'Start'

        console.log(testData)

        const testName = testNameInput.value
        let filename = 'test' + testName + '_' + new Date().getTime() + '.txt'
        const file = new File([JSON.stringify(testData)], filename, {
            type: 'text/plain',
        })

        let message = {
            title: 'Test ' + testName + ' results',
            text: 'This file contains a test done on ' + new Date(),
            files: [file],
        }

        if (navigator.canShare(message)) {
            await navigator.share(message);
        } else {
            mainText.textContent = 'Cannot share file'
        }
    }
}



// detect file saving capability
const testfile = new File(['test'], "testresults.json", {
    type: "text/json",
})
if ((typeof navigator.share !== 'function') || !navigator.canShare({
    title: "Test results",
    text: "This file contains a test done on " + new Date(),
    files: [testfile],
})) {
    subText.textContent = 'File saving not supported'
    startButton.style.visibility = 'hidden'
    startButton.disabled = true
}


startButton.addEventListener('click', doTest)
