import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FOOD_CATEGORIES, FOOD_CATEGORY_COLORS } from "../../constants/food-categories";
import {
    Recipe as FirebaseRecipe,
    Region as FirebaseRegion,
    getRecipes,
    getRegions,
} from "../../lib/firebase";

type Recipe = FirebaseRecipe;
type Region = FirebaseRegion;

const CATEGORIES = [
  { label: "All", value: "", color: "#F25C05" },
  ...FOOD_CATEGORIES.map((category) => ({
    label: category,
    value: category,
    color: FOOD_CATEGORY_COLORS[category] || "#F25C05",
  })),
];

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 48) / 2;

export default function HomeScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [activeRegion, setActiveRegion] = useState("");

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchRegionsData();
  }, []);
  useEffect(() => {
    fetchRecipesData(search);
  }, [activeCategory, activeRegion]);

  // Debounced search — triggers 400ms after user stops typing
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchRecipesData(search);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search]);

  async function fetchRegionsData() {
    try {
      const data = await getRegions();
      setRegions(data);
    } catch (error) {
      console.error("Error fetching regions:", error);
    }
  }

  async function fetchRecipesData(keyword = "") {
    setLoading(true);
    try {
      const data = await getRecipes({
        category: activeCategory || undefined,
        region: activeRegion || undefined,
        search: keyword || undefined,
      });
      setRecipes(data);
    } catch (error) {
      console.error("Error fetching recipes:", error);
    }
    setLoading(false);
  }

  const catColors: Record<string, string> = FOOD_CATEGORY_COLORS;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.appTitle}>Lasang Pinoy</Text>
            <Text style={styles.appSub}>Discover Filipino flavors</Text>
          </View>
          <View style={styles.topBtns}>
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => router.push("/(tabs)/chat")}
            >
              <Text style={styles.chatBtnText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.userBtn}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Text style={styles.userBtnText}>User</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={16}
            color="#aaa"
            style={{ marginLeft: 14 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => fetchRecipesData(search)}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                fetchRecipesData();
              }}
              style={{ marginRight: 12 }}
            >
              <Ionicons name="close-circle" size={18} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>

        {/* SCAN BANNER */}
        <TouchableOpacity
          style={styles.scanBanner}
          onPress={() => router.push("/(tabs)/scan")}
        >
          <View style={styles.scanIconBox}>
            <Ionicons name="camera" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanTitle}>Scan Ingredients</Text>
            <Text style={styles.scanSub}>
              Get recipe suggestions from your pantry
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>

        {/* CATEGORY FILTER */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.catBtn,
                  isActive && {
                    backgroundColor: cat.color,
                    borderColor: cat.color,
                  },
                ]}
                onPress={() => setActiveCategory(cat.value)}
              >
                <Text style={[styles.catText, isActive && { color: "#fff" }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* REGION FILTER */}
        <Text style={styles.sectionTitle}>
          <Ionicons name="map-outline" size={14} color="#9B59B6" /> Regions
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          <TouchableOpacity
            style={[
              styles.regionBtn,
              activeRegion === "" && {
                backgroundColor: "#9B59B6",
                borderColor: "#9B59B6",
              },
            ]}
            onPress={() => setActiveRegion("")}
          >
            <Text
              style={[
                styles.regionBtnText,
                activeRegion === "" && { color: "#fff" },
              ]}
            >
              All Regions
            </Text>
          </TouchableOpacity>
          {regions.map((region) => {
            const isActive = activeRegion === region.name;
            return (
              <TouchableOpacity
                key={region.id}
                style={[
                  styles.regionBtn,
                  isActive && {
                    backgroundColor: "#9B59B6",
                    borderColor: "#9B59B6",
                  },
                ]}
                onPress={() => setActiveRegion(region.name)}
              >
                <Text
                  style={[styles.regionBtnText, isActive && { color: "#fff" }]}
                >
                  {region.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* RECIPES GRID */}
        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>
            {activeCategory || activeRegion
              ? `${activeCategory || "All"}${activeRegion ? ` • ${activeRegion}` : ""}`
              : "Popular Dishes"}
          </Text>
          {!!(activeCategory || activeRegion) && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={() => {
                setActiveCategory("");
                setActiveRegion("");
              }}
            >
              <Ionicons name="close-circle" size={14} color="#888" />
              <Text style={styles.clearFiltersText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#F25C05"
            style={{ marginTop: 40 }}
          />
        ) : recipes.length === 0 ? (
          <Text style={styles.noResults}>No recipes found.</Text>
        ) : (
          <View style={styles.grid}>
            {recipes.map((recipe) => {
              const color = catColors[recipe.category] || "#F25C05";
              return (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.recipeCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                >
                  {/* IMAGE */}
                  {recipe.image_url ? (
                    <Image
                      source={{ uri: recipe.image_url }}
                      style={styles.recipeImage}
                      contentFit="cover"
                      transition={300}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View
                      style={[
                        styles.imagePlaceholder,
                        { backgroundColor: color + "22" },
                      ]}
                    >
                      <Text style={{ fontSize: 40 }}>🍽️</Text>
                    </View>
                  )}

                  {/* CATEGORY TAG */}
                  <View style={[styles.catTag, { backgroundColor: color }]}>
                    <Text style={styles.catTagText}>{recipe.category}</Text>
                  </View>

                  {/* TITLE */}
                  <View style={styles.cardBottom}>
                    <Text style={styles.recipeTitle} numberOfLines={2}>
                      {recipe.title}
                    </Text>
                    {recipe.region ? (
                      <View style={styles.regionRow}>
                        <Ionicons
                          name="map-outline"
                          size={10}
                          color="#9B59B6"
                        />
                        <Text style={styles.regionText}>{recipe.region}</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  appTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06" },
  appSub: { fontSize: 11, color: "#B07820", marginTop: 2 },
  topBtns: { flexDirection: "row", gap: 8 },
  chatBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F25C05",
    justifyContent: "center",
    alignItems: "center",
  },
  chatBtnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  userBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DDDDDD",
    justifyContent: "center",
    alignItems: "center",
  },
  userBtnText: { color: "#444", fontSize: 11, fontWeight: "bold" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 28,
    marginHorizontal: 16,
    marginBottom: 14,
    height: 50,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#333",
    paddingHorizontal: 8,
    height: "100%",
  },
  scanBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A8FE7",
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    gap: 14,
    minHeight: 90,
  },
  scanIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanTitle: { fontSize: 16, fontWeight: "bold", color: "#fff" },
  scanSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.88)",
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E1A06",
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 16,
  },
  clearFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#F0EAE0",
  },
  clearFiltersText: { fontSize: 11, color: "#888" },
  catRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  catBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E8D8A0",
  },
  catText: { fontSize: 13, fontWeight: "600", color: "#888" },
  regionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#D8C8E8",
  },
  regionBtnText: { fontSize: 12, fontWeight: "600", color: "#9B59B6" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  recipeCard: {
    width: CARD_SIZE,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    // @ts-ignore - web shadow
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)",
  },
  recipeImage: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  imagePlaceholder: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  catTag: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  catTagText: { fontSize: 9, color: "#fff", fontWeight: "bold" },
  cardBottom: { padding: 10 },
  recipeTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2E1A06",
    marginBottom: 4,
  },
  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  regionText: { fontSize: 9, color: "#9B59B6" },
  noResults: { textAlign: "center", color: "#aaa", marginTop: 40 },
});
