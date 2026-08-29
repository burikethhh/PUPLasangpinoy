import * as Notifications from 'expo-notifications';
import { Slot, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Component, ErrorInfo, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { onAuthChange, updateProfile } from '../lib/firebase';
import { createLogger } from '../lib/logger';
import '../lib/location-task'; // Register background location task definition
import {
    addNotificationReceivedListener,
    addNotificationResponseListener,
    registerForPushNotificationsAsync,
} from '../lib/notifications';

const rootLog = createLogger('RootLayout');

// Global error boundary
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    rootLog.error('UNCAUGHT ERROR BOUNDARY', { message: error.message, stack: error.stack, componentStack: info.componentStack });
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#E74C3C', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>App Crashed</Text>
          <Text style={{ color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 8 }}>{this.state.error}</Text>
          <Text style={{ color: '#888', fontSize: 11, textAlign: 'center', marginTop: 16 }}>Restart the app to continue.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [showWebWarning, setShowWebWarning] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Global unhandled promise rejection handler
    const originalHandler = ErrorUtils?.getGlobalHandler?.();
    const handler = (error: any) => {
      rootLog.error('UNHANDLED PROMISE REJECTION', { message: error?.message || String(error), stack: error?.stack });
      if (originalHandler) originalHandler(error);
    };
    if (typeof ErrorUtils !== 'undefined') {
      (ErrorUtils as any).setGlobalHandler(handler);
    }

    // Log app start
    rootLog.info('App started', { platform: Platform.OS, version: '4.1.4' });
    // Show warning on web about potential ad blocker issues
    if (Platform.OS === 'web') {
      const checkFirebase = async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          await fetch('https://www.gstatic.com/firebasejs/ui/2.0.0/images/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch {
          console.warn('[App] Firebase connectivity check failed - ad blocker may be active');
          setShowWebWarning(true);
          setTimeout(() => setShowWebWarning(false), 5000);
        }
      };
      checkFirebase();
    }

    // Register for push notifications on native
    if (Platform.OS !== 'web') {
      registerForPushNotificationsAsync().then(({ token, error }) => {
        if (token) {
          // Save token to current user's profile when auth state resolves
          const unsub = onAuthChange((user) => {
            if (user) {
              updateProfile(user.uid, { fcm_token: token } as any).catch(() => {});
            }
            unsub();
          });
        } else if (error) {
          console.warn('[Notifications]', error);
        }
      });

      // Listen for foreground notifications
      notificationListener.current = addNotificationReceivedListener((notification) => {
        console.log('[Notifications] Received:', notification.request.content.title);
      });

      // Handle notification tap → navigate to the relevant screen
      responseListener.current = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data as any;
        if (data?.screen) {
          router.push(data.screen);
        }
      });
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <StatusBar style="light" />
        {showWebWarning && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Ad blocker detected. Some features may not work. Consider testing on mobile.
            </Text>
          </View>
        )}
        <Slot />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  warningBanner: {
    backgroundColor: '#F25C05',
    padding: 10,
    alignItems: 'center',
  },
  warningText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});
