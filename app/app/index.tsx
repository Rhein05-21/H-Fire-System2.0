import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { View, Text, ActivityIndicator } from 'react-native';

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      // Check if user has an admin role in their public metadata, 
      // or we can fallback to checking if email contains 'admin' for demo purposes.
      const isUserAdmin = user.publicMetadata?.role === 'admin' || 
                          user.primaryEmailAddress?.emailAddress?.includes('admin');
      
      setIsAdmin(!!isUserAdmin);
    }
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded || (isSignedIn && isAdmin === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (isAdmin) {
    return <Redirect href="/(admin)/dashboard" />;
  }

  return <Redirect href="/(resident)/dashboard" />;
}