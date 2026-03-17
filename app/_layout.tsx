import { router, Slot } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data?.is_admin) {
              router.replace('/(admin)');
            } else {
              router.replace('/(tabs)');
            }
          });
      } else {
        router.replace('/(auth)/welcome');
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/(auth)/welcome');
      }
    });
  }, []);

  return <Slot />;
}