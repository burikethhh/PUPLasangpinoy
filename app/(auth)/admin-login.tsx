import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert, KeyboardAvoidingView,
    Platform, ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Sign In Failed', error.message);
    } else if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', data.user.id)
        .single();
      if (profile?.is_admin) {
        router.replace('/(admin)');
      } else {
        Alert.alert('Access Denied', 'You are not an admin.');
        await supabase.auth.signOut();
      }
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">

          <View style={styles.card}>
            {/* BACK */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#2E1A06" />
            </TouchableOpacity>

            {/* ICON */}
            <View style={styles.iconBox}>
              <Ionicons name="settings" size={32} color="#2E1A06" />
            </View>

            <Text style={styles.title}>Admin Portal</Text>
            <Text style={styles.subtitle}>Sign in with your admin credentials</Text>

            {/* EMAIL */}
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="admin@email.com"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* PASSWORD */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={{ height: 20 }} />

            {/* SIGN IN BUTTON */}
            <TouchableOpacity
              style={[styles.signInBtn, loading && { opacity: 0.7 }]}
              onPress={signIn}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.signInText}>Sign In as Admin</Text>}
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0DC' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  backBtn: { marginBottom: 16 },
  iconBox: {
    width: 70, height: 70, borderRadius: 20,
    backgroundColor: '#2E1A0615',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 22, fontWeight: 'bold',
    color: '#2E1A06', textAlign: 'center',
  },
  subtitle: {
    fontSize: 12, color: '#888',
    textAlign: 'center', marginTop: 4, marginBottom: 24,
  },
  label: { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 4 },
  inputBox: {
    backgroundColor: '#FDF5E0', borderRadius: 12,
    marginBottom: 12, height: 50, justifyContent: 'center',
  },
  input: { fontSize: 14, color: '#333', paddingHorizontal: 16, height: '100%' },
  signInBtn: {
    backgroundColor: '#2E1A06', borderRadius: 30,
    height: 52, justifyContent: 'center', alignItems: 'center',
  },
  signInText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});