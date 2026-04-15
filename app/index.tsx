import { Redirect } from 'expo-router';
import { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getProfile, onAuthChange } from '../lib/firebase';

type AuthState = 'loading' | 'admin' | 'staff' | 'customer' | 'guest';

export default function Index() {
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user: User | null) => {
      try {
        if (user) {
          const profile = await getProfile(user.uid);
          const role = profile?.role || (profile?.is_admin ? 'admin' : 'customer');
          setAuthState(role as AuthState);
        } else {
          setAuthState('guest');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setAuthState('guest');
      }
    });

    return () => unsubscribe();
  }, []);

  if (authState === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E' }}>
        <ActivityIndicator size="large" color="#F25C05" />
      </View>
    );
  }

  if (authState === 'admin') return <Redirect href="/(admin)" />;
  if (authState === 'staff') return <Redirect href={"/(staff)" as any} />;
  if (authState === 'customer') return <Redirect href="/(tabs)" />;

  return <Redirect href="/(auth)/welcome" />;
}
