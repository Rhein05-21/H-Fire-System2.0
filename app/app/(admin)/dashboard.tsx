import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Button } from 'react-native';
import mqtt from 'mqtt';
import { useAuth } from '@clerk/clerk-expo';

type DeviceData = {
  mac: string;
  ppm: number;
  flame: boolean;
  statusMsg: string;
  lastSeen: Date;
};

export default function AdminDashboard() {
  const [devices, setDevices] = useState<Record<string, DeviceData>>({});
  const { signOut } = useAuth();

  useEffect(() => {
    const clientId = `mqtt_admin_${Math.random().toString(16).slice(3)}`;
    const host = 'wss://16e51255d95244c2b069b92cf77ebf81.s1.eu.hivemq.cloud:8884/mqtt';

    const client = mqtt.connect(host, {
      clientId,
      username: 'RheinTigle',
      password: '052105@Rhein',
      reconnectPeriod: 5000,
    });

    client.on('connect', () => {
      console.log('Admin connected to MQTT');
      client.subscribe('hfire/+/data');
      client.subscribe('hfire/+/status');
    });

    client.on('message', (topic, message) => {
      const payloadStr = message.toString();
      const parts = topic.split('/');
      if (parts.length < 3) return;
      const mac = parts[1];
      const type = parts[2]; // data or status

      setDevices((prev) => {
        const device = prev[mac] || { mac, ppm: 0, flame: false, statusMsg: 'Unknown', lastSeen: new Date() };

        if (type === 'data') {
          try {
            const data = JSON.parse(payloadStr);
            device.ppm = data.ppm;
            device.flame = data.flame === true || data.flame === 'true';
          } catch (e) {
            console.error("Parse error");
          }
        } else if (type === 'status') {
          device.statusMsg = payloadStr;
        }

        device.lastSeen = new Date();
        return { ...prev, [mac]: { ...device } };
      });
    });

    return () => {
      client.end();
    };
  }, []);

  const renderItem = ({ item }: { item: DeviceData }) => {
    const isDanger = item.flame || item.ppm > 1500;
    
    return (
      <View style={[styles.card, isDanger ? styles.cardDanger : styles.cardSafe]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Unit: {item.mac}</Text>
          <Text style={styles.cardStatus}>{item.statusMsg}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>PPM: {item.ppm}</Text>
          <Text style={styles.cardText}>Flame: {item.flame ? 'YES' : 'NO'}</Text>
        </View>
      </View>
    );
  };

  const deviceList = Object.values(devices);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>All Houses</Text>
        <Button title="Sign Out" onPress={() => signOut()} color="red" />
      </View>

      {deviceList.length === 0 ? (
        <Text style={styles.emptyText}>Waiting for devices to connect...</Text>
      ) : (
        <FlatList
          data={deviceList}
          keyExtractor={(item) => item.mac}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  card: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardSafe: {
    backgroundColor: '#fff',
    borderLeftWidth: 5,
    borderLeftColor: 'green',
  },
  cardDanger: {
    backgroundColor: '#fff0f0',
    borderLeftWidth: 5,
    borderLeftColor: 'red',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardStatus: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardText: {
    fontSize: 16,
  },
});