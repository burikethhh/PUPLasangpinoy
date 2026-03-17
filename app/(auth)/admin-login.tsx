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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email.';
    }
    if (!password.trim()) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function signIn() {
    if (!validate()) return;
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
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#2E1A06" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {/* ICON */}
            <View style={styles.iconBox}>
              <Ionicons name="settings" size={32} color="#2E1A06" />
            </View>

            <Text style={styles.title}>Admin Portal</Text>
            <Text style={styles.subtitle}>
              Sign in with your admin credentials
            </Text>

            {/* EMAIL */}
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputBox,
              errors.email && styles.inputBoxError]}>
              <Ionicons name="mail-outline" size={18} color="#aaa"
                style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="admin@email.com"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {errors.email ? (
              <Text style={styles.errorText}>⚠ {errors.email}</Text>
            ) : null}

            {/* PASSWORD */}
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputBox,
              errors.password && styles.inputBoxError]}>
              <Ionicons name="lock-closed-outline" size={18} color="#aaa"
                style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
            {errors.password ? (
              <Text style={styles.errorText}>⚠ {errors.password}</Text>
            ) : null}

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
  backBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 16,
  },
  backText: { fontSize: 14, color: '#F25C05', fontWeight: '500' },
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
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FDF5E0', borderRadius: 12,
    marginBottom: 4, height: 50,
    borderWidth: 1, borderColor: 'transparent',
  },
  inputBoxError: {
    borderColor: '#D92614', backgroundColor: '#FFF5F5',
  },
  inputIcon: { marginLeft: 14 },
  input: {
    flex: 1, fontSize: 14, color: '#333',
    paddingHorizontal: 10, height: '100%',
  },
  eyeBtn: { paddingHorizontal: 14 },
  errorText: {
    color: '#D92614', fontSize: 11,
    marginBottom: 8, marginLeft: 4,
  },
  signInBtn: {
    backgroundColor: '#2E1A06', borderRadius: 30,
    height: 52, justifyContent: 'center', alignItems: 'center',
  },
  signInText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});