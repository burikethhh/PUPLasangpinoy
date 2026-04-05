import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FOOD_CATEGORIES } from "../../constants/food-categories";
import {
    getCurrentUser,
    getProfile,
    getRegions,
    getUserSubmissions,
    RecipeSubmission,
    Region,
    submitRecipe,
    uploadRecipeImage,
} from "../../lib/firebase";

  const CATEGORIES = [...FOOD_CATEGORIES];

const STATUS_COLOR: Record<RecipeSubmission["status"], string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
};

const STATUS_ICON: Record<RecipeSubmission["status"], string> = {
  pending: "time-outline",
  approved: "checkmark-circle-outline",
  rejected: "close-circle-outline",
};

export default function SubmitScreen() {
  const [tab, setTab] = useState<"form" | "history">("form");
  const [regions, setRegions] = useState<Region[]>([]);
  const [submissions, setSubmissions] = useState<RecipeSubmission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    category: "",
    region: "",
    ingredients: "",
    instructions: "",
    nutrition: "",
    health_notes: "",
    history: "",
    fun_fact: "",
    image_url: "",
  });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  useFocusEffect(
    useCallback(() => {
      loadRegions();
      if (tab === "history") loadHistory();
    }, [tab]),
  );

  async function loadRegions() {
    try {
      const data = await getRegions();
      setRegions(data);
      if (data.length > 0 && !form.region) {
        setForm((f) => ({ ...f, region: data[0].name }));
      }
    } catch {}
  }

  async function loadHistory() {
    const user = getCurrentUser();
    if (!user) return;
    setLoadingHistory(true);
    try {
      const data = await getUserSubmissions(user.uid);
      setSubmissions(data);
    } catch (e) {
      console.error("Error loading submissions:", e);
    }
    setLoadingHistory(false);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  }

  function validate(): boolean {
    const newErrors: Partial<typeof form> = {};
    if (!form.title.trim()) newErrors.title = "Title is required";
    if (!form.category) newErrors.category = "Category is required";
    if (!form.ingredients.trim())
      newErrors.ingredients = "Ingredients are required";
    if (!form.instructions.trim())
      newErrors.instructions = "Instructions are required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    const user = getCurrentUser();
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to submit a recipe.");
      router.push("/(auth)/login");
      return;
    }

    if (!validate()) return;

    setSubmitting(true);
    try {
      let imageUrl = form.image_url;

      if (selectedImage) {
        setUploading(true);
        try {
          imageUrl = await uploadRecipeImage(selectedImage);
        } catch (uploadErr) {
          console.warn("Image upload failed, using local URI:", uploadErr);
          imageUrl = selectedImage;
        } finally {
          setUploading(false);
        }
      }

      const profile = await getProfile(user.uid);
      const username = profile?.username || user.email?.split("@")[0] || "User";

      await submitRecipe({
        user_id: user.uid,
        username,
        title: form.title.trim(),
        category: form.category,
        region: form.region,
        ingredients: form.ingredients.trim(),
        instructions: form.instructions.trim(),
        nutrition: form.nutrition.trim(),
        health_notes: form.health_notes.trim(),
        history: form.history.trim(),
        fun_fact: form.fun_fact.trim(),
        image_url: imageUrl,
      });

      Alert.alert(
        "Submitted! 🎉",
        "Your recipe has been sent for admin review. You'll see the status in My Submissions.",
        [{ text: "OK", onPress: resetForm }],
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit recipe.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      title: "",
      category: "",
      region: regions[0]?.name || "",
      ingredients: "",
      instructions: "",
      nutrition: "",
      health_notes: "",
      history: "",
      fun_fact: "",
      image_url: "",
    });
    setSelectedImage(null);
    setErrors({});
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Submit a Recipe</Text>
        <Text style={styles.headerSub}>Share your Filipino dish with the community</Text>
      </View>

      {/* TAB SWITCHER */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "form" && styles.tabBtnActive]}
          onPress={() => setTab("form")}
        >
          <Text style={[styles.tabText, tab === "form" && styles.tabTextActive]}>
            New Recipe
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]}
          onPress={() => {
            setTab("history");
            loadHistory();
          }}
        >
          <Text
            style={[styles.tabText, tab === "history" && styles.tabTextActive]}
          >
            My Submissions
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "form" ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* IMAGE */}
          <Text style={styles.sectionLabel}>Photo (optional)</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={32} color="#999" />
                <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* OR URL */}
          <TextInput
            style={styles.input}
            placeholder="Or paste an image URL"
            placeholderTextColor="#aaa"
            value={form.image_url}
            onChangeText={(v) => setField("image_url", v)}
            autoCapitalize="none"
          />

          {/* TITLE */}
          <Text style={styles.label}>
            Recipe Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            placeholder="e.g. Chicken Adobo"
            placeholderTextColor="#aaa"
            value={form.title}
            onChangeText={(v) => setField("title", v)}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

          {/* CATEGORY */}
          <Text style={styles.label}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, form.category === cat && styles.chipActive]}
                onPress={() => setField("category", cat)}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.category === cat && styles.chipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.category && (
            <Text style={styles.errorText}>{errors.category}</Text>
          )}

          {/* REGION */}
          <Text style={styles.label}>Region</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionScroll}>
            {regions.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.chip,
                  form.region === r.name && styles.chipActive,
                ]}
                onPress={() => setField("region", r.name)}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.region === r.name && styles.chipTextActive,
                  ]}
                >
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* INGREDIENTS */}
          <Text style={styles.label}>
            Ingredients <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.hint}>Separate with commas</Text>
          <TextInput
            style={[styles.textArea, errors.ingredients && styles.inputError]}
            placeholder="Chicken, soy sauce, vinegar, garlic..."
            placeholderTextColor="#aaa"
            value={form.ingredients}
            onChangeText={(v) => setField("ingredients", v)}
            multiline
            numberOfLines={3}
          />
          {errors.ingredients && (
            <Text style={styles.errorText}>{errors.ingredients}</Text>
          )}

          {/* INSTRUCTIONS */}
          <Text style={styles.label}>
            Instructions <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.textArea, errors.instructions && styles.inputError]}
            placeholder="1. Marinate chicken in soy sauce and vinegar for 30 minutes..."
            placeholderTextColor="#aaa"
            value={form.instructions}
            onChangeText={(v) => setField("instructions", v)}
            multiline
            numberOfLines={5}
          />
          {errors.instructions && (
            <Text style={styles.errorText}>{errors.instructions}</Text>
          )}

          {/* OPTIONAL FIELDS */}
          <Text style={styles.label}>Nutrition Info (optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Calories: 350kcal, Protein: 28g..."
            placeholderTextColor="#aaa"
            value={form.nutrition}
            onChangeText={(v) => setField("nutrition", v)}
            multiline
            numberOfLines={2}
          />

          <Text style={styles.label}>Health Notes (optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="High in protein. Good for..."
            placeholderTextColor="#aaa"
            value={form.health_notes}
            onChangeText={(v) => setField("health_notes", v)}
            multiline
            numberOfLines={2}
          />

          <Text style={styles.label}>History / Cultural Background (optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="This dish originates from..."
            placeholderTextColor="#aaa"
            value={form.history}
            onChangeText={(v) => setField("history", v)}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Fun Fact (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Did you know..."
            placeholderTextColor="#aaa"
            value={form.fun_fact}
            onChangeText={(v) => setField("fun_fact", v)}
          />

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || uploading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || uploading}
          >
            {submitting || uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Submit for Review</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.note}>
            Your recipe will be reviewed by our admin team before being published.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.historyScroll}
        >
          {loadingHistory ? (
            <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
          ) : submissions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={60} color="#ccc" />
              <Text style={styles.emptyTitle}>No submissions yet</Text>
              <Text style={styles.emptyText}>
                Switch to New Recipe tab to submit your first recipe!
              </Text>
            </View>
          ) : (
            submissions.map((sub) => (
              <View key={sub.id} style={styles.submissionCard}>
                <View style={styles.submissionRow}>
                  <View style={styles.submissionInfo}>
                    <Text style={styles.submissionTitle}>{sub.title}</Text>
                    <Text style={styles.submissionMeta}>
                      {sub.category} • {sub.region}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: STATUS_COLOR[sub.status] + "22" },
                    ]}
                  >
                    <Ionicons
                      name={STATUS_ICON[sub.status] as any}
                      size={14}
                      color={STATUS_COLOR[sub.status]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: STATUS_COLOR[sub.status] },
                      ]}
                    >
                      {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </Text>
                  </View>
                </View>
                {sub.status === "rejected" && sub.rejection_reason ? (
                  <Text style={styles.rejectionReason}>
                    Reason: {sub.rejection_reason}
                  </Text>
                ) : null}
                <Text style={styles.submissionDate}>
                  Submitted:{" "}
                  {new Date(
                    (sub.created_at as any)?.seconds
                      ? (sub.created_at as any).seconds * 1000
                      : sub.created_at as any,
                  ).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: {
    backgroundColor: "#F25C05",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "#fff", opacity: 0.85, marginTop: 2 },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8d0",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: "#F25C05" },
  tabText: { fontSize: 14, color: "#888", fontWeight: "500" },
  tabTextActive: { color: "#F25C05", fontWeight: "700" },

  formScroll: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 14,
    marginBottom: 4,
  },
  required: { color: "#F25C05" },
  hint: { fontSize: 11, color: "#888", marginBottom: 4 },

  imagePicker: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  imagePreview: { width: "100%", height: 180 },
  imagePlaceholder: {
    height: 120,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: { color: "#aaa", marginTop: 6, fontSize: 13 },

  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
  },
  inputError: { borderColor: "#EF4444" },
  textArea: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    textAlignVertical: "top",
    minHeight: 80,
  },
  errorText: { color: "#EF4444", fontSize: 12, marginTop: 2 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  regionScroll: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    marginRight: 6,
    marginBottom: 6,
  },
  chipActive: { borderColor: "#F25C05", backgroundColor: "#FEF3EC" },
  chipText: { fontSize: 13, color: "#666" },
  chipTextActive: { color: "#F25C05", fontWeight: "600" },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F25C05",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    gap: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  note: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },

  historyScroll: { padding: 16, paddingBottom: 40 },
  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#555", marginTop: 14 },
  emptyText: { fontSize: 14, color: "#888", textAlign: "center", marginTop: 6 },

  submissionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  submissionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  submissionInfo: { flex: 1, marginRight: 12 },
  submissionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  submissionMeta: { fontSize: 12, color: "#888", marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  rejectionReason: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 6,
    fontStyle: "italic",
  },
  submissionDate: { fontSize: 11, color: "#aaa", marginTop: 6 },
});
