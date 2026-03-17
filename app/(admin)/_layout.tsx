import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AdminLayout() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    if (!data?.is_admin) {
      router.replace('/(tabs)');
      return;
    }
    setChecking(false);
  }

  if (checking) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E' }}>
      <ActivityIndicator size="large" color="#F25C05" />
    </View>
  );

  return <Stack screenOptions={{ headerShown: false }} />;
}