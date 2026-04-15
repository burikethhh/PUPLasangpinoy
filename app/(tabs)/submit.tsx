import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, RefreshControl,
    StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MENU_CATEGORY_COLORS } from "../../constants/order";
import { getCurrentUser } from "../../lib/firebase";
import { getFavorites, getMenuItem, removeFavorite, type MenuItem } from "../../lib/firebase-store";

const CART_KEY = "@lasangpinoy_cart";

export default function FavoritesScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { fetchFavs(); }, []));

  async function fetchFavs() {
    setLoading(true);
    const user = getCurrentUser();
    if (!user) { setLoading(false); return; }
    try {
      const favs = await getFavorites(user.uid);
      const menuItems: MenuItem[] = [];
      for (const fav of favs) {
        try {
          const item = await getMenuItem(fav.menu_item_id);
          if (item) menuItems.push(item);
        } catch {}
      }
      setItems(menuItems);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchFavs();
    setRefreshing(false);
  }

  async function handleRemoveFav(itemId: string) {
    const user = getCurrentUser();
    if (!user) return;
    Alert.alert("Remove Favorite", "Remove this item from favorites?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          await removeFavorite(user.uid, itemId);
          setItems((prev) => prev.filter((i) => i.id !== itemId));
        },
      },
    ]);
  }

  async function addToCart(item: MenuItem) {
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      const cart: any[] = raw ? JSON.parse(raw) : [];
      const existing = cart.find((c) => c.menu_item_id === item.id);
      if (existing) existing.quantity += 1;
      else cart.push({ menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, image_url: item.image_url });
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(cart));
      Alert.alert("Added", `${item.name} added to cart!`);
    } catch (e) { console.error(e); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Favorites</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const color = MENU_CATEGORY_COLORS[item.category] || "#F25C05";
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.cardImage}
                      contentFit="cover" transition={200} />
                  ) : (
                    <View style={[styles.cardImage, styles.cardImagePlaceholder, { backgroundColor: color + "22" }]}>
                      <Text style={{ fontSize: 24 }}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.cardCategory}>{item.category}</Text>
                    <Text style={styles.cardPrice}>P{item.price?.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveFav(item.id)} style={{ padding: 4 }}>
                    <Ionicons name="heart-dislike" size={22} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(item)}
                  disabled={item.stock_quantity <= 0}>
                  <Ionicons name="cart-outline" size={16} color="#fff" />
                  <Text style={styles.addBtnText}>
                    {item.stock_quantity > 0 ? "Add to Cart" : "Sold Out"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={64} color="#ddd" />
              <Text style={styles.emptyText}>No favorites yet</Text>
              <Text style={styles.emptySubtext}>Tap the heart icon on menu items to save them here</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 4 },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, elevation: 2,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardImage: { width: 60, height: 60, borderRadius: 12 },
  cardImagePlaceholder: { justifyContent: "center", alignItems: "center" },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  cardCategory: { fontSize: 11, color: "#888", marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: "bold", color: "#F25C05", marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#F25C05", borderRadius: 10, paddingVertical: 10, marginTop: 10,
  },
  addBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "bold", color: "#aaa", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#bbb", marginTop: 4, textAlign: "center", paddingHorizontal: 40 },
});
