import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MENU_CATEGORIES, MENU_CATEGORY_COLORS } from "../../constants/order";
import { getCategories, getCurrentUser } from "../../lib/firebase";
import { addFavorite, getMenuItems, removeFavorite, type MenuItem } from "../../lib/firebase-store";

const DEFAULT_CATEGORIES = [
  { label: "All", value: "", color: "#F25C05" },
  ...MENU_CATEGORIES.map((c) => ({ label: c, value: c, color: MENU_CATEGORY_COLORS[c] || "#F25C05" })),
];

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 48) / 2;
const CART_KEY = "@foodfix_cart";
const OLD_CART_KEY = "@lasangpinoy_cart";

export default function MenuScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [categoryOptions, setCategoryOptions] = useState(DEFAULT_CATEGORIES);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Migrate old cart key to new one
  useEffect(() => {
    (async () => {
      const old = await AsyncStorage.getItem(OLD_CART_KEY);
      if (old) {
        const existing = await AsyncStorage.getItem(CART_KEY);
        if (!existing) await AsyncStorage.setItem(CART_KEY, old);
        await AsyncStorage.removeItem(OLD_CART_KEY);
      }
    })();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { fetchMenu(); }, []));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMenu(); }, [activeCategory]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchMenu(true);
    }, 8000);
    return () => clearInterval(intervalId);
  }, [activeCategory, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => fetchMenu(), 400);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchMenu(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [data, dynamicCategories] = await Promise.all([
        getMenuItems({
          category: activeCategory || undefined,
          search: search || undefined,
          availableOnly: false,
        }),
        getCategories(),
      ]);

      const categoryNames = Array.from(
        new Set([
          ...MENU_CATEGORIES,
          ...dynamicCategories.map((c) => c.name).filter(Boolean),
          ...data.map((item) => item.category).filter(Boolean),
        ]),
      );

      const categoryColorMap = new Map<string, string>();
      dynamicCategories.forEach((c) => {
        if (c.name) {
          categoryColorMap.set(c.name, c.color || MENU_CATEGORY_COLORS[c.name] || "#F25C05");
        }
      });

      setCategoryOptions([
        { label: "All", value: "", color: "#F25C05" },
        ...categoryNames.map((name) => ({
          label: name,
          value: name,
          color: categoryColorMap.get(name) || MENU_CATEGORY_COLORS[name] || "#F25C05",
        })),
      ]);

      if (activeCategory && !categoryNames.includes(activeCategory)) {
        setActiveCategory("");
      }

      setItems(data);
    } catch (error) {
      console.error("Error fetching menu:", error);
    }
    if (!silent) setLoading(false);
  }

  async function addToCart(item: MenuItem) {
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      const cart: { menu_item_id: string; name: string; price: number; quantity: number; stock_quantity: number; image_url?: string }[] = raw ? JSON.parse(raw) : [];
      const existing = cart.find((c) => c.menu_item_id === item.id);
      if (existing) {
        if (existing.quantity >= item.stock_quantity) {
          Alert.alert("Stock Limit", `Only ${item.stock_quantity} left in stock.`);
          return;
        }
        existing.quantity += 1;
      } else {
        cart.push({ menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, stock_quantity: item.stock_quantity, image_url: item.image_url });
      }
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(cart));
      Alert.alert("Added to Cart", `${item.name} added to your cart!`);
    } catch (e) {
      console.error("Cart error:", e);
    }
  }

  async function toggleFav(itemId: string) {
    const user = getCurrentUser();
    if (!user) return Alert.alert("Sign in", "Please sign in to save favorites.");
    try {
      if (favIds.has(itemId)) {
        await removeFavorite(user.uid, itemId);
        setFavIds((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
      } else {
        await addFavorite(user.uid, itemId);
        setFavIds((prev) => new Set(prev).add(itemId));
      }
    } catch (e) {
      console.error("Fav error:", e);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.appTitle}>FOODFIX</Text>
            <Text style={styles.appSub}>Filipino Food Ordering</Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#aaa" style={{ marginLeft: 14 }} />
          <TextInput style={styles.searchInput} placeholder="Search food..."
            placeholderTextColor="#aaa" value={search} onChangeText={setSearch} returnKeyType="search" />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} style={{ marginRight: 12 }}>
              <Ionicons name="close-circle" size={18} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORY FILTER */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.catRow}>
          {categoryOptions.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <TouchableOpacity key={cat.value}
                style={[styles.catBtn, isActive && { backgroundColor: cat.color, borderColor: cat.color }]}
                onPress={() => setActiveCategory(cat.value)}>
                <Text style={[styles.catText, isActive && { color: "#fff" }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* MENU GRID */}
        <Text style={styles.sectionTitle}>
          {activeCategory || "All Menu Items"} ({items.length})
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Ionicons name="fast-food-outline" size={48} color="#ccc" />
            <Text style={styles.noResults}>No food items found.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => {
              const color = MENU_CATEGORY_COLORS[item.category] || "#F25C05";
              const unavailable = !item.available || item.stock_quantity <= 0;
              return (
                <View key={item.id} style={styles.menuCard}>
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.menuImage}
                      contentFit="cover"
                      transition={300}
                      cachePolicy="none"
                      recyclingKey={item.id}
                    />
                  ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: color + "22" }]}>
                      <Text style={{ fontSize: 36 }}>🍽️</Text>
                    </View>
                  )}

                  {/* Category tag */}
                  <View style={[styles.catTag, { backgroundColor: color }]}>
                    <Text style={styles.catTagText}>{item.category}</Text>
                  </View>

                  {!item.available && (
                    <View style={styles.unavailableBadge}>
                      <Text style={styles.unavailableBadgeText}>Unavailable</Text>
                    </View>
                  )}

                  {/* Favorite button */}
                  <TouchableOpacity style={styles.favBtn} onPress={() => toggleFav(item.id)}>
                    <Ionicons name={favIds.has(item.id) ? "heart" : "heart-outline"}
                      size={18} color={favIds.has(item.id) ? "#E74C3C" : "#999"} />
                  </TouchableOpacity>

                  <View style={styles.cardBottom}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                    ) : null}
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>P{item.price?.toFixed(2)}</Text>
                      <Text style={[styles.stock, unavailable && styles.stockUnavailable]}>
                        {!item.available
                          ? "Unavailable"
                          : item.stock_quantity > 0
                            ? `${item.stock_quantity} left`
                            : "Sold out"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.addBtn, unavailable && styles.addBtnDisabled]}
                      onPress={() => addToCart(item)}
                      disabled={unavailable}
                    >
                      <Ionicons name="cart-outline" size={14} color="#fff" />
                      <Text style={styles.addBtnText}>{unavailable ? "Unavailable" : "Add to Cart"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
  },
  appTitle: { fontSize: 20, fontWeight: "bold", color: "#2E1A06" },
  appSub: { fontSize: 11, color: "#B07820", marginTop: 2 },
  searchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 28, marginHorizontal: 16, marginBottom: 14, height: 50,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#333", paddingHorizontal: 8, height: "100%" },
  sectionTitle: {
    fontSize: 16, fontWeight: "bold", color: "#2E1A06",
    marginHorizontal: 16, marginBottom: 10, marginTop: 4,
  },
  catRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  catBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E8D8A0",
  },
  catText: { fontSize: 13, fontWeight: "600", color: "#888" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  menuCard: {
    width: CARD_SIZE, backgroundColor: "#fff", borderRadius: 16,
    overflow: "hidden", elevation: 3,
  },
  menuImage: { width: CARD_SIZE, height: CARD_SIZE * 0.7 },
  imagePlaceholder: {
    width: CARD_SIZE, height: CARD_SIZE * 0.7,
    justifyContent: "center", alignItems: "center",
  },
  catTag: {
    position: "absolute", top: 8, left: 8,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  catTagText: { fontSize: 9, color: "#fff", fontWeight: "bold" },
  unavailableBadge: {
    position: "absolute",
    top: 8,
    right: 40,
    backgroundColor: "#E74C3C",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  unavailableBadgeText: { fontSize: 9, color: "#fff", fontWeight: "bold" },
  favBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "#fff", borderRadius: 14, padding: 4 },
  cardBottom: { padding: 10 },
  itemName: { fontSize: 13, fontWeight: "bold", color: "#2E1A06", marginBottom: 2 },
  itemDesc: { fontSize: 11, color: "#888", marginBottom: 4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  price: { fontSize: 15, fontWeight: "bold", color: "#F25C05" },
  stock: { fontSize: 10, color: "#888" },
  stockUnavailable: { color: "#E74C3C", fontWeight: "600" },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: "#F25C05", borderRadius: 10, paddingVertical: 8,
  },
  addBtnDisabled: { backgroundColor: "#BDBDBD" },
  addBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  noResults: { textAlign: "center", color: "#aaa", marginTop: 8 },
});
