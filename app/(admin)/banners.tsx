import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert, Dimensions, FlatList,
    Modal, StyleSheet, Switch, Text, TextInput,
    TouchableOpacity, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../lib/firebase";
import { type Banner } from "../../lib/firebase-store";

const { width } = Dimensions.get("window");

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", imageUrl: "", active: true });

  useFocusEffect(useCallback(() => { loadBanners(); }, []));

  async function loadBanners() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "banners"));
      const data = snap.docs.map(d => {
        const docData = d.data();
        return {
          id: d.id,
          ...docData,
          createdAt: docData.createdAt?.toDate?.() || new Date(docData.createdAt || Date.now())
        } as Banner;
      });
      data.sort((a,b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
      setBanners(data);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", "Could not load banners");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditId(null);
    setForm({ name: "", imageUrl: "", active: true });
    setModalVisible(true);
  }

  function openEdit(banner: Banner) {
    setEditId(banner.id);
    setForm({ name: banner.name, imageUrl: banner.imageUrl, active: banner.active });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.imageUrl.trim()) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "banners", editId), {
          name: form.name.trim(),
          imageUrl: form.imageUrl.trim(),
          active: form.active,
        });
      } else {
        await addDoc(collection(db, "banners"), {
          name: form.name.trim(),
          imageUrl: form.imageUrl.trim(),
          active: form.active,
          createdAt: new Date()
        });
      }
      setModalVisible(false);
      loadBanners();
    } catch (e: any) {
      Alert.alert("Error storing", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this banner?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteDoc(doc(db, "banners", id));
            loadBanners();
          } catch(e:any) { Alert.alert("Error", e.message); }
      }}
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Banners</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{marginTop: 60}} />
      ) : (
        <FlatList
          data={banners}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.active && { opacity: 0.5 }]}>
              <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardStatus}>{item.active ? "Active" : "Inactive"}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                    <Ionicons name="pencil" size={20} color="#F25C05" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
                    <Ionicons name="trash" size={20} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Form Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editId ? "Edit Banner" : "New Banner"}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={28} color="#888" /></TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Banner Name (Offer/Title)</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(t) => setForm({...form, name: t})} placeholder="e.g. Summer Sale!" placeholderTextColor="#aaa" />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Image URL</Text>
              <TextInput style={styles.input} value={form.imageUrl} onChangeText={(t) => setForm({...form, imageUrl: t})} placeholder="https://..." placeholderTextColor="#aaa" />
            </View>

            <View style={[styles.formGroup, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
              <Text style={styles.toggleLabel}>Active (Visible to users)</Text>
              <Switch value={form.active} onValueChange={(v) => setForm({...form, active: v})} trackColor={{ false: "#ddd", true: "#F25C05" }} />
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && {opacity: 0.7}]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Banner</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: "bold", color: "#2E1A06" },
  addBtn: { backgroundColor: "#F25C05", width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 14, overflow: "hidden", elevation: 2 },
  image: { width: "100%", height: 140, backgroundColor: "#f0e8d0" },
  cardInfo: { padding: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: "#2E1A06", flex: 1 },
  cardStatus: { fontSize: 12, color: "#888", width: 48, textAlign: "right" },
  cardActions: { flexDirection: "row", gap: 12, paddingLeft: 8 },
  iconBtn: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, elevation: 5 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#2E1A06" },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: "#888", marginBottom: 6, fontWeight: "600" },
  toggleLabel: { fontSize: 14, color: "#333", fontWeight: "600" },
  input: { backgroundColor: "#F9F5EF", borderRadius: 10, padding: 12, fontSize: 14, color: "#333" },
  saveBtn: { backgroundColor: "#F25C05", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 12 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "bold" }
});
