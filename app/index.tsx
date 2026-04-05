import { Redirect } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { onAuthChange, getProfile } from '../lib/firebase';
import { User } from 'firebase/auth';

type AuthState = 'loading' | 'admin' | 'user' | 'guest';

export default function Index() {
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    // Use onAuthChange from firebase.ts which also sets REST API auth token
    const unsubscribe = onAuthChange(async (user: User | null) => {
      try {
        if (user) {
          // User is signed in, check if admin
          const profile = await getProfile(user.uid);
          if (profile?.is_admin) {
            setAuthState('admin');
          } else {
            setAuthState('user');
          }
        } else {
          // User is signed out
          setAuthState('guest');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setAuthState('guest');
      }
    });

    return () => unsubscribe();
  }, []);

  // Show loading spinner while checking auth
  if (authState === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E' }}>
        <ActivityIndicator size="large" color="#F25C05" />
      </View>
    );
  }

  // Use Redirect component instead of programmatic navigation
  // This ensures navigation happens after the router is mounted
  if (authState === 'admin') {
    return <Redirect href="/(admin)" />;
  }

  if (authState === 'user') {
    return <Redirect href="/(tabs)" />;
  }

  // Default: guest - redirect to welcome screen
  return <Redirect href="/(auth)/welcome" />;
}
