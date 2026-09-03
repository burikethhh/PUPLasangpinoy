import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, getProfile, logOut, sendFirebaseUserVerification } from "../../lib/firebase";
import { friendlyFirestoreError } from "../../lib/firebase-helpers";
import { generateEmailCode, verifyEmailCode } from "../../lib/firebase-store";
import { createLogger } from "../../lib/logger";

const log = createLogger("VerifyEmail");

export default function VerifyEmailScreen() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [generatedCode, setGeneratedCode] = useState("");
  const [sendError, setSendError] = useState("");
  const [continuing, setContinuing] = useState(false);
  // Firebase email-link is the primary flow: it needs no Firestore writes,
  // so verification works even if the deployed security rules are outdated.
  // The 6-digit code remains as a fallback.
  const [useFirebaseEmail, setUseFirebaseEmail] = useState(true);
  const [sent, setSent] = useState(false);
  const user = getCurrentUser();
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/welcome" as any);
      return;
    }
    if (user.emailVerified) {
      setVerified(true);
      return;
    }
    // Primary flow: send the Firebase verification link automatically.
    sendLink(true);

    // Poll for email verification status (covers link taps outside the app)
    const interval = setInterval(async () => {
      try {
        await user.reload();
        if (user.emailVerified) {
          setVerified(true);
          clearInterval(interval);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Primary flow: Firebase email-link verification (no Firestore needed).
  async function sendLink(auto = false) {
    if (!user) return;
    log.info("Sending Firebase email verification", { email: user.email, auto });
    setSending(true);
    setSendError("");
    try {
      await sendFirebaseUserVerification(user);
      setSent(true);
      setCountdown(60);
      log.info("Firebase verification email sent", { email: user.email });
      if (!auto) {
        Alert.alert("Email Sent", "A verification link has been sent to your email. Tap the link, then return here — this screen updates automatically.");
      }
    } catch (e: any) {
      log.warn("Firebase email verification error", e);
      const msg = e?.code === "auth/too-many-requests"
        ? "Too many email requests. Please wait a few minutes, then tap Resend — or use the 6-digit code instead."
        : "Could not send the verification email. Check your connection and tap Resend — or use the 6-digit code instead.";
      setSendError(msg);
    }
    setSending(false);
  }

  async function tryFirebaseVerification() {
    return sendLink(false);
  }

  async function sendCode() {
    if (!user?.email) return;
    log.info("Sending verification code", { email: user.email });
    setSending(true);
    setSendError("");
    try {
      const code = await generateEmailCode(user.email);
      setGeneratedCode(code);
      setCodeSent(true);
      setCountdown(60);
      log.info("Verification code generated and sent", { email: user.email });
    } catch (e: any) {
      log.error("Failed to generate verification code", e);
      // Show an inline, friendly message (with retry) instead of a raw
      // Firestore error popup.
      setSendError(friendlyFirestoreError(e, "Failed to generate verification code."));
    }
    setSending(false);
  }

  async function verifyCode() {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      Alert.alert("Invalid Code", "Please enter the complete 6-digit code.");
      return;
    }
    if (!user?.email) return;
    log.info("Verifying code", { email: user.email });
    setLoading(true);
    try {
      const result = await verifyEmailCode(user.email, fullCode, user.uid);
      if (result) {
        log.info("Code verified successfully", { email: user.email });
        setVerified(true);
      } else {
        log.warn("Code verification failed", { email: user.email });
        Alert.alert("Incorrect Code", "The code you entered is incorrect or expired. Please try again.");
      }
    } catch (e: any) {
      log.error("Code verification error", e);
      Alert.alert("Error", friendlyFirestoreError(e, "Failed to verify code."));
    }
    setLoading(false);
  }

  function handleCodeChange(text: string, index: number) {
    if (text.length > 1) text = text.slice(-1);
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }
    if (text && index === 5) {
      const fullCode = newCode.join("");
      if (fullCode.length === 6) {
        verifyCode();
      }
    }
  }

  function handleKeyPress(e: any, index: number) {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleLogout() {
    await logOut();
    router.replace("/(auth)/welcome");
  }

  async function handleBackToSignIn() {
    await logOut();
    router.replace("/(auth)/login");
  }

  // Route verified users to their role's home instead of always
  // dumping everyone into the customer tabs.
  async function handleContinue() {
    const u = getCurrentUser();
    if (!u) { router.replace("/(auth)/welcome" as any); return; }
    setContinuing(true);
    try {
      const profile = await getProfile(u.uid);
      if (profile?.is_admin) router.replace("/(admin)" as any);
      else if (profile?.role === "staff") router.replace("/(staff)" as any);
      else router.replace("/(tabs)" as any);
    } catch {
      router.replace("/(tabs)" as any);
    }
    setContinuing(false);
  }

  if (verified) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle" size={64} color="#27AE60" />
          </View>
          <Text style={styles.title}>Email Verified!</Text>
          <Text style={styles.subtitle}>Your email has been verified successfully.</Text>
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} disabled={continuing}>
            {continuing ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueBtnText}>Continue</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Firebase Auth email verification mode
  if (useFirebaseEmail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-open-outline" size={64} color="#F25C05" />
          </View>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We&apos;ll send a verification link to{"\n"}
            <Text style={{ fontWeight: "bold", color: "#2E1A06" }}>{user?.email}</Text>
          </Text>
          <Text style={styles.hint}>
            Tap the button below, then check your email and tap the verification link.{"\n"}
            This screen will update automatically once verified.
          </Text>

          {sendError ? <Text style={styles.inlineError}>{sendError}</Text> : null}

          {sent ? (
            <View style={styles.sentBox}>
              <Ionicons name="mail-open" size={32} color="#27AE60" />
              <Text style={styles.sentText}>Verification email sent!</Text>
              <Text style={styles.sentSubtext}>Check your inbox and tap the verification link.</Text>
              <ActivityIndicator color="#F25C05" style={{ marginTop: 12 }} />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, sending && { opacity: 0.6 }]}
              onPress={tryFirebaseVerification} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send Verification Email</Text>}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.resendBtn, (sending || countdown > 0) && { opacity: 0.4 }]}
            onPress={tryFirebaseVerification} disabled={sending || countdown > 0}>
            <Text style={styles.resendBtnText}>
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend Email"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Use a different account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => { setUseFirebaseEmail(false); setSendError(""); }}>
            <Text style={styles.switchModeBtnText}>Use 6-digit code instead</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLoginBtn} onPress={handleBackToSignIn}>
            <Text style={styles.backLoginBtnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Code-based verification mode (fallback)
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-open-outline" size={64} color="#F25C05" />
        </View>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We&apos;ll send a verification code to{"\n"}
          <Text style={{ fontWeight: "bold", color: "#2E1A06" }}>{user?.email}</Text>
        </Text>
        <Text style={styles.hint}>
          Enter the 6-digit code to verify your email and proceed.
        </Text>

        {generatedCode ? (
          <View style={{ backgroundColor: "#FFF3E0", borderRadius: 12, padding: 12, marginTop: 12, width: "100%" }}>
            <Text style={{ fontSize: 11, color: "#E67E22", fontWeight: "600" }}>Your verification code:</Text>
            <Text style={{ fontSize: 28, fontWeight: "bold", color: "#F25C05", letterSpacing: 8, textAlign: "center", marginTop: 4 }}>{generatedCode}</Text>
          </View>
        ) : null}

        {!codeSent ? (
          <>
            <TouchableOpacity
              style={[styles.sendBtn, sending && { opacity: 0.6 }]}
              onPress={sendCode} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send Verification Code</Text>}
            </TouchableOpacity>
            {sendError ? <Text style={styles.inlineError}>{sendError}</Text> : null}
          </>
        ) : (
          <>
            <View style={styles.codeRow}>
              {code.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { inputs.current[i] = r; }}
                  style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
                  value={digit}
                  onChangeText={(t) => handleCodeChange(t, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.verifyBtn, loading && { opacity: 0.6 }]}
              onPress={verifyCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyBtnText}>Verify Code</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendBtn, (sending || countdown > 0) && { opacity: 0.4 }]}
              onPress={sendCode} disabled={sending || countdown > 0}>
              <Text style={styles.resendBtnText}>
                {countdown > 0 ? `Resend code in ${countdown}s` : "Resend Code"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Use a different account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.switchModeBtn}
          onPress={() => { setUseFirebaseEmail(true); setSendError(""); }}>
          <Text style={styles.switchModeBtnText}>Use email link instead</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLoginBtn} onPress={handleBackToSignIn}>
          <Text style={styles.backLoginBtnText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC", justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: "#fff", borderRadius: 24, padding: 28, alignItems: "center",
    elevation: 4,
  },
  iconCircle: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#2E1A06", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#888", textAlign: "center", marginTop: 8 },
  hint: { fontSize: 13, color: "#aaa", textAlign: "center", marginTop: 12, lineHeight: 20 },
  sendBtn: {
    backgroundColor: "#F25C05", borderRadius: 30, height: 52, width: "100%",
    justifyContent: "center", alignItems: "center", marginTop: 24,
  },
  sendBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  sentBox: {
    alignItems: "center", marginTop: 24, padding: 16, backgroundColor: "#E8F8F0",
    borderRadius: 16, width: "100%",
  },
  sentText: { fontSize: 16, fontWeight: "bold", color: "#27AE60", marginTop: 8 },
  sentSubtext: { fontSize: 13, color: "#888", textAlign: "center", marginTop: 4 },
  codeRow: {
    flexDirection: "row", gap: 10, marginTop: 24, justifyContent: "center",
  },
  codeInput: {
    width: 48, height: 56, borderWidth: 2, borderColor: "#ddd", borderRadius: 12,
    fontSize: 24, fontWeight: "bold", color: "#2E1A06", textAlign: "center",
    backgroundColor: "#F9F5EF",
  },
  codeInputFilled: {
    borderColor: "#F25C05", backgroundColor: "#FEF3EC",
  },
  verifyBtn: {
    backgroundColor: "#27AE60", borderRadius: 30, height: 52, width: "100%",
    justifyContent: "center", alignItems: "center", marginTop: 24,
  },
  verifyBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  resendBtn: {
    borderRadius: 30, height: 44, width: "100%",
    justifyContent: "center", alignItems: "center", marginTop: 12,
  },
  resendBtnText: { color: "#F25C05", fontSize: 14, fontWeight: "600" },
  logoutBtn: { marginTop: 16, padding: 8 },
  logoutBtnText: { color: "#888", fontSize: 13, textDecorationLine: "underline" },
  backLoginBtn: {
    marginTop: 4, padding: 10, borderRadius: 20,
    backgroundColor: "#F25C0515", borderWidth: 1, borderColor: "#F25C0540",
    width: "100%", alignItems: "center",
  },
  backLoginBtnText: { color: "#F25C05", fontSize: 14, fontWeight: "600" },
  switchModeBtn: { marginTop: 4, padding: 8 },
  switchModeBtnText: { color: "#3498DB", fontSize: 13, textDecorationLine: "underline" },
  inlineError: {
    color: "#D92614", fontSize: 12, textAlign: "center",
    marginTop: 12, lineHeight: 18, paddingHorizontal: 8,
  },
  continueBtn: {
    backgroundColor: "#27AE60", borderRadius: 30, height: 52, width: "100%",
    justifyContent: "center", alignItems: "center", marginTop: 24,
  },
  continueBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
