import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ResidentSetup() {
  const [deviceId, setDeviceId] = useState('');
  const router = useRouter();

  const handleLinkDevice = async () => {
    if (deviceId.length < 5) {
      alert('Please enter a valid 5-character ID from your ESP32 Screen.');
      return;
    }
    
    try {
      await AsyncStorage.setItem('linked_device_mac', deviceId.trim().toUpperCase());
      router.replace('/(resident)/dashboard');
    } catch (e) {
      alert('Failed to link device.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Link Your H-Fire System</Text>
      <Text style={styles.subtitle}>
        Connect to the H-Fire-Setup WiFi on your phone to connect your device to internet. 
        Once connected, look at the LCD screen on your ESP32 device and enter the 5-character ID shown.
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="e.g. A1B2C"
        value={deviceId}
        onChangeText={setDeviceId}
        autoCapitalize="characters"
        maxLength={5}
      />
      
      <Button title="Link Device" onPress={handleLinkDevice} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 15,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    borderRadius: 8,
  },
});