import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Modal, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MENU_CATEGORIES, MENU_CATEGORY_COLORS } from "../../constants/order";
import {
  getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
  type MenuItem,
} from "../../lib/firebase-store";

const EMPTY_FORM = {
  name: "", description: "", price: "", category: MENU_CATEGORIES[0] as string,
  image_url: "", stock_quantity: "50", available: true,
};

export default function AdminMenuScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    try { setItems(await getMenuItems()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setForm({
      name: item.name, description: item.description || "",
      price: item.price.toString(), category: item.category,
      image_url: item.image_url || "", stock_quantity: item.stock_quantity.toString(),
      available: item.available,
    });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert("Error", "Name and price are required."); return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(), description: form.description.trim(),
      price: parseFloat(form.price) || 0, category: form.category,
      image_url: form.image_url.trim(), stock_quantity: parseInt(form.stock_quantity) || 0,
      available: form.available,
    };
    try {
      if (editing) await updateMenuItem(editing.id, payload);
      else await addMenuItem(payload);
      setModalVisible(false);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
    setSaving(false);
  }

  function handleDelete(item: MenuItem) {
    Alert.alert("Delete", `Remove "${item.name}" from the menu?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteMenuItem(item.id); load(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu Management</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

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
                    <Image source={{ uri: item.image_url }} style={styles.cardImg} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[styles.cardImg, { backgroundColor: color + "22", justifyContent: "center", alignItems: "center" }]}>
                      <Text style={{ fontSize: 20 }}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardCat}>{item.category}</Text>
                    <Text style={styles.cardPrice}>P{item.price.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={[styles.stockText, item.stock_quantity <= 10 && { color: "#E74C3C" }]}>
                    Stock: {item.stock_quantity}
                  </Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                      <Ionicons name="pencil" size={16} color="#3498DB" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                      <Ionicons name="trash" size={16} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="restaurant-outline" size={48} color="#ddd" />
              <Text style={styles.emptyText}>No menu items yet</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? "Edit Item" : "Add Item"}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Name *</Text>
              <TextInput style={styles.input} value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Item name" placeholderTextColor="#aaa" />
              <Text style={styles.label}>Price *</Text>
              <TextInput style={styles.input} value={form.price} keyboardType="numeric"
                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                placeholder="0.00" placeholderTextColor="#aaa" />
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {MENU_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c}
                    style={[styles.chip, form.category === c && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, category: c }))}>
                    <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                multiline placeholder="Description" placeholderTextColor="#aaa" />
              <Text style={styles.label}>Image URL</Text>
              <TextInput style={styles.input} value={form.image_url}
                onChangeText={(v) => setForm((f) => ({ ...f, image_url: v }))}
                placeholder="https://..." placeholderTextColor="#aaa" autoCapitalize="none" />
              <Text style={styles.label}>Stock Quantity</Text>
              <TextInput style={styles.input} value={form.stock_quantity} keyboardType="numeric"
                onChangeText={(v) => setForm((f) => ({ ...f, stock_quantity: v }))}
                placeholder="0" placeholderTextColor="#aaa" />
              <TouchableOpacity style={styles.toggleRow}
                onPress={() => setForm((f) => ({ ...f, available: !f.available }))}>
                <Ionicons name={form.available ? "checkbox" : "square-outline"} size={22} color="#F25C05" />
                <Text style={styles.toggleText}>Available for ordering</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.saveBtnText}>{editing ? "Update" : "Add Item"}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "bold", color: "#2E1A06" },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F25C05", justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardImg: { width: 56, height: 56, borderRadius: 12 },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  cardCat: { fontSize: 11, color: "#888", marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: "bold", color: "#F25C05", marginTop: 2 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f5f0e5" },
  stockText: { fontSize: 12, color: "#555" },
  cardActions: { flexDirection: "row", gap: 12 },
  iconBtn: { padding: 4 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: "#aaa", marginTop: 10 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06" },
  label: { fontSize: 12, color: "#888", marginBottom: 4, marginTop: 10, fontWeight: "600" },
  input: { backgroundColor: "#F9F5EF", borderRadius: 10, padding: 12, fontSize: 14, color: "#333" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff", marginRight: 8 },
  chipActive: { borderColor: "#F25C05", backgroundColor: "#FEF3EC" },
  chipText: { fontSize: 12, color: "#888" },
  chipTextActive: { color: "#F25C05", fontWeight: "bold" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  toggleText: { fontSize: 14, color: "#333" },
  saveBtn: { backgroundColor: "#F25C05", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
