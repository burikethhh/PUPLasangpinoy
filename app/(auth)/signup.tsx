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

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUp() {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    } else if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        username: email.split('@')[0],
        is_admin: false,
      });
      Alert.alert('Success!', 'Account created! Please sign in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') }
      ]);
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
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Create Account</Text>

            {/* EMAIL */}
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#bbb"
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
                placeholder="Enter your password"
                placeholderTextColor="#bbb"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {/* CONFIRM PASSWORD */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor="#bbb"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <View style={{ height: 24 }} />

            {/* SIGN UP BUTTON */}
            <TouchableOpacity
              style={[styles.signUpBtn, loading && { opacity: 0.7 }]}
              onPress={signUp}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.signUpText}>Sign Up</Text>}
            </TouchableOpacity>

            {/* SIGN IN LINK */}
            <View style={styles.signInRow}>
              <Text style={styles.signInGray}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.signInLink}>Sign In</Text>
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
  backBtn: { marginBottom: 8 },
  backText: { color: '#F25C05', fontSize: 14, fontWeight: '500' },
  title: {
    fontSize: 24, fontWeight: 'bold',
    color: '#2E1A06', textAlign: 'center',
    marginBottom: 24,
  },
  label: { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 4 },
  inputBox: {
    backgroundColor: '#FDF5E0',
    borderRadius: 12,
    marginBottom: 12,
    height: 52,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14, color: '#333',
    paddingHorizontal: 16, height: '100%',
  },
  signUpBtn: {
    backgroundColor: '#F25C05',
    borderRadius: 30,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signUpText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  signInRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  signInGray: { fontSize: 13, color: '#888' },
  signInLink: { fontSize: 13, color: '#F25C05', fontWeight: 'bold' },
});