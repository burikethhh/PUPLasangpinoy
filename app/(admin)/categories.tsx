import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    addCategory,
    Category,
    deleteCategory as deleteCategoryFromDb,
    getCategories,
    updateCategory,
} from '../../lib/firebase';

const PRESET_COLORS = [
  '#F25C05', '#4A8FE7', '#34B36A', '#E91E8C', '#9B59B6',
  '#F39C12', '#00A8A8', '#2E7D32', '#FF6F61', '#3F51B5',
  '#E74C3C', '#1ABC9C', '#D35400', '#8E44AD', '#2980B9',
  '#27AE60', '#F1C40F', '#E67E22', '#16A085', '#C0392B',
];

// Default categories seeded from constants (used when Firestore is empty)
const DEFAULT_CATEGORIES = [
  { name: 'Main Dish', color: '#F25C05' },
  { name: 'Soup', color: '#4A8FE7' },
  { name: 'Noodles', color: '#34B36A' },
  { name: 'Dessert', color: '#E91E8C' },
  { name: 'Appetizer', color: '#9B59B6' },
  { name: 'Breakfast', color: '#F39C12' },
  { name: 'Seafood', color: '#00A8A8' },
  { name: 'Vegetable', color: '#2E7D32' },
  { name: 'Snacks', color: '#FF6F61' },
  { name: 'Beverage', color: '#3F51B5' },
];

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', color: '#F25C05' });

  useEffect(() => { fetchCategories(); }, []);

  async function fetchCategories() {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
    setLoading(false);
  }

  async function seedDefaults() {
    Alert.alert(
      'Seed Default Categories',
      'This will add the 10 default Filipino dish categories to Firestore. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed',
          style: 'default',
          onPress: async () => {
            setSeeding(true);
            try {
              for (const cat of DEFAULT_CATEGORIES) {
                await addCategory(cat.name, cat.color);
              }
              await fetchCategories();
              Alert.alert('Done', 'Default categories added!');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
            setSeeding(false);
          },
        },
      ],
    );
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: '', color: '#F25C05' });
    setModalVisible(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setForm({ name: category.name, color: category.color || '#F25C05' });
    setModalVisible(true);
  }

  async function saveCategory() {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Category name is required.');
      return;
    }
    try {
      if (editing) {
        await updateCategory(editing.id, { name: form.name.trim(), color: form.color });
      } else {
        await addCategory(form.name.trim(), form.color);
      }
      setModalVisible(false);
      fetchCategories();
      Alert.alert('Success', editing ? 'Category updated!' : 'Category added!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    Alert.alert('Delete Category', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategoryFromDb(id);
            fetchCategories();
            Alert.alert('Deleted', `"${name}" has been deleted.`);
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#2E1A06" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Categories</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading || seeding ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
          {categories.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetag-outline" size={40} color="#ccc" />
              <Text style={styles.empty}>No categories yet.</Text>
              <Text style={styles.emptySub}>Add one or seed the defaults below.</Text>
              <TouchableOpacity style={styles.seedBtn} onPress={seedDefaults}>
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.seedBtnText}>Seed Default Categories</Text>
              </TouchableOpacity>
            </View>
          )}

          {categories.map((cat) => (
            <View key={cat.id} style={styles.categoryCard}>
              <View style={[styles.categoryIcon, { backgroundColor: (cat.color || '#888') + '22' }]}>
                <View style={[styles.colorDot, { backgroundColor: cat.color || '#888' }]} />
              </View>
              <Text style={styles.categoryName}>{cat.name}</Text>
              <Text style={[styles.colorBadge, { backgroundColor: (cat.color || '#888') + '20', color: cat.color || '#888' }]}>
                {cat.color || ''}
              </Text>
              <View style={styles.actionBtns}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(cat)}>
                  <Ionicons name="pencil" size={16} color="#4A8FE7" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteCategory(cat.id, cat.name)}>
                  <Ionicons name="trash" size={16} color="#D92614" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {categories.length > 0 && (
            <TouchableOpacity style={styles.seedBtnSecondary} onPress={seedDefaults}>
              <Ionicons name="download-outline" size={14} color="#888" />
              <Text style={styles.seedBtnSecondaryText}>Re-seed Default Categories</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Category' : 'Add Category'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Grilled, Street Food, Rice Dish"
                placeholderTextColor="#bbb"
                value={form.name}
                onChangeText={(v) => setForm(prev => ({ ...prev, name: v }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Color</Text>
              <View style={styles.colorPreview}>
                <View style={[styles.colorPreviewDot, { backgroundColor: form.color }]} />
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="#F25C05"
                  placeholderTextColor="#bbb"
                  value={form.color}
                  onChangeText={(v) => setForm(prev => ({ ...prev, color: v }))}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Quick Pick</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c },
                    form.color === c && styles.colorSwatchSelected]}
                  onPress={() => setForm(prev => ({ ...prev, color: c }))}
                >
                  {form.color === c && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveCategory}>
                <Text style={styles.saveText}>{editing ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0DC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#2E1A06' },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F25C05', justifyContent: 'center', alignItems: 'center',
  },
  emptyContainer: { alignItems: 'center', marginTop: 40, gap: 8 },
  empty: { textAlign: 'center', color: '#aaa', fontSize: 15, fontWeight: '600' },
  emptySub: { textAlign: 'center', color: '#bbb', fontSize: 12 },
  seedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F25C05', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, marginTop: 8,
  },
  seedBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  seedBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 8, padding: 12,
  },
  seedBtnSecondaryText: { color: '#888', fontSize: 12 },
  categoryCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
    alignItems: 'center', gap: 12,
    elevation: 2,
    // @ts-ignore - web shadow
    boxShadow: '0px 1px 6px rgba(0, 0, 0, 0.06)',
  },
  categoryIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  colorDot: { width: 20, height: 20, borderRadius: 10 },
  categoryName: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#2E1A06' },
  colorBadge: {
    fontSize: 10, fontWeight: '600', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 6,
  },
  actionBtns: { flexDirection: 'row', gap: 8 },
  editBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#4A8FE722', justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#D9261422', justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2E1A06' },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, color: '#555', marginBottom: 4, fontWeight: '600' },
  input: {
    backgroundColor: '#FDF5E0', borderRadius: 10,
    padding: 12, fontSize: 13, color: '#333', height: 46,
  },
  colorPreview: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorPreviewDot: { width: 36, height: 36, borderRadius: 10 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 4 },
  colorSwatch: {
    width: 34, height: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2, borderColor: '#2E1A06',
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, backgroundColor: '#eee', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  cancelText: { color: '#666', fontWeight: '600' },
  saveBtn: {
    flex: 1, backgroundColor: '#F25C05', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: 'bold' },
});
