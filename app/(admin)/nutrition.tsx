import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type Recipe = {
  id: number; title: string;
  nutrition: string; health_notes: string;
};

export default function AdminNutrition() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [form, setForm] = useState({ nutrition: '', health_notes: '' });

  useEffect(() => { fetchRecipes(); }, []);

  async function fetchRecipes() {
    setLoading(true);
    const { data } = await supabase
      .from('recipes').select('id, title, nutrition, health_notes')
      .order('title');
    setRecipes(data || []);
    setLoading(false);
  }

  function openEdit(recipe: Recipe) {
    setEditing(recipe);
    setForm({
      nutrition: recipe.nutrition || '',
      health_notes: recipe.health_notes || '',
    });
    setModalVisible(true);
  }

  async function saveNutrition() {
    if (!editing) return;
    await supabase.from('recipes')
      .update({ nutrition: form.nutrition, health_notes: form.health_notes })
      .eq('id', editing.id);
    setModalVisible(false);
    fetchRecipes();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#2E1A06" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nutrition & Health</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#34B36A" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
          {recipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.recipeCard}
              onPress={() => openEdit(recipe)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                {recipe.nutrition ? (
                  <Text style={styles.nutritionText}>🥗 {recipe.nutrition}</Text>
                ) : (
                  <Text style={styles.emptyText}>No nutrition info yet</Text>
                )}
                {recipe.health_notes ? (
                  <Text style={styles.healthText}>💚 {recipe.health_notes}</Text>
                ) : null}
              </View>
              <Ionicons name="pencil" size={18} color="#34B36A" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing?.title}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>🥗 Nutrition Info</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="e.g. Calories: 320kcal, Protein: 28g, Fat: 12g"
                placeholderTextColor="#bbb"
                value={form.nutrition}
                onChangeText={(v) => setForm(prev => ({ ...prev, nutrition: v }))}
                multiline
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>💚 Health Notes</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="e.g. High protein, Low fat, Good for immunity"
                placeholderTextColor="#bbb"
                value={form.health_notes}
                onChangeText={(v) => setForm(prev => ({ ...prev, health_notes: v }))}
                multiline
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveNutrition}>
                <Text style={styles.saveText}>Save</Text>
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
  recipeCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  recipeTitle: { fontSize: 14, fontWeight: 'bold', color: '#2E1A06', marginBottom: 4 },
  nutritionText: { fontSize: 11, color: '#34B36A', marginBottom: 2 },
  healthText: { fontSize: 11, color: '#4A8FE7' },
  emptyText: { fontSize: 11, color: '#bbb', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E1A06', flex: 1 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, color: '#555', marginBottom: 4, fontWeight: '600' },
  input: {
    backgroundColor: '#FDF5E0', borderRadius: 10,
    padding: 12, fontSize: 13, color: '#333',
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: '#eee', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  cancelText: { color: '#666', fontWeight: '600' },
  saveBtn: {
    flex: 1, backgroundColor: '#34B36A', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: 'bold' },
});