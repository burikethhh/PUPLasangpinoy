import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator, Alert, Modal, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, getCurrentUser } from "../../lib/firebase";
import { analyzeImageWithQwen, type NutritionInfo, type ScanResult } from "../../lib/qwen-ai";

export default function SubmitDishScreen() {
  const [step, setStep] = useState(1);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [dishName, setDishName] = useState("");
  const [originalAiName, setOriginalAiName] = useState("");
  const [notes, setNotes] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  function resetAll() {
    setStep(1);
    setScanImage(null);
    setScanResult(null);
    setScanning(false);
    setScanError(null);
    setDishName("");
    setOriginalAiName("");
    setNotes("");
    setNameEdited(false);
    setShowForm(false);
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Gallery access is needed to select a food image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7, base64: true });
    if (result.canceled) return;
    await analyzeImage(result.assets[0]);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera access is needed to scan food.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7, base64: true });
    if (result.canceled) return;
    await analyzeImage(result.assets[0]);
  }

  async function analyzeImage(asset: ImagePicker.ImagePickerAsset) {
    const base64 = asset.base64 || "";
    if (!base64) { setScanError("Could not read image data."); return; }
    setScanImage(asset.uri);
    setScanError(null);
    setScanResult(null);
    setScanning(true);
    try {
      const result = await analyzeImageWithQwen(base64, "dish");
      if (result.type === "dish" && result.dishName) {
        setScanResult(result);
        setDishName(result.dishName);
        setOriginalAiName(result.dishName);
        setNameEdited(false);
        setStep(2);
      } else {
        setScanError("Could not identify a dish in this image. Try a clearer photo.");
      }
    } catch (e: any) {
      setScanError(e.message || "AI scan failed. Try again.");
    }
    setScanning(false);
  }

  async function handleSubmit() {
    if (!dishName.trim()) { Alert.alert("Missing", "Please enter a dish name."); return; }
    const user = getCurrentUser();
    if (!user) { Alert.alert("Error", "You must be logged in to submit."); return; }
    setSubmitting(true);
    try {
      const suggestion = {
        name: dishName.trim(),
        original_ai_name: nameEdited ? originalAiName : "",
        description: notes.trim(),
        category: "suggestion",
        user_id: user.uid,
        user_email: user.email || "",
        user_name: user.displayName || "",
        status: "pending",
        nutrition: scanResult?.nutrition || {},
        created_at: serverTimestamp(),
      };
      await addDoc(collection(db, "menu_suggestions"), suggestion);
      setShowForm(false);
      setStep(5);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to submit suggestion.");
    }
    setSubmitting(false);
  }

  function formatNutrition(n: NutritionInfo | undefined): string {
    if (!n) return "";
    const parts: string[] = [];
    if (n.calories) parts.push(`Cal: ${n.calories}`);
    if (n.protein) parts.push(`P: ${n.protein}`);
    if (n.carbs) parts.push(`C: ${n.carbs}`);
    if (n.fat) parts.push(`F: ${n.fat}`);
    return parts.join(" · ");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (step === 5) resetAll(); else router.back(); }}>
          <Ionicons name="arrow-back" size={24} color="#2E1A06" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submit a Dish</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step indicator */}
        <View style={styles.stepRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
            </View>
          ))}
        </View>

        {/* Step 1: Food scan or photo upload */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Step 1: Take or Upload a Photo</Text>
            <Text style={styles.stepDesc}>Take a photo of the dish you want to suggest, or pick one from your gallery.</Text>

            {scanImage && (
              <View style={styles.previewWrap}>
                <Text style={styles.previewLabel}>Selected Image:</Text>
                <View style={styles.previewBox}>
                  <Text style={styles.previewPlaceholder}>Image selected ✓</Text>
                </View>
              </View>
            )}

            {scanError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#E74C3C" />
                <Text style={styles.errorText}>{scanError}</Text>
              </View>
            )}

            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={takePhoto}>
                <Ionicons name="camera" size={22} color="#fff" />
                <Text style={styles.uploadBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: "#3498DB" }]} onPress={pickImage}>
                <Ionicons name="images" size={22} color="#fff" />
                <Text style={styles.uploadBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {scanError && (
              <TouchableOpacity style={styles.retryBtn} onPress={() => setScanError(null)}>
                <Text style={styles.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
            )}

            {scanning && (
              <View style={styles.scanningBox}>
                <ActivityIndicator size="large" color="#F25C05" />
                <Text style={styles.scanningText}>Analyzing image...</Text>
              </View>
            )}
          </View>
        )}

        {/* Step 2: Show scan result and info */}
        {step === 2 && scanResult && (
          <View>
            <Text style={styles.stepTitle}>Dish Identified</Text>
            <Text style={styles.dishName}>{scanResult.dishName}</Text>

            {scanResult.nutrition && (
              <View style={styles.nutritionCard}>
                <Text style={styles.nutritionTitle}>Nutrition (per serving)</Text>
                <Text style={styles.nutritionText}>{formatNutrition(scanResult.nutrition)}</Text>
                {scanResult.nutrition.calories && <Text style={styles.nutritionDetail}>Calories: {scanResult.nutrition.calories}</Text>}
                {scanResult.nutrition.protein && <Text style={styles.nutritionDetail}>Protein: {scanResult.nutrition.protein}</Text>}
                {scanResult.nutrition.carbs && <Text style={styles.nutritionDetail}>Carbs: {scanResult.nutrition.carbs}</Text>}
                {scanResult.nutrition.fat && <Text style={styles.nutritionDetail}>Fat: {scanResult.nutrition.fat}</Text>}
                {scanResult.nutrition.fiber && <Text style={styles.nutritionDetail}>Fiber: {scanResult.nutrition.fiber}</Text>}
                {scanResult.nutrition.sodium && <Text style={styles.nutritionDetail}>Sodium: {scanResult.nutrition.sodium}</Text>}
              </View>
            )}

            {scanResult.description && (
              <Text style={styles.dishDesc}>{scanResult.description}</Text>
            )}

            <TouchableOpacity style={styles.continueBtn} onPress={() => setStep(3)}>
              <Text style={styles.continueBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Info + Submit button */}
        {step === 3 && (
          <View>
            <View style={styles.infoCard}>
              <Text style={styles.stepTitle}>Almost Done!</Text>
              <Text style={styles.stepDesc}>
                Submitting a dish suggests it to Derick Food House for menu inclusion. The owner will review your suggestion and may add it to the menu.
              </Text>
            </View>

            <TouchableOpacity style={styles.infoBtn} onPress={() => setShowInfo(true)}>
              <Ionicons name="information-circle" size={20} color="#F25C05" />
              <Text style={styles.infoBtnText}>How it works</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitMainBtn} onPress={() => setStep(4)}>
              <Ionicons name="restaurant" size={20} color="#fff" />
              <Text style={styles.submitMainBtnText}>Submit Dish to Derick Food House</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 5: Success */}
        {step === 5 && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={64} color="#27AE60" />
            <Text style={styles.successTitle}>Thank You!</Text>
            <Text style={styles.successDesc}>
              Your dish suggestion has been submitted successfully! The owner will review it and you can monitor the status in &quot;Submitted Dishes&quot; (Coming Soon).
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={resetAll}>
              <Text style={styles.doneBtnText}>Submit Another Dish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Info Modal */}
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <View style={styles.overlay}>
          <View style={styles.infoModal}>
            <Ionicons name="information-circle" size={40} color="#F25C05" style={{ marginBottom: 12 }} />
            <Text style={styles.infoModalTitle}>How It Works</Text>
            <Text style={styles.infoModalText}>
              1. Submit a dish suggestion with photo, name, and notes.{'\n'}{'\n'}
              2. Derick Food House owner reviews your suggestion.{'\n'}{'\n'}
              3. If approved, the dish may be added to the menu.{'\n'}{'\n'}
              4. You can track the status of your submissions in &quot;Submitted Dishes&quot;.
            </Text>
            <TouchableOpacity style={styles.infoModalBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.infoModalBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Step 4: Submission form (pop-up overlay) */}
      {step === 4 && (
        <View style={styles.overlay}>
          <View style={styles.formModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formTitle}>Submit Your Dish</Text>
              <Text style={styles.formSub}>Suggest this dish to Derick Food House</Text>

              <Text style={styles.fieldLabel}>Dish Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={dishName}
                onChangeText={(v) => {
                  setDishName(v);
                  if (v !== originalAiName && !nameEdited) setNameEdited(true);
                  if (v === originalAiName) setNameEdited(false);
                }}
                placeholder="Enter dish name"
                placeholderTextColor="#aaa"
              />

              {nameEdited && originalAiName && (
                <View style={styles.editedToggle}>
                  <Ionicons name="pencil" size={14} color="#F25C05" />
                  <Text style={styles.editedToggleText}>
                    Name was edited. See original: &quot;{originalAiName}&quot;
                  </Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMultiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any notes or comments about this dish..."
                placeholderTextColor="#aaa"
                multiline
              />

              {scanResult?.nutrition && (
                <View style={styles.formNutrition}>
                  <Text style={styles.formNutritionTitle}>Nutrition Info (from scan)</Text>
                  <Text style={styles.formNutritionText}>{formatNutrition(scanResult.nutrition)}</Text>
                </View>
              )}

              <View style={styles.formBtns}>
                <TouchableOpacity style={styles.formCancel} onPress={() => setStep(3)}>
                  <Text style={styles.formCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formSubmit, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting || !dishName.trim()}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.formSubmitText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8D8A0",
  },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: "#2E1A06" },
  content: { padding: 20, paddingBottom: 40 },
  stepRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 24 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff",
    borderWidth: 2, borderColor: "#E8D8A0", justifyContent: "center", alignItems: "center",
  },
  stepDotActive: { backgroundColor: "#F25C05", borderColor: "#F25C05" },
  stepDotText: { fontSize: 13, fontWeight: "bold", color: "#ccc" },
  stepDotTextActive: { color: "#fff" },
  stepTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06", marginBottom: 8 },
  stepDesc: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 16 },
  previewWrap: { marginBottom: 16 },
  previewLabel: { fontSize: 12, color: "#888", fontWeight: "600", marginBottom: 6 },
  previewBox: {
    backgroundColor: "#E8F8F0", borderRadius: 12, padding: 16,
    alignItems: "center", borderWidth: 1, borderColor: "#A3D9B1",
  },
  previewPlaceholder: { fontSize: 14, color: "#27AE60", fontWeight: "600" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFF5F5", borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: "#E74C3C" },
  uploadRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  uploadBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#F25C05", borderRadius: 14, padding: 16,
  },
  uploadBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  retryBtn: {
    alignSelf: "center", paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#F25C05",
  },
  retryBtnText: { color: "#F25C05", fontWeight: "bold", fontSize: 13 },
  scanningBox: { alignItems: "center", padding: 24, gap: 12 },
  scanningText: { fontSize: 14, color: "#888" },
  dishName: { fontSize: 22, fontWeight: "bold", color: "#2E1A06", marginBottom: 12 },
  dishDesc: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 16 },
  nutritionCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#E8D8A0",
  },
  nutritionTitle: { fontSize: 13, fontWeight: "bold", color: "#2E1A06", marginBottom: 6 },
  nutritionText: { fontSize: 12, color: "#888", marginBottom: 8 },
  nutritionDetail: { fontSize: 13, color: "#555", marginBottom: 2 },
  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#F25C05", borderRadius: 14, padding: 16,
  },
  continueBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  infoCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#E8D8A0",
  },
  infoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 14, marginBottom: 20, backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1.5, borderColor: "#F25C05",
  },
  infoBtnText: { color: "#F25C05", fontWeight: "bold", fontSize: 14 },
  submitMainBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#F25C05", borderRadius: 14, padding: 18,
    elevation: 3,
  },
  submitMainBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  successBox: { alignItems: "center", paddingTop: 40, gap: 12 },
  successTitle: { fontSize: 24, fontWeight: "bold", color: "#2E1A06" },
  successDesc: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  doneBtn: {
    backgroundColor: "#F25C05", borderRadius: 14, padding: 14, paddingHorizontal: 24, marginTop: 16,
  },
  doneBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  backBtn: { padding: 12, marginTop: 4 },
  backBtnText: { color: "#888", fontWeight: "600", fontSize: 13 },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center",
    zIndex: 999,
  },
  infoModal: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "85%", alignItems: "center",
  },
  infoModalTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06", marginBottom: 12 },
  infoModalText: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 16 },
  infoModalBtn: {
    backgroundColor: "#F25C05", borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12,
  },
  infoModalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  formModal: {
    backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "90%",
    maxHeight: "80%",
  },
  formTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06", marginBottom: 4 },
  formSub: { fontSize: 13, color: "#888", marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "bold", color: "#2E1A06", marginBottom: 6, marginTop: 12 },
  fieldInput: {
    backgroundColor: "#F9F5EF", borderRadius: 10, padding: 12, fontSize: 14, color: "#333",
  },
  fieldInputMultiline: { minHeight: 80, textAlignVertical: "top" },
  editedToggle: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF3EC", borderRadius: 8, padding: 10, marginTop: 8,
  },
  editedToggleText: { fontSize: 12, color: "#F25C05", flex: 1 },
  formNutrition: {
    backgroundColor: "#F0F8F0", borderRadius: 10, padding: 12, marginTop: 12,
  },
  formNutritionTitle: { fontSize: 12, fontWeight: "bold", color: "#2E1A06", marginBottom: 4 },
  formNutritionText: { fontSize: 12, color: "#555" },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  formCancel: {
    flex: 1, borderRadius: 12, padding: 14, alignItems: "center", backgroundColor: "#eee",
  },
  formCancelText: { color: "#888", fontWeight: "600", fontSize: 14 },
  formSubmit: {
    flex: 1, borderRadius: 12, padding: 14, alignItems: "center", backgroundColor: "#F25C05",
  },
  formSubmitText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
