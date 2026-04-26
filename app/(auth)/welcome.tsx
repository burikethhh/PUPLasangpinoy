import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
    getRedirectResult,
    signInWithPopup,
    signInWithRedirect,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    auth,
    facebookProvider,
    getProfile,
    googleProvider,
    resetPassword,
    setRestTokenFromUser,
    signIn,
} from "../../lib/firebase";

export default function WelcomeScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleAuthSuccess = useCallback(async (userId: string) => {
    const profile = await getProfile(userId);
    if (profile?.is_admin) {
      router.replace("/(admin)");
    } else if (profile?.role === "staff") {
      router.replace("/(staff)" as any);
    } else {
      router.replace("/(tabs)");
    }
  }, []);

  const checkRedirectResult = useCallback(async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        await setRestTokenFromUser(result.user);
        await handleAuthSuccess(result.user.uid);
      }
    } catch (error: any) {
      console.error("Redirect result error:", error);
    }
  }, [handleAuthSuccess]);

  useEffect(() => { checkRedirectResult(); }, [checkRedirectResult]);

  function validate() {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Please enter a valid email.";
    if (!password.trim()) newErrors.password = "Password is required.";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignIn() {
    if (!validate()) return;
    setLoading(true);
    try {
      const userCredential = await signIn(email, password);
      await handleAuthSuccess(userCredential.user.uid);
    } catch (error: any) {
      let message = error.message;
      if (error.code === "auth/user-not-found") message = "No account found with this email.";
      else if (error.code === "auth/wrong-password") message = "Incorrect password.";
      else if (error.code === "auth/invalid-email") message = "Invalid email address.";
      else if (error.code === "auth/too-many-requests") message = "Too many failed attempts. Please try again later.";
      else if (error.code === "auth/invalid-credential") message = "Invalid email or password.";
      Alert.alert("Sign In Failed", message);
    }
    setLoading(false);
  }

  async function signInWithGoogle() {
    setSocialLoading("google");
    try {
      if (Platform.OS === "web") {
        const result = await signInWithPopup(auth, googleProvider);
        await setRestTokenFromUser(result.user);
        await handleAuthSuccess(result.user.uid);
      } else {
        await signInWithRedirect(auth, googleProvider);
      }
    } catch (error: any) {
      Alert.alert("Google Sign In Failed", error.message || "Failed to sign in with Google");
    }
    setSocialLoading(null);
  }

  async function signInWithFacebook() {
    setSocialLoading("facebook");
    try {
      if (Platform.OS === "web") {
        const result = await signInWithPopup(auth, facebookProvider);
        await setRestTokenFromUser(result.user);
        await handleAuthSuccess(result.user.uid);
      } else {
        await signInWithRedirect(auth, facebookProvider);
      }
    } catch (error: any) {
      Alert.alert("Facebook Sign In Failed", error.message || "Failed to sign in with Facebook");
    }
    setSocialLoading(null);
  }

  async function sendResetEmail() {
    if (!resetEmail.trim()) { Alert.alert("Email Required", "Please enter your email address."); return; }
    if (!/\S+@\S+\.\S+/.test(resetEmail)) { Alert.alert("Invalid Email", "Please enter a valid email address."); return; }
    setResetLoading(true);
    try { await resetPassword(resetEmail); setResetSent(true); }
    catch (error: any) {
      let message = error.message;
      if (error.code === "auth/user-not-found") message = "No account found with this email.";
      Alert.alert("Error", message);
    }
    setResetLoading(false);
  }

  function closeForgotModal() { setForgotModalVisible(false); setResetEmail(""); setResetSent(false); }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* LOGO */}
          <View style={styles.logoBox}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🍽️</Text>
            </View>
            <Text style={styles.appName}>FOODFIX</Text>
            <Text style={styles.appSub}>Filipino Food Ordering System</Text>
          </View>

          {/* LOGIN CARD */}
          <View style={styles.card}>
            <Text style={styles.title}>Sign In</Text>

            {/* EMAIL */}
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputBox, errors.email && styles.inputBoxError]}>
              <Ionicons name="mail-outline" size={18} color="#aaa" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor="#aaa"
                value={email} onChangeText={(v) => { setEmail(v); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            {/* PASSWORD */}
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputBox, errors.password && styles.inputBoxError]}>
              <Ionicons name="lock-closed-outline" size={18} color="#aaa" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#aaa"
                value={password} onChangeText={(v) => { setPassword(v); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <TouchableOpacity style={styles.forgotRow} onPress={() => { setResetEmail(email); setForgotModalVisible(true); }}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* SIGN IN */}
            <TouchableOpacity style={[styles.signInBtn, loading && { opacity: 0.7 }]} onPress={handleSignIn} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInText}>Sign In</Text>}
            </TouchableOpacity>

            <Text style={styles.orText}>Or continue with</Text>

            {/* SOCIAL */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={[styles.socialBtn, styles.googleBtn]} onPress={signInWithGoogle} disabled={socialLoading !== null}>
                {socialLoading === "google" ? <ActivityIndicator color="#EA4335" size="small" /> : (
                  <><View style={styles.googleIcon}><Text style={{ fontSize: 16, fontWeight: "bold" }}>G</Text></View>
                  <Text style={styles.socialText}>Google</Text></>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialBtn, styles.facebookBtn]} onPress={signInWithFacebook} disabled={socialLoading !== null}>
                {socialLoading === "facebook" ? <ActivityIndicator color="#1877F2" size="small" /> : (
                  <><Ionicons name="logo-facebook" size={20} color="#1877F2" />
                  <Text style={styles.socialText}>Facebook</Text></>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.signUpRow}>
              <Text style={styles.signUpGray}>Don{"'"}t have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footer}>FOODFIX  2026</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FORGOT PASSWORD MODAL */}
      <Modal visible={forgotModalVisible} animationType="fade" transparent onRequestClose={closeForgotModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalClose} onPress={closeForgotModal}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
            {!resetSent ? (
              <>
                <View style={styles.modalIconBox}><Ionicons name="key-outline" size={32} color="#F25C05" /></View>
                <Text style={styles.modalTitle}>Forgot Password?</Text>
                <Text style={styles.modalSubtitle}>Enter your email and we{"'"}ll send you a reset link.</Text>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={18} color="#aaa" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor="#aaa"
                    value={resetEmail} onChangeText={setResetEmail} keyboardType="email-address" autoCapitalize="none" />
                </View>
                <TouchableOpacity style={[styles.signInBtn, { marginTop: 16 }, resetLoading && { opacity: 0.7 }]}
                  onPress={sendResetEmail} disabled={resetLoading}>
                  {resetLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInText}>Send Reset Link</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeForgotModal}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.modalIconBox, { backgroundColor: "#34B36A22" }]}>
                  <Ionicons name="checkmark-circle" size={40} color="#34B36A" />
                </View>
                <Text style={styles.modalTitle}>Check Your Email</Text>
                <Text style={styles.modalSubtitle}>
                  We{"'"}ve sent a password reset link to:{"\n"}
                  <Text style={{ fontWeight: "bold", color: "#2E1A06" }}>{resetEmail}</Text>
                </Text>
                <TouchableOpacity style={[styles.signInBtn, { marginTop: 16 }]} onPress={closeForgotModal}>
                  <Text style={styles.signInText}>Back to Login</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setResetSent(false)}>
                  <Text style={styles.cancelText}>Try a different email</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoBox: { alignItems: "center", marginBottom: 16 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#F25C05",
    justifyContent: "center", alignItems: "center", marginBottom: 10, elevation: 6,
    // @ts-ignore
    boxShadow: "0px 4px 10px rgba(242, 92, 5, 0.3)",
  },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: 26, fontWeight: "bold", color: "#2E1A06" },
  appSub: { fontSize: 12, color: "#C07A20", marginTop: 2 },
  card: {
    backgroundColor: "#fff", borderRadius: 24, padding: 28, elevation: 4,
    // @ts-ignore
    boxShadow: "0px 2px 12px rgba(0, 0, 0, 0.08)",
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#2E1A06", textAlign: "center", marginBottom: 20 },
  label: { fontSize: 13, color: "#555", marginBottom: 6, marginTop: 4 },
  inputBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FDF5E0",
    borderRadius: 12, marginBottom: 4, height: 50, borderWidth: 1, borderColor: "transparent",
  },
  inputBoxError: { borderColor: "#D92614", backgroundColor: "#FFF5F5" },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, fontSize: 14, color: "#333", paddingHorizontal: 10, height: "100%" },
  eyeBtn: { paddingHorizontal: 14 },
  errorText: { color: "#D92614", fontSize: 11, marginBottom: 8, marginLeft: 4 },
  forgotRow: { alignItems: "flex-end", marginBottom: 20, marginTop: 8 },
  forgotText: { color: "#F25C05", fontSize: 13, fontWeight: "500" },
  signInBtn: {
    backgroundColor: "#F25C05", borderRadius: 30, height: 52,
    justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  signInText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  orText: { textAlign: "center", color: "#C07A20", fontSize: 13, marginBottom: 14 },
  socialRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  socialBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1.5, borderColor: "#E8D8A0", borderRadius: 30, height: 46, backgroundColor: "#fff",
  },
  googleBtn: { borderColor: "#EA433533" },
  facebookBtn: { borderColor: "#1877F233" },
  googleIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  socialText: { fontSize: 14, color: "#333", fontWeight: "500" },
  signUpRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  signUpGray: { fontSize: 13, color: "#888" },
  signUpLink: { fontSize: 13, color: "#F25C05", fontWeight: "bold" },
  footer: { textAlign: "center", color: "#bbb", fontSize: 11, marginTop: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 24, padding: 28, width: "100%", maxWidth: 400 },
  modalClose: { position: "absolute", top: 16, right: 16, zIndex: 10 },
  modalIconBox: {
    width: 70, height: 70, borderRadius: 20, backgroundColor: "#F25C0522",
    justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: "#2E1A06", textAlign: "center", marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: "#888", fontSize: 14 },
});
