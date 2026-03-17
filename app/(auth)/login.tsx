import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
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
        router.replace('/(tabs)');
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

          {/* CARD */}
          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>

            {/* EMAIL */}
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
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

            {/* FORGOT PASSWORD */}
            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* SIGN IN BUTTON */}
            <TouchableOpacity
              style={[styles.signInBtn, loading && { opacity: 0.7 }]}
              onPress={signIn}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.signInText}>Sign In</Text>}
            </TouchableOpacity>

            {/* OR CONTINUE WITH */}
            <Text style={styles.orText}>Or continue with</Text>

            {/* SOCIAL BUTTONS */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn}>
                <Text style={styles.socialIcon}>🌐</Text>
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn}>
                <Text style={styles.socialIcon}>📘</Text>
                <Text style={styles.socialText}>Facebook</Text>
              </TouchableOpacity>
            </View>

            {/* SIGN UP LINK */}
            <View style={styles.signUpRow}>
              <Text style={styles.signUpGray}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24, fontWeight: 'bold',
    color: '#2E1A06', textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 13, color: '#555',
    marginBottom: 6, marginTop: 4,
  },
  inputBox: {
    backgroundColor: '#FDF5E0',
    borderRadius: 12,
    marginBottom: 12,
    height: 50,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14, color: '#333',
    paddingHorizontal: 16, height: '100%',
  },
  forgotRow: { alignItems: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#F25C05', fontSize: 13 },
  signInBtn: {
    backgroundColor: '#F25C05',
    borderRadius: 30,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signInText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  orText: {
    textAlign: 'center', color: '#C07A20',
    fontSize: 13, marginBottom: 14,
  },
  socialRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E8D8A0',
    borderRadius: 30, height: 46,
    backgroundColor: '#fff',
  },
  socialIcon: { fontSize: 18 },
  socialText: { fontSize: 14, color: '#333', fontWeight: '500' },
  signUpRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  signUpGray: { fontSize: 13, color: '#888' },
  signUpLink: { fontSize: 13, color: '#F25C05', fontWeight: 'bold' },
});