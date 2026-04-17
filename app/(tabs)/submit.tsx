import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, Modal, RefreshControl,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MENU_CATEGORY_COLORS } from "../../constants/order";
import { getCurrentUser } from "../../lib/firebase";
import {
    createFavoriteCollection,
    getFavoriteCollections,
    getFavorites, getMenuItem,
    moveFavoriteToCollection,
    removeFavorite,
    type MenuItem,
} from "../../lib/firebase-store";

const CART_KEY = "@lasangpinoy_cart";

interface FavCollection { id: string; name: string; count: number; }
interface FavItem extends MenuItem { collection_id?: string; }

export default function FavoritesScreen() {
  const [collections, setCollections] = useState<FavCollection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [items, setItems] = useState<FavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveItemId, setMoveItemId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function fetchAll() {
    setLoading(true);
    const user = getCurrentUser();
    if (!user) { setLoading(false); return; }
    try {
      const [favs, cols] = await Promise.all([
        getFavorites(user.uid),
        getFavoriteCollections(user.uid),
      ]);
      setCollections(cols);
      const menuItems: FavItem[] = [];
      for (const fav of favs) {
        try {
          const item = await getMenuItem(fav.menu_item_id);
          if (item) menuItems.push({ ...item, collection_id: fav.collection_id });
        } catch {}
      }
      setItems(menuItems);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onRefresh() { setRefreshing(true); await fetchAll(); setRefreshing(false); }

  const filtered = activeCollection
    ? items.filter((i) => i.collection_id === activeCollection)
    : items;

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

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const user = getCurrentUser();
    if (!user) return;
    try {
      await createFavoriteCollection(user.uid, newFolderName.trim());
      setNewFolderName("");
      setNewFolderModal(false);
      fetchAll();
    } catch (e: any) { Alert.alert("Error", e.message); }
  }

  async function handleMoveToCollection(collectionId: string) {
    if (!moveItemId) return;
    const user = getCurrentUser();
    if (!user) return;
    try {
      await moveFavoriteToCollection(user.uid, moveItemId, collectionId);
      setMoveItemId(null);
      fetchAll();
    } catch (e: any) { Alert.alert("Error", e.message); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Favorites</Text>
        <TouchableOpacity style={styles.addFolderBtn} onPress={() => setNewFolderModal(true)}>
          <Ionicons name="folder-open" size={18} color="#fff" />
          <Text style={styles.addFolderText}>New Folder</Text>
        </TouchableOpacity>
      </View>

      {/* Collection Tabs */}
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={[{ id: null, name: "All", count: items.length }, ...collections] as any[]}
        keyExtractor={(i) => i.id || "all"}
        contentContainerStyle={styles.tabsRow}
        renderItem={({ item: col }) => {
          const active = activeCollection === col.id;
          const isAll = !col.id;
          return (
            <TouchableOpacity
              style={[styles.tabBtn, isAll && styles.tabBtnAll, active && styles.tabBtnActive]}
              onPress={() => setActiveCollection(col.id)}>
              <Ionicons name={col.id ? "folder" : "heart"} size={14}
                color={active ? "#fff" : "#888"} />
              <Text style={[styles.tabText, isAll && styles.tabTextAll, active && styles.tabTextActive]}>
                {col.name} ({col.count})
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
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
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => setMoveItemId(item.id)} style={{ padding: 4 }}>
                      <Ionicons name="folder-open-outline" size={20} color="#3498DB" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveFav(item.id)} style={{ padding: 4 }}>
                      <Ionicons name="heart-dislike" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
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

      {/* New Folder Modal */}
      <Modal visible={newFolderModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Folder</Text>
            <TextInput style={styles.modalInput} placeholder="Folder name"
              placeholderTextColor="#aaa" value={newFolderName} onChangeText={setNewFolderName} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setNewFolderModal(false)}>
                <Text style={{ color: "#888" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleCreateFolder}>
                <Text style={{ color: "#fff", fontWeight: "bold" }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Move to Folder Modal */}
      <Modal visible={!!moveItemId} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Move to Folder</Text>
            <TouchableOpacity style={styles.folderOption}
              onPress={() => handleMoveToCollection("")}>
              <Ionicons name="heart" size={18} color="#E74C3C" />
              <Text style={styles.folderOptionText}>Uncategorized</Text>
            </TouchableOpacity>
            {collections.map((col) => (
              <TouchableOpacity key={col.id} style={styles.folderOption}
                onPress={() => handleMoveToCollection(col.id)}>
                <Ionicons name="folder" size={18} color="#F25C05" />
                <Text style={styles.folderOptionText}>{col.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setMoveItemId(null)}>
              <Text style={{ color: "#888", textAlign: "center" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06" },
  addFolderBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F25C05", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addFolderText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  tabsRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  tabBtnAll: { paddingHorizontal: 10, paddingVertical: 6 },
  tabBtnActive: { backgroundColor: "#F25C05", borderColor: "#F25C05" },
  tabText: { fontSize: 12, color: "#888" },
  tabTextAll: { fontSize: 11 },
  tabTextActive: { color: "#fff", fontWeight: "bold" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardImage: { width: 60, height: 60, borderRadius: 12 },
  cardImagePlaceholder: { justifyContent: "center", alignItems: "center" },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  cardCategory: { fontSize: 11, color: "#888", marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: "bold", color: "#F25C05", marginTop: 2 },
  cardActions: { gap: 8 },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#F25C05", borderRadius: 10, paddingVertical: 10, marginTop: 10,
  },
  addBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "bold", color: "#aaa", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#bbb", marginTop: 4, textAlign: "center", paddingHorizontal: 40 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modal: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06", marginBottom: 12 },
  modalInput: { backgroundColor: "#F9F5EF", borderRadius: 10, padding: 12, fontSize: 14, color: "#333" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#eee", marginTop: 8 },
  modalConfirm: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#F25C05" },
  folderOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f0e5" },
  folderOptionText: { fontSize: 15, color: "#2E1A06" },
});
