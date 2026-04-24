require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');
const { Expo } = require('expo-server-sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const expo = new Expo();
const TOKENS_FILE = path.join(__dirname, 'tokens.json');

// --- Push Token Management ---
let pushTokens = {};

const loadTokens = () => {
    try {
        if (fs.existsSync(TOKENS_FILE)) {
            const data = fs.readFileSync(TOKENS_FILE);
            pushTokens = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading tokens:', err);
    }
};

const saveTokens = () => {
    try {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(pushTokens, null, 2));
    } catch (err) {
        console.error('Error saving tokens:', err);
    }
};

loadTokens();

app.post('/register-token', (req, res) => {
    const { mac, token } = req.body;
    if (!mac || !token) {
        return res.status(400).json({ error: 'MAC and token are required' });
    }
    if (!Expo.isExpoPushToken(token)) {
        return res.status(400).json({ error: 'Invalid Expo push token' });
    }

    if (!pushTokens[mac]) {
        pushTokens[mac] = [];
    }

    if (!pushTokens[mac].includes(token)) {
        pushTokens[mac].push(token);
        saveTokens();
        console.log(`Registered token for MAC: ${mac}`);
    }

    res.json({ success: true });
});

// Endpoint to keep Render alive
app.get('/ping', (req, res) => res.send('pong'));

// --- MQTT Setup ---
const MQTT_SERVER = "mqtts://16e51255d95244c2b069b92cf77ebf81.s1.eu.hivemq.cloud:8883";
const MQTT_USER = "RheinTigle";
const MQTT_PASS = "052105@Rhein";
const DANGER_LIMIT = 1500;

const mqttClient = mqtt.connect(MQTT_SERVER, {
    username: MQTT_USER,
    password: MQTT_PASS,
});

mqttClient.on('connect', () => {
    console.log('Backend connected to HiveMQ');
    // Subscribe to all house data topics
    mqttClient.subscribe('hfire/+/data', (err) => {
        if (err) {
            console.error('Subscription error:', err);
        } else {
            console.log('Subscribed to hfire/+/data');
        }
    });
});

let lastNotificationTimes = {};

mqttClient.on('message', async (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        const { mac, ppm, flame } = payload;
        
        const isFlameDetected = flame === true || flame === 'true';
        
        let title = '';
        let body = '';
        let isCritical = false;

        if (isFlameDetected && ppm > DANGER_LIMIT) {
            title = '🔥 CRITICAL: FIRE DETECTED! 🔥';
            body = 'Flame and High Smoke detected in your home!';
            isCritical = true;
        } else if (isFlameDetected) {
            title = '⚠️ WARNING: FLAME DETECTED';
            body = 'Flame sensor triggered!';
            isCritical = true;
        } else if (ppm > DANGER_LIMIT) {
            title = '⚠️ WARNING: HIGH SMOKE';
            body = `Smoke levels are critical (PPM: ${ppm})!`;
            isCritical = true;
        }

        if (isCritical) {
            // Throttle notifications (e.g., max 1 every 30 seconds per mac)
            const now = Date.now();
            const lastTime = lastNotificationTimes[mac] || 0;
            if (now - lastTime < 30000) {
                return; // skip if too soon
            }
            lastNotificationTimes[mac] = now;

            const tokens = pushTokens[mac] || [];
            if (tokens.length === 0) return;

            const messages = [];
            for (let pushToken of tokens) {
                messages.push({
                    to: pushToken,
                    sound: 'default',
                    title: title,
                    body: body,
                    data: { mac, ppm, flame },
                });
            }

            const chunks = expo.chunkPushNotifications(messages);
            for (let chunk of chunks) {
                try {
                    await expo.sendPushNotificationsAsync(chunk);
                    console.log(`Sent notification for ${mac}`);
                } catch (error) {
                    console.error('Error sending push notification', error);
                }
            }
        }

    } catch (e) {
        console.error('Error parsing message', e);
    }
});

app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
});
