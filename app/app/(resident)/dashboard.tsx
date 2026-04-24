import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import mqtt from 'mqtt';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from '@clerk/clerk-expo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function ResidentDashboard() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sensorData, setSensorData] = useState({ ppm: 0, flame: false });
  const [systemStatus, setSystemStatus] = useState('Connecting...');
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    const loadDevice = async () => {
      const id = await AsyncStorage.getItem('linked_device_mac');
      if (!id) {
        router.replace('/(resident)/setup');
      } else {
        setDeviceId(id);
        registerForPushNotificationsAsync(id);
      }
    };
    loadDevice();
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
    const host = 'wss://16e51255d95244c2b069b92cf77ebf81.s1.eu.hivemq.cloud:8884/mqtt';

    const client = mqtt.connect(host, {
      clientId,
      username: 'RheinTigle',
      password: '052105@Rhein',
      reconnectPeriod: 5000,
    });

    client.on('connect', () => {
      setSystemStatus('Connected');
      client.subscribe(`hfire/${deviceId}/data`);
      client.subscribe(`hfire/${deviceId}/status`);
    });

    client.on('message', (topic, message) => {
      const payloadStr = message.toString();
      
      if (topic.endsWith('/data')) {
        try {
          const data = JSON.parse(payloadStr);
          setSensorData({
            ppm: data.ppm,
            flame: data.flame === true || data.flame === 'true'
          });
        } catch (e) {
          console.error("Error parsing MQTT data");
        }
      } else if (topic.endsWith('/status')) {
        setSystemStatus(payloadStr);
      }
    });

    return () => {
      client.end();
    };
  }, [deviceId]);

  async function registerForPushNotificationsAsync(mac: string) {
    if (!Device.isDevice) return;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return;
    }
    
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      // Register token with backend
      fetch('https://hfire-backend-placeholder.onrender.com/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, token })
      }).catch(err => console.log('Push register error:', err));
      
    } catch (e) {
      console.log(e);
    }
  }

  const handleUnlink = async () => {
    await AsyncStorage.removeItem('linked_device_mac');
    router.replace('/(resident)/setup');
  };

  if (!deviceId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isDanger = sensorData.flame || sensorData.ppm > 1500;

  return (
    <View style={[styles.container, isDanger ? styles.dangerBg : styles.safeBg]}>
      <Text style={styles.header}>Device ID: {deviceId}</Text>
      
      <View style={styles.card}>
        <Text style={styles.statusText}>Status: {systemStatus}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Smoke (PPM):</Text>
          <Text style={styles.value}>{sensorData.ppm}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Flame Detected:</Text>
          <Text style={[styles.value, { color: sensorData.flame ? 'red' : 'green' }]}>
            {sensorData.flame ? 'YES' : 'NO'}
          </Text>
        </View>
      </View>

      {isDanger && (
        <Text style={styles.dangerAlert}>⚠️ DANGER DETECTED ⚠️</Text>
      )}

      <View style={{ marginTop: 40 }}>
        <Button title="Unlink Device" onPress={handleUnlink} color="gray" />
        <View style={{ height: 10 }} />
        <Button title="Sign Out" onPress={() => signOut()} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 20 },
  safeBg: { backgroundColor: '#f0fff0' },
  dangerBg: { backgroundColor: '#fff0f0' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  statusText: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 16, color: '#333' },
  value: { fontSize: 16, fontWeight: 'bold' },
  dangerAlert: { fontSize: 24, fontWeight: 'bold', color: 'red', textAlign: 'center', marginTop: 30 },
});