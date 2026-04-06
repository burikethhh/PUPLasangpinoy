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
import { FOOD_CATEGORIES, FOOD_CATEGORY_COLORS } from '../../constants/food-categories';
import {
    addRecipe,
    addRegion,
    Category,
    deleteRecipe as deleteRecipeFromDb,
    getCategories,
    getRecipeEngagement,
    getRecipes,
    getRegions,
    Recipe,
    RecipeEngagement,
    Region,
    updateRecipe,
    uploadRecipeImage,
} from '../../lib/firebase';

type Errors = {
  title?: string;
  category?: string;
  ingredients?: string;
  instructions?: string;
};

export default function AdminRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [engagementVisible, setEngagementVisible] = useState(false);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementRecipe, setEngagementRecipe] = useState<Recipe | null>(null);
  const [engagement, setEngagement] = useState<RecipeEngagement | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState({
    title: '', category: '', ingredients: '',
    instructions: '', nutrition: '', health_notes: '',
    region: '', image_url: '', history: '', fun_fact: ''
  });

  useEffect(() => {
    fetchRecipes();
    fetchRegions();
    fetchCategories();
  }, []);

  async function fetchRecipes() {
    setLoading(true);
    try {
      const data = await getRecipes();
      setRecipes(data);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    }
    setLoading(false);
  }

  async function fetchRegions() {
    try {
      const data = await getRegions();
      setRegions(data);
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  }

  async function fetchCategories() {
    try {
      const data = await getCategories();
      // Fall back to hardcoded constants if Firestore empty
      if (data.length > 0) {
        setCategories(data);
      } else {
        setCategories(FOOD_CATEGORIES.map((name) => ({
          id: name, name,
          color: FOOD_CATEGORY_COLORS[name] || '#888',
          created_at: new Date() as any,
        })));
      }
    } catch (error) {
      setCategories(FOOD_CATEGORIES.map((name) => ({
        id: name, name,
        color: FOOD_CATEGORY_COLORS[name] || '#888',
        created_at: new Date() as any,
      })));
    }
  }

  function openAdd() {
    setEditing(null);
    setSelectedImage(null);
    setErrors({});
    setForm({
      title: '', category: '', ingredients: '',
      instructions: '', nutrition: '', health_notes: '',
      region: '', image_url: '', history: '', fun_fact: ''
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
      history: recipe.history || '',
      fun_fact: recipe.fun_fact || '',
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
      mediaTypes: ['images'],
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
    // Check if region already exists
    const existingRegion = regions.find(r => r.name.toLowerCase() === regionName.trim().toLowerCase());
    if (!existingRegion) {
      try {
        await addRegion(regionName.trim(), '');
        fetchRegions();
      } catch (error) {
        console.error('Error auto-saving region:', error);
      }
    }
  }

  async function saveRecipe() {
    if (!validate()) return;
    setUploading(true);
    try {
      let imageUrl = form.image_url || '';
      
      // Upload local image to Firebase Storage
      if (selectedImage) {
        const tempId = editing?.id || `new_${Date.now()}`;
        imageUrl = await uploadRecipeImage(selectedImage, tempId);
      }

      // Auto-save region to regions collection
      await autoSaveRegion(form.region);

      const recipeData = {
        title: form.title,
        category: form.category,
        ingredients: form.ingredients,
        instructions: form.instructions,
        nutrition: form.nutrition,
        health_notes: form.health_notes,
        region: form.region,
        image_url: imageUrl,
        history: form.history,
        fun_fact: form.fun_fact,
      };

      if (editing) {
        await updateRecipe(editing.id, recipeData);
      } else {
        await addRecipe({ ...recipeData, user_id: '' });
      }
      setModalVisible(false);
      setSelectedImage(null);
      fetchRecipes();
      Alert.alert('Success', editing ? 'Recipe updated!' : 'Recipe added!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setUploading(false);
  }

  async function handleDeleteRecipe(id: string, title: string) {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecipeFromDb(id);
              fetchRecipes();
              Alert.alert('Deleted', `"${title}" has been deleted.`);
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  }

  async function openEngagement(recipe: Recipe) {
    setEngagementRecipe(recipe);
    setEngagementVisible(true);
    setEngagementLoading(true);
    try {
      const data = await getRecipeEngagement(recipe.id);
      setEngagement(data);
    } catch (error) {
      console.error('Error loading engagement:', error);
      Alert.alert('Error', 'Failed to load engagement data.');
    } finally {
      setEngagementLoading(false);
    }
  }

  const catColors: Record<string, string> = {
    ...FOOD_CATEGORY_COLORS,
    ...Object.fromEntries(categories.map((c) => [c.name, c.color])),
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
                  <TouchableOpacity style={styles.statsBtn} onPress={() => openEngagement(recipe)}>
                    <Ionicons name="analytics" size={16} color="#9B59B6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(recipe)}>
                    <Ionicons name="pencil" size={16} color="#4A8FE7" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn}
                    onPress={() => handleDeleteRecipe(recipe.id, recipe.title)}>
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

              {/* IMAGE URL INPUT */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Or paste Image URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://example.com/image.jpg"
                  placeholderTextColor="#bbb"
                  value={form.image_url}
                  onChangeText={(v) => setForm(prev => ({ ...prev, image_url: v }))}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

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
                  <Text style={styles.errorText}>{errors.title}</Text>
                ) : null}
              </View>

              {/* CATEGORY */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Category <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.catButtons}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catSelectBtn,
                        form.category === cat.name && {
                          backgroundColor: cat.color || catColors[cat.name],
                          borderColor: cat.color || catColors[cat.name]
                        }]}
                      onPress={() => {
                        setForm(prev => ({ ...prev, category: cat.name }));
                        if (errors.category) setErrors(prev => ({ ...prev, category: undefined }));
                      }}>
                      <Text style={[styles.catSelectText,
                        form.category === cat.name && { color: '#fff' }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.category ? (
                  <Text style={styles.errorText}>{errors.category}</Text>
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
                    Selected: {form.region}
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
                  <Text style={styles.errorText}>{errors.ingredients}</Text>
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
                  <Text style={styles.errorText}>{errors.instructions}</Text>
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

              {/* HISTORY / BACKGROUND */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>History / Background</Text>
                <TextInput
                  style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                  placeholder="Historical background of this dish..."
                  placeholderTextColor="#bbb"
                  value={form.history}
                  onChangeText={(v) => setForm(prev => ({ ...prev, history: v }))}
                  multiline
                />
              </View>

              {/* FUN FACT */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fun Fact</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Interesting fact about this dish..."
                  placeholderTextColor="#bbb"
                  value={form.fun_fact}
                  onChangeText={(v) => setForm(prev => ({ ...prev, fun_fact: v }))}
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

      <Modal visible={engagementVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.modalTitle}>Recipe Engagement</Text>
                <Text style={{ color: '#888', fontSize: 12 }} numberOfLines={1}>
                  {engagementRecipe?.title || 'Recipe'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEngagementVisible(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            {engagementLoading ? (
              <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 24 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.engagementSummaryRow}>
                  <View style={styles.engagementSummaryCard}>
                    <Text style={styles.engagementSummaryNumber}>
                      {engagement?.bookmark_users.length || 0}
                    </Text>
                    <Text style={styles.engagementSummaryLabel}>Bookmarked</Text>
                  </View>
                  <View style={styles.engagementSummaryCard}>
                    <Text style={styles.engagementSummaryNumber}>
                      {engagement?.rating_users.length || 0}
                    </Text>
                    <Text style={styles.engagementSummaryLabel}>Rated</Text>
                  </View>
                </View>

                <Text style={styles.engagementTitle}>Users Who Bookmarked</Text>
                {(engagement?.bookmark_users.length || 0) === 0 ? (
                  <Text style={styles.engagementEmpty}>No bookmark data yet.</Text>
                ) : (
                  engagement?.bookmark_users.map((u) => (
                    <View key={`b_${u.user_id}_${u.email}`} style={styles.engagementRow}>
                      <Ionicons name="bookmark" size={16} color="#F25C05" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.engagementName}>{u.username}</Text>
                        <Text style={styles.engagementSub}>{u.email}</Text>
                      </View>
                    </View>
                  ))
                )}

                <Text style={[styles.engagementTitle, { marginTop: 16 }]}>Users Who Rated</Text>
                {(engagement?.rating_users.length || 0) === 0 ? (
                  <Text style={styles.engagementEmpty}>No rating data yet.</Text>
                ) : (
                  engagement?.rating_users.map((u) => (
                    <View key={`r_${u.user_id}_${u.email}_${u.rating}`} style={styles.engagementRow}>
                      <Ionicons name="star" size={16} color="#FFB800" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.engagementName}>{u.username}</Text>
                        <Text style={styles.engagementSub}>{u.email}</Text>
                        <Text style={styles.engagementComment}>
                          {u.rating}/5{u.comment ? ` • ${u.comment}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
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
    elevation: 2,
    // @ts-ignore - web shadow
    boxShadow: '0px 1px 6px rgba(0, 0, 0, 0.06)',
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
  statsBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#9B59B622', justifyContent: 'center', alignItems: 'center',
  },
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
  catButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
  engagementSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  engagementSummaryCard: {
    flex: 1,
    backgroundColor: '#F9F5EF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  engagementSummaryNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E1A06',
  },
  engagementSummaryLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  engagementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E1A06',
    marginBottom: 8,
  },
  engagementEmpty: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  engagementName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E1A06',
  },
  engagementSub: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  engagementComment: {
    fontSize: 11,
    color: '#555',
    marginTop: 4,
  },
});
