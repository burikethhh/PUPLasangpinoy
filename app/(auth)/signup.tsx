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
import { signUp, getProfile, verifyEmail } from '../../lib/firebase';

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  function validate() {
    const newErrors: {
      displayName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required.';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters.';
    }

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

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignUp() {
    if (!validate()) return;
    setLoading(true);
    
    try {
      const username = displayName.trim();
      const userCredential = await signUp(email, password, username);
      
      // Send verification email (non-blocking — don't wait or fail on this)
      verifyEmail().catch(e => console.log('[Auth] Verification email skipped:', e.message));
      
      // User is already authenticated after signUp — redirect directly
      const profile = await getProfile(userCredential.user.uid);
      if (profile?.is_admin) {
        router.replace('/(admin)');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak. Please use a stronger password.';
      }
      Alert.alert('Sign Up Failed', message);
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
              onPress={() => router.push('/(auth)/welcome')}
              style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#2E1A06" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Create Account</Text>

            {/* DISPLAY NAME */}
            <Text style={styles.label}>Display Name</Text>
            <View style={[styles.inputBox,
              errors.displayName && styles.inputBoxError]}>
              <Ionicons name="person-outline" size={18} color="#aaa"
                style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#aaa"
                value={displayName}
                onChangeText={(v) => {
                  setDisplayName(v);
                  if (errors.displayName) setErrors(prev => ({ ...prev, displayName: undefined }));
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            {errors.displayName ? (
              <Text style={styles.errorText}>{errors.displayName}</Text>
            ) : null}

            {/* EMAIL */}
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputBox,
              errors.email && styles.inputBoxError]}>
              <Ionicons name="mail-outline" size={18} color="#aaa"
                style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
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
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}

            {/* PASSWORD */}
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputBox,
              errors.password && styles.inputBoxError]}>
              <Ionicons name="lock-closed-outline" size={18} color="#aaa"
                style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
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
              <Text style={styles.errorText}>{errors.password}</Text>
            ) : null}

            {/* CONFIRM PASSWORD */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputBox,
              errors.confirmPassword && styles.inputBoxError]}>
              <Ionicons name="lock-closed-outline" size={18} color="#aaa"
                style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor="#aaa"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: undefined }));
                }}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeBtn}>
                <Ionicons
                  name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            ) : null}

            <View style={{ height: 20 }} />

            {/* SIGN UP BUTTON */}
            <TouchableOpacity
              style={[styles.signUpBtn, loading && { opacity: 0.7 }]}
              onPress={handleSignUp}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.signUpText}>Sign Up</Text>}
            </TouchableOpacity>

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
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    elevation: 4,
    // @ts-ignore - web shadow
    boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 16,
  },
  backText: { fontSize: 14, color: '#F25C05', fontWeight: '500' },
  title: {
    fontSize: 24, fontWeight: 'bold',
    color: '#2E1A06', textAlign: 'center', marginBottom: 24,
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
  signUpBtn: {
    backgroundColor: '#F25C05', borderRadius: 30,
    height: 52, justifyContent: 'center',
    alignItems: 'center', marginBottom: 20,
  },
  signUpText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  signInRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  signInGray: { fontSize: 13, color: '#888' },
  signInLink: { fontSize: 13, color: '#F25C05', fontWeight: 'bold' },
});
