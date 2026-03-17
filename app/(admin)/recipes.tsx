import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  id: number;
  title: string;
  category: string;
  ingredients: string;
  instructions: string;
  nutrition: string;
  health_notes: string;
  region: string;
  image_url: string;
};

type Errors = {
  title?: string;
  category?: string;
  ingredients?: string;
  instructions?: string;
};

export default function AdminRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [regions, setRegions] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState({
    title: '', category: '', ingredients: '',
    instructions: '', nutrition: '', health_notes: '',
    region: '', image_url: ''
  });

  useEffect(() => {
    fetchRecipes();
    fetchRegions();
  }, []);

  async function fetchRecipes() {
    setLoading(true);
    const { data } = await supabase
      .from('recipes').select('*')
      .order('created_at', { ascending: false });
    setRecipes(data || []);
    setLoading(false);
  }

  async function fetchRegions() {
    const { data } = await supabase
      .from('regions').select('id, name').order('name');
    setRegions(data || []);
  }

  function openAdd() {
    setEditing(null);
    setSelectedImage(null);
    setErrors({});
    setForm({
      title: '', category: '', ingredients: '',
      instructions: '', nutrition: '', health_notes: '',
      region: '', image_url: ''
    });
    setModalVisible(true);
  }

  function openEdit(recipe: Recipe) {
    setEditing(recipe);
    setSelectedImage(null);
    setErrors({});
    setForm({
      title: recipe.title || '',
      category: recipe.category || '',
      ingredients: recipe.ingredients || '',
      instructions: recipe.instructions || '',
      nutrition: recipe.nutrition || '',
      health_notes: recipe.health_notes || '',
      region: recipe.region || '',
      image_url: recipe.image_url || '',
    });
    setModalVisible(true);
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  }

  function validate(): boolean {
    const newErrors: Errors = {};
    if (!form.title.trim()) {
      newErrors.title = 'Recipe title is required.';
    } else if (form.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters.';
    }
    if (!form.category.trim()) {
      newErrors.category = 'Category is required.';
    } else if (!['Main Dish', 'Soup', 'Noodles'].includes(form.category.trim())) {
      newErrors.category = 'Category must be: Main Dish, Soup, or Noodles';
    }
    if (!form.ingredients.trim()) {
      newErrors.ingredients = 'Ingredients are required.';
    } else if (form.ingredients.trim().length < 5) {
      newErrors.ingredients = 'Please enter valid ingredients.';
    }
    if (!form.instructions.trim()) {
      newErrors.instructions = 'Instructions are required.';
    } else if (form.instructions.trim().length < 10) {
      newErrors.instructions = 'Please enter more detailed instructions.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function autoSaveRegion(regionName: string) {
    if (!regionName.trim()) return;
    const { data: existing } = await supabase
      .from('regions')
      .select('id')
      .eq('name', regionName.trim())
      .single();
    if (!existing) {
      await supabase.from('regions').insert({
        name: regionName.trim(),
        description: ''
      });
      fetchRegions();
    }
  }

  async function saveRecipe() {
    if (!validate()) return;
    setUploading(true);
    try {
      let imageUrl = form.image_url || '';
      if (selectedImage) {
        const fileName = `recipe_${Date.now()}.jpg`;
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from('recipe-images')
          .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('recipe-images').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      // Auto-save region to regions table
      await autoSaveRegion(form.region);

      const recipeData = { ...form, image_url: imageUrl };
      if (editing) {
        await supabase.from('recipes').update(recipeData).eq('id', editing.id);
      } else {
        await supabase.from('recipes').insert({ ...recipeData, user_id: null });
      }
      setModalVisible(false);
      setSelectedImage(null);
      fetchRecipes();
      Alert.alert('Success ✅', editing ? 'Recipe updated!' : 'Recipe added!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setUploading(false);
  }

  async function deleteRecipe(id: number, title: string) {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await supabase.from('recipes').delete().eq('id', id);
            fetchRecipes();
            Alert.alert('Deleted ✅', `"${title}" has been deleted.`);
          }
        }
      ]
    );
  }

  const catColors: Record<string, string> = {
    'Main Dish': '#F25C05', 'Soup': '#4A8FE7', 'Noodles': '#34B36A',
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#2E1A06" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Recipes</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
          {recipes.length === 0 ? (
            <Text style={styles.emptyText}>No recipes yet. Add one!</Text>
          ) : (
            recipes.map((recipe, index) => (
              <View key={recipe.id} style={styles.recipeCard}>
                {recipe.image_url ? (
                  <Image source={{ uri: recipe.image_url }}
                    style={styles.recipeImage} />
                ) : (
                  <View style={[styles.recipeImagePlaceholder,
                    { backgroundColor: (catColors[recipe.category] || '#888') + '22' }]}>
                    <Text style={{ fontSize: 24 }}>🍽️</Text>
                  </View>
                )}
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeNum}>#{index + 1}</Text>
                  <Text style={styles.recipeTitle}>{recipe.title}</Text>
                  <View style={styles.tagRow}>
                    {recipe.category ? (
                      <View style={[styles.tag,
                        { backgroundColor: (catColors[recipe.category] || '#888') + '22' }]}>
                        <Text style={[styles.tagText,
                          { color: catColors[recipe.category] || '#888' }]}>
                          {recipe.category}
                        </Text>
                      </View>
                    ) : null}
                    {recipe.region ? (
                      <View style={[styles.tag, { backgroundColor: '#9B59B622' }]}>
                        <Text style={[styles.tagText, { color: '#9B59B6' }]}>
                          {recipe.region}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.actionBtns}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(recipe)}>
                    <Ionicons name="pencil" size={16} color="#4A8FE7" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn}
                    onPress={() => deleteRecipe(recipe.id, recipe.title)}>
                    <Ionicons name="trash" size={16} color="#D92614" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing ? 'Edit Recipe' : 'Add Recipe'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>

              {/* IMAGE PICKER */}
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {selectedImage || form.image_url ? (
                  <Image
                    source={{ uri: selectedImage || form.image_url }}
                    style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera" size={32} color="#aaa" />
                    <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* TITLE */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Recipe Title <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  placeholder="e.g. Chicken Adobo"
                  placeholderTextColor="#bbb"
                  value={form.title}
                  onChangeText={(v) => {
                    setForm(prev => ({ ...prev, title: v }));
                    if (errors.title) setErrors(prev => ({ ...prev, title: undefined }));
                  }}
                />
                {errors.title ? (
                  <Text style={styles.errorText}>⚠ {errors.title}</Text>
                ) : null}
              </View>

              {/* CATEGORY */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Category <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.catButtons}>
                  {['Main Dish', 'Soup', 'Noodles'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catSelectBtn,
                        form.category === cat && {
                          backgroundColor: catColors[cat],
                          borderColor: catColors[cat]
                        }]}
                      onPress={() => {
                        setForm(prev => ({ ...prev, category: cat }));
                        if (errors.category) setErrors(prev => ({ ...prev, category: undefined }));
                      }}>
                      <Text style={[styles.catSelectText,
                        form.category === cat && { color: '#fff' }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.category ? (
                  <Text style={styles.errorText}>⚠ {errors.category}</Text>
                ) : null}
              </View>

              {/* REGION - DROPDOWN + MANUAL INPUT */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Region</Text>

                {/* Existing regions as buttons */}
                {regions.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {regions.map((region) => (
                        <TouchableOpacity
                          key={region.id}
                          style={[styles.regionBtn,
                            form.region === region.name && {
                              backgroundColor: '#9B59B6',
                              borderColor: '#9B59B6'
                            }]}
                          onPress={() => setForm(prev => ({ ...prev, region: region.name }))}>
                          <Text style={[styles.regionBtnText,
                            form.region === region.name && { color: '#fff' }]}>
                            {region.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}

                {/* Manual input for new region */}
                <TextInput
                  style={styles.input}
                  placeholder="Or type a new region..."
                  placeholderTextColor="#bbb"
                  value={form.region}
                  onChangeText={(v) => setForm(prev => ({ ...prev, region: v }))}
                />
                {form.region ? (
                  <Text style={{ fontSize: 11, color: '#9B59B6', marginTop: 4 }}>
                    📍 Selected: {form.region}
                  </Text>
                ) : null}
              </View>

              {/* INGREDIENTS */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Ingredients <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' },
                    errors.ingredients && styles.inputError]}
                  placeholder="Comma separated e.g. Chicken, Soy sauce, Garlic"
                  placeholderTextColor="#bbb"
                  value={form.ingredients}
                  onChangeText={(v) => {
                    setForm(prev => ({ ...prev, ingredients: v }));
                    if (errors.ingredients) setErrors(prev => ({ ...prev, ingredients: undefined }));
                  }}
                  multiline
                />
                {errors.ingredients ? (
                  <Text style={styles.errorText}>⚠ {errors.ingredients}</Text>
                ) : null}
              </View>

              {/* INSTRUCTIONS */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Instructions <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, { height: 100, textAlignVertical: 'top' },
                    errors.instructions && styles.inputError]}
                  placeholder="Step by step instructions..."
                  placeholderTextColor="#bbb"
                  value={form.instructions}
                  onChangeText={(v) => {
                    setForm(prev => ({ ...prev, instructions: v }));
                    if (errors.instructions) setErrors(prev => ({ ...prev, instructions: undefined }));
                  }}
                  multiline
                />
                {errors.instructions ? (
                  <Text style={styles.errorText}>⚠ {errors.instructions}</Text>
                ) : null}
              </View>

              {/* NUTRITION */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nutrition Info</Text>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="e.g. Calories: 320kcal, Protein: 28g"
                  placeholderTextColor="#bbb"
                  value={form.nutrition}
                  onChangeText={(v) => setForm(prev => ({ ...prev, nutrition: v }))}
                  multiline
                />
              </View>

              {/* HEALTH NOTES */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Health Notes</Text>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="e.g. High protein, Low fat"
                  placeholderTextColor="#bbb"
                  value={form.health_notes}
                  onChangeText={(v) => setForm(prev => ({ ...prev, health_notes: v }))}
                  multiline
                />
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn}
                  onPress={saveRecipe} disabled={uploading}>
                  {uploading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveText}>
                        {editing ? 'Update' : 'Save'}
                      </Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 },
  recipeCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 14, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  recipeImage: { width: 80, height: 80 },
  recipeImagePlaceholder: {
    width: 80, height: 80,
    justifyContent: 'center', alignItems: 'center',
  },
  recipeInfo: { flex: 1, padding: 12 },
  recipeNum: { fontSize: 10, color: '#aaa', marginBottom: 2 },
  recipeTitle: { fontSize: 14, fontWeight: 'bold', color: '#2E1A06', marginBottom: 6 },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '600' },
  actionBtns: { gap: 8, justifyContent: 'center', paddingRight: 12 },
  editBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#4A8FE722', justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#D9261422', justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20, maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2E1A06' },
  imagePicker: { marginBottom: 16 },
  imagePreview: {
    width: '100%', height: 200,
    borderRadius: 12, backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    width: '100%', height: 140,
    borderRadius: 12, backgroundColor: '#FDF5E0',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#E8D8A0', borderStyle: 'dashed',
  },
  imagePlaceholderText: { color: '#aaa', marginTop: 8, fontSize: 13 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, color: '#555', marginBottom: 6, fontWeight: '600' },
  required: { color: '#D92614' },
  input: {
    backgroundColor: '#FDF5E0', borderRadius: 10,
    padding: 12, fontSize: 13, color: '#333', height: 46,
    borderWidth: 1, borderColor: 'transparent',
  },
  inputError: {
    borderWidth: 1, borderColor: '#D92614',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#D92614', fontSize: 11,
    marginTop: 4, marginLeft: 4,
  },
  catButtons: { flexDirection: 'row', gap: 8 },
  catSelectBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E8D8A0',
    alignItems: 'center', backgroundColor: '#fff',
  },
  catSelectText: { fontSize: 12, fontWeight: '600', color: '#888' },
  regionBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: '#9B59B622', backgroundColor: '#fff',
  },
  regionBtnText: { fontSize: 12, fontWeight: '600', color: '#9B59B6' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 20 },
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