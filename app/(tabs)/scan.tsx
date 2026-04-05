import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRecipes } from "../../lib/firebase";
import { analyzeImageWithQwen, ScanResult } from "../../lib/qwen-ai";

type ScanMode = "dish" | "ingredients";

export default function ScanScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>("dish");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchedRecipes, setMatchedRecipes] = useState<any[]>([]);
  const [expandedScan, setExpandedScan] = useState<Record<string, boolean>>({
    description: true,
    ingredients: true,
    nutrition: false,
    cookingTips: false,
    funFact: false,
    suggestedRecipes: true,
  });

  function toggleScan(key: string) {
    setExpandedScan((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function pickFromGallery() {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      setError("Permission to access gallery is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setResult(null);
      setError(null);
      setMatchedRecipes([]);
    }
  }

  async function takePhoto() {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      setError("Permission to access camera is required!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setResult(null);
      setError(null);
      setMatchedRecipes([]);
    }
  }

  async function analyzeImage() {
    if (!selectedImage) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setMatchedRecipes([]);

    try {
      // Resize image and get base64 directly from manipulator
      const manipulated = await ImageManipulator.manipulateAsync(
        selectedImage,
        [{ resize: { width: 1280 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const base64 = manipulated.base64;
      if (!base64) {
        throw new Error("Failed to convert image to base64");
      }

      // Analyze with AI
      const scanResult = await analyzeImageWithQwen(base64, scanMode);
      setResult(scanResult);

      // Search for matching recipes in database
      if (scanResult.type === "dish" && scanResult.dishName) {
        const recipes = await getRecipes();
        const matched = recipes
          .filter((r) =>
            r.title.toLowerCase().includes(scanResult.dishName!.toLowerCase()),
          )
          .slice(0, 5);
        setMatchedRecipes(matched);
      } else if (
        scanResult.type === "ingredients" &&
        scanResult.suggestedRecipes
      ) {
        // Search for suggested recipes using recipe names
        const recipes = await getRecipes();
        const searchTerms = scanResult.suggestedRecipes
          .slice(0, 4)
          .map((r) => r.name.toLowerCase());
        const matched = recipes
          .filter((r) =>
            searchTerms.some((term) => r.title.toLowerCase().includes(term)),
          )
          .slice(0, 5);
        setMatchedRecipes(matched);
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      const errorMsg = err?.message || "Unknown error";
      setError(`Analysis failed: ${errorMsg}`);

      const recipes = await getRecipes();
      const fallbackSuggestions = recipes.slice(0, 5);

      setMatchedRecipes(fallbackSuggestions);
      setResult(
        scanMode === "dish"
          ? {
              type: "dish",
              dishName: "Could not identify exact dish",
              confidence: "low",
              description:
                "AI analysis is temporarily unavailable. Here are popular recipes you can browse while we reconnect.",
              ingredients: [],
              isFilipino: true,
            }
          : {
              type: "ingredients",
              ingredients: [],
              suggestedRecipes: fallbackSuggestions.map((r) => ({ name: r.title })).slice(0, 5),
              description:
                "AI analysis is temporarily unavailable. Showing suggested recipes from the app database.",
            },
      );
    } finally {
      setLoading(false);
    }
  }

  function resetScan() {
    setSelectedImage(null);
    setResult(null);
    setError(null);
    setMatchedRecipes([]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Food Scanner</Text>
          <Text style={styles.headerSub}>
            Identify dishes or scan ingredients
          </Text>
        </View>

        {/* MODE SELECTOR */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              scanMode === "dish" && styles.modeBtnActive,
            ]}
            onPress={() => {
              setScanMode("dish");
              setResult(null);
              setMatchedRecipes([]);
              setError(null);
            }}
          >
            <Ionicons
              name="restaurant"
              size={20}
              color={scanMode === "dish" ? "#fff" : "#F25C05"}
            />
            <Text
              style={[
                styles.modeBtnText,
                scanMode === "dish" && styles.modeBtnTextActive,
              ]}
            >
              Identify Dish
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              scanMode === "ingredients" && styles.modeBtnActive,
            ]}
            onPress={() => {
              setScanMode("ingredients");
              setResult(null);
              setMatchedRecipes([]);
              setError(null);
            }}
          >
            <Ionicons
              name="nutrition"
              size={20}
              color={scanMode === "ingredients" ? "#fff" : "#34B36A"}
            />
            <Text
              style={[
                styles.modeBtnText,
                scanMode === "ingredients" && styles.modeBtnTextActive,
              ]}
            >
              Scan Ingredients
            </Text>
          </TouchableOpacity>
        </View>

        {/* IMAGE PREVIEW — always visible when an image is selected */}
        {selectedImage && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <TouchableOpacity style={styles.clearImageBtn} onPress={resetScan}>
              <Ionicons name="close-circle" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* PLACEHOLDER — only when no image */}
        {!selectedImage && (
          <View style={styles.placeholder}>
            <Ionicons
              name={
                scanMode === "dish" ? "restaurant-outline" : "nutrition-outline"
              }
              size={60}
              color="#E0D8C8"
            />
            <Text style={styles.placeholderText}>
              {scanMode === "dish"
                ? "Take or select a photo of a dish"
                : "Capture your ingredients"}
            </Text>
          </View>
        )}

        {/* ACTION BUTTONS */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={takePhoto}>
            <View style={[styles.actionIcon, { backgroundColor: "#4A8FE7" }]}>
              <Ionicons name="camera" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={pickFromGallery}>
            <View style={[styles.actionIcon, { backgroundColor: "#9B59B6" }]}>
              <Ionicons name="images" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* ANALYZE BUTTON */}
        {selectedImage && !loading && !result && (
          <TouchableOpacity style={styles.analyzeBtn} onPress={analyzeImage}>
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.analyzeBtnText}>
              {scanMode === "dish" ? "Identify This Dish" : "Find Recipes"}
            </Text>
          </TouchableOpacity>
        )}

        {/* LOADING */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F25C05" />
            <Text style={styles.loadingText}>
              {scanMode === "dish"
                ? "Identifying dish with AI..."
                : "Analyzing ingredients..."}
            </Text>
          </View>
        )}

        {/* ERROR */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={24} color="#E74C3C" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={analyzeImage}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* RESULT - DISH */}
        {result && result.type === "dish" && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#34B36A" />
              <Text style={styles.resultTitle}>Dish Identified!</Text>
            </View>

            <View style={styles.dishNameRow}>
              <Text style={styles.dishName}>{result.dishName}</Text>
              {result.isFilipino && (
                <View style={styles.filipinoBadge}>
                  <Text style={styles.filipinoBadgeText}>Filipino</Text>
                </View>
              )}
            </View>

            <Text style={styles.confidenceText}>
              Confidence: {result.confidence || "N/A"}
            </Text>

            {/* Description - collapsible */}
            {result.description && (
              <TouchableOpacity activeOpacity={0.7} style={styles.dropdownHeader} onPress={() => toggleScan("description")}>
                <Ionicons name="information-circle-outline" size={16} color="#F25C05" />
                <Text style={styles.dropdownLabel}>Description</Text>
                <Ionicons name={expandedScan.description ? "chevron-up" : "chevron-down"} size={16} color="#aaa" />
              </TouchableOpacity>
            )}
            {result.description && expandedScan.description && (
              <Text style={styles.description}>{result.description}</Text>
            )}

            {/* Ingredients - collapsible */}
            {result.ingredients && result.ingredients.length > 0 && (
              <View style={styles.ingredientsSection}>
                <TouchableOpacity activeOpacity={0.7} style={styles.dropdownHeader} onPress={() => toggleScan("ingredients")}>
                  <Ionicons name="leaf-outline" size={16} color="#2E7D32" />
                  <Text style={styles.dropdownLabel}>Main Ingredients</Text>
                  <Ionicons name={expandedScan.ingredients ? "chevron-up" : "chevron-down"} size={16} color="#aaa" />
                </TouchableOpacity>
                {expandedScan.ingredients && (
                  <View style={styles.ingredientTags}>
                    {result.ingredients.map((ing, idx) => (
                      <View key={idx} style={styles.ingredientTag}>
                        <Text style={styles.ingredientTagText}>{ing}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* NUTRITION FACTS - collapsible */}
            {result.nutrition && (
              <View style={styles.nutritionSection}>
                <TouchableOpacity activeOpacity={0.7} style={styles.dropdownHeader} onPress={() => toggleScan("nutrition")}>
                  <Ionicons name="nutrition" size={16} color="#F25C05" />
                  <Text style={styles.dropdownLabel}>
                    Nutrition Facts{result.servingSize ? ` (${result.servingSize})` : ""}
                  </Text>
                  <Ionicons name={expandedScan.nutrition ? "chevron-up" : "chevron-down"} size={16} color="#aaa" />
                </TouchableOpacity>
                {expandedScan.nutrition && (
                  <View style={styles.nutritionGrid}>
                    {result.nutrition.calories && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{result.nutrition.calories}</Text>
                        <Text style={styles.nutritionLabel}>Calories</Text>
                      </View>
                    )}
                    {result.nutrition.protein && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{result.nutrition.protein}</Text>
                        <Text style={styles.nutritionLabel}>Protein</Text>
                      </View>
                    )}
                    {result.nutrition.carbs && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{result.nutrition.carbs}</Text>
                        <Text style={styles.nutritionLabel}>Carbs</Text>
                      </View>
                    )}
                    {result.nutrition.fat && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{result.nutrition.fat}</Text>
                        <Text style={styles.nutritionLabel}>Fat</Text>
                      </View>
                    )}
                    {result.nutrition.fiber && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{result.nutrition.fiber}</Text>
                        <Text style={styles.nutritionLabel}>Fiber</Text>
                      </View>
                    )}
                    {result.nutrition.sodium && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{result.nutrition.sodium}</Text>
                        <Text style={styles.nutritionLabel}>Sodium</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Cooking Tips - collapsible */}
            {result.cookingTips && (
              <>
                <TouchableOpacity activeOpacity={0.7} style={styles.dropdownHeader} onPress={() => toggleScan("cookingTips")}>
                  <Ionicons name="flame" size={16} color="#F25C05" />
                  <Text style={styles.dropdownLabel}>Cooking Tips</Text>
                  <Ionicons name={expandedScan.cookingTips ? "chevron-up" : "chevron-down"} size={16} color="#aaa" />
                </TouchableOpacity>
                {expandedScan.cookingTips && (
                  <View style={styles.funFactBox}>
                    <Text style={styles.funFactText}>{result.cookingTips}</Text>
                  </View>
                )}
              </>
            )}

            {/* Fun Fact - collapsible */}
            {result.funFact && (
              <>
                <TouchableOpacity activeOpacity={0.7} style={styles.dropdownHeader} onPress={() => toggleScan("funFact")}>
                  <Ionicons name="bulb" size={16} color="#F39C12" />
                  <Text style={styles.dropdownLabel}>Fun Fact</Text>
                  <Ionicons name={expandedScan.funFact ? "chevron-up" : "chevron-down"} size={16} color="#aaa" />
                </TouchableOpacity>
                {expandedScan.funFact && (
                  <View style={styles.funFactBox}>
                    <Text style={styles.funFactText}>{result.funFact}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* RESULT - INGREDIENTS */}
        {result && result.type === "ingredients" && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#34B36A" />
              <Text style={styles.resultTitle}>Ingredients Found!</Text>
            </View>

            {result.ingredients && result.ingredients.length > 0 && (
              <View style={styles.ingredientsSection}>
                <Text style={styles.sectionLabel}>Detected Ingredients:</Text>
                <View style={styles.ingredientTags}>
                  {result.ingredients.map((ing, idx) => (
                    <View key={idx} style={styles.ingredientTag}>
                      <Text style={styles.ingredientTagText}>{ing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {result.suggestedRecipes && result.suggestedRecipes.length > 0 && (
              <View style={styles.suggestionsSection}>
                <Text style={styles.sectionLabel}>Suggested Recipes:</Text>
                {result.suggestedRecipes.map((recipe, idx) => (
                  <View key={idx} style={styles.recipeCard}>
                    <View style={styles.recipeCardHeader}>
                      <Ionicons name="restaurant" size={16} color="#F25C05" />
                      <Text style={styles.recipeCardName}>{recipe.name}</Text>
                    </View>
                    {recipe.description && (
                      <Text style={styles.recipeCardDesc}>{recipe.description}</Text>
                    )}
                    {recipe.mainIngredients && recipe.mainIngredients.length > 0 && (
                      <View style={styles.recipeCardIngredients}>
                        {recipe.mainIngredients.map((ing, i) => (
                          <View key={i} style={styles.ingredientTag}>
                            <Text style={styles.ingredientTagText}>{ing}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {recipe.nutrition && (
                      <View style={styles.nutritionRow}>
                        {recipe.nutrition.calories && (
                          <Text style={styles.nutritionSmall}>{recipe.nutrition.calories}</Text>
                        )}
                        {recipe.nutrition.protein && (
                          <Text style={styles.nutritionSmall}>P: {recipe.nutrition.protein}</Text>
                        )}
                        {recipe.nutrition.carbs && (
                          <Text style={styles.nutritionSmall}>C: {recipe.nutrition.carbs}</Text>
                        )}
                        {recipe.nutrition.fat && (
                          <Text style={styles.nutritionSmall}>F: {recipe.nutrition.fat}</Text>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* MATCHED RECIPES FROM DATABASE */}
        {matchedRecipes.length > 0 && (
          <View style={styles.matchedSection}>
            <Text style={styles.matchedTitle}>
              <Ionicons name="book" size={16} color="#F25C05" /> Recipes in Our
              Database
            </Text>
            {matchedRecipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.matchedCard}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              >
                {recipe.image_url ? (
                  <Image
                    source={{ uri: recipe.image_url }}
                    style={styles.matchedImage}
                  />
                ) : (
                  <View
                    style={[styles.matchedImage, styles.matchedPlaceholder]}
                  >
                    <Text style={{ fontSize: 24 }}>🍽️</Text>
                  </View>
                )}
                <View style={styles.matchedInfo}>
                  <Text style={styles.matchedName}>{recipe.title}</Text>
                  <Text style={styles.matchedMeta}>
                    {recipe.category}{" "}
                    {recipe.region ? `• ${recipe.region}` : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#aaa" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* SCAN AGAIN BUTTON */}
        {result && (
          <TouchableOpacity style={styles.scanAgainBtn} onPress={resetScan}>
            <Ionicons name="refresh" size={18} color="#F25C05" />
            <Text style={styles.scanAgainText}>Scan Another</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  scrollContent: { paddingBottom: 40 },
  header: { padding: 16, paddingTop: 8 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#2E1A06" },
  headerSub: { fontSize: 12, color: "#B07820", marginTop: 2 },

  modeSelector: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E8D8A0",
  },
  modeBtnActive: {
    backgroundColor: "#F25C05",
    borderColor: "#F25C05",
  },
  modeBtnText: { fontSize: 13, fontWeight: "600", color: "#666" },
  modeBtnTextActive: { color: "#fff" },

  imageContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: 300, borderRadius: 16, backgroundColor: "#000" },
  clearImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 14,
  },

  placeholder: {
    marginHorizontal: 16,
    height: 200,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E8D8A0",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { fontSize: 13, color: "#aaa", marginTop: 10 },

  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 30,
    marginTop: 20,
    marginBottom: 10,
  },
  actionBtn: { alignItems: "center" },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: { fontSize: 12, color: "#666", marginTop: 6 },

  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F25C05",
  },
  analyzeBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  loadingContainer: { alignItems: "center", marginTop: 30 },
  loadingText: { fontSize: 13, color: "#888", marginTop: 12 },

  errorContainer: {
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
    padding: 20,
    backgroundColor: "#FFF5F5",
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
    color: "#E74C3C",
    textAlign: "center",
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#E74C3C",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  resultCard: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 2,
    // @ts-ignore
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  resultTitle: { fontSize: 16, fontWeight: "bold", color: "#34B36A" },

  dishNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  dishName: { fontSize: 20, fontWeight: "bold", color: "#2E1A06" },
  filipinoBadge: {
    backgroundColor: "#F25C05",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  filipinoBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  confidenceText: { fontSize: 12, color: "#888", marginBottom: 10 },
  description: {
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
    marginBottom: 12,
  },

  ingredientsSection: { marginTop: 10 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2E1A06",
    marginBottom: 8,
  },
  ingredientTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ingredientTag: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  ingredientTagText: { fontSize: 11, color: "#2E7D32" },

  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EAE0",
  },
  dropdownLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#2E1A06",
  },
  funFactBox: {
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6,
    padding: 12,
    backgroundColor: "#FFF8E1",
    borderRadius: 10,
  },
  funFactText: { flex: 1, fontSize: 12, color: "#F39C12", lineHeight: 18 },

  suggestionsSection: { marginTop: 14 },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  suggestionText: { fontSize: 14, color: "#2E1A06" },

  // Nutrition facts grid
  nutritionSection: { marginTop: 14 },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  nutritionItem: {
    backgroundColor: "#FFF8E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 90,
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#F25C05",
  },
  nutritionLabel: {
    fontSize: 10,
    color: "#888",
    marginTop: 2,
  },

  // Recipe cards for ingredient scan
  recipeCard: {
    backgroundColor: "#FAFAF5",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#F25C05",
  },
  recipeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  recipeCardName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2E1A06",
  },
  recipeCardDesc: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
    marginBottom: 6,
  },
  recipeCardIngredients: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  nutritionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  nutritionSmall: {
    fontSize: 11,
    color: "#F25C05",
    backgroundColor: "#FFF5EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },

  matchedSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  matchedTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2E1A06",
    marginBottom: 12,
  },
  matchedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    // @ts-ignore
    boxShadow: "0px 1px 4px rgba(0, 0, 0, 0.06)",
  },
  matchedImage: { width: 50, height: 50, borderRadius: 10 },
  matchedPlaceholder: {
    backgroundColor: "#F5F0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  matchedInfo: { flex: 1, marginLeft: 12 },
  matchedName: { fontSize: 14, fontWeight: "600", color: "#2E1A06" },
  matchedMeta: { fontSize: 11, color: "#888", marginTop: 2 },

  scanAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FFF5EE",
    borderWidth: 1,
    borderColor: "#F25C05",
  },
  scanAgainText: { color: "#F25C05", fontWeight: "600", fontSize: 14 },
});
