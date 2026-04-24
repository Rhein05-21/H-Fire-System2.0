import { Stack } from 'expo-router';

export default function ResidentLayout() {
  return (
    <Stack>
      <Stack.Screen name="setup" options={{ title: 'Link Your Device' }} />
      <Stack.Screen name="dashboard" options={{ title: 'Home Status' }} />
    </Stack>
  );
}