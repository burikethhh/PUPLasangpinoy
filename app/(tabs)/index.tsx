import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  ingredients: string;
  category: string;
  region: string;
};

const CATEGORIES = [
  { label: 'All', value: '', color: '#F25C05' },
  { label: 'Main Dish', value: 'Main Dish', color: '#F25C05' },
  { label: 'Soup', value: 'Soup', color: '#4A8FE7' },
  { label: 'Noodles', value: 'Noodles', color: '#34B36A' },
];

export default function HomeScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => { fetchRecipes(); }, [activeCategory]);

  async function fetchRecipes(keyword = '') {
    setLoading(true);
    let query = supabase.from('recipes').select('*');
    if (activeCategory) query = query.eq('category', activeCategory);
    if (keyword) query = query.or(`title.ilike.%${keyword}%,ingredients.ilike.%${keyword}%`);
    const { data } = await query.order('created_at', { ascending: false });
    setRecipes(data || []);
    setLoading(false);
  }

  const catColors: Record<string, string> = {
    'Main Dish': '#F25C05', 'Soup': '#4A8FE7', 'Noodles': '#34B36A',
  };
  const catIcons: Record<string, string> = {
    'Main Dish': 'M', 'Soup': 'S', 'Noodles': 'N',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}>

        {/* TOP BAR */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.appTitle}>Lasang Pinoy</Text>
            <Text style={styles.appSub}>Discover Filipino flavors</Text>
          </View>
          <View style={styles.topBtns}>
            <TouchableOpacity style={styles.chatBtn}
              onPress={() => router.push('/(tabs)/chat')}>
              <Text style={styles.chatBtnText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.userBtn}
              onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.userBtnText}>User</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#aaa" style={{ marginLeft: 14 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => fetchRecipes(search)}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); fetchRecipes(); }}
              style={{ marginRight: 12 }}>
              <Ionicons name="close-circle" size={18} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>

        {/* SCAN BANNER */}
        <TouchableOpacity style={styles.scanBanner}
          onPress={() => router.push('/(tabs)/scan')}>
          <View style={styles.scanIconBox}>
            <Ionicons name="camera" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanTitle}>Scan Ingredients</Text>
            <Text style={styles.scanSub}>Get recipe suggestions from your pantry</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>

        {/* CATEGORY FILTER */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[styles.catBtn,
                  isActive && { backgroundColor: cat.color }]}
                onPress={() => setActiveCategory(cat.value)}>
                <Text style={[styles.catText,
                  isActive && { color: '#fff' }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* RECIPES */}
        <Text style={styles.sectionTitle}>
          {activeCategory || 'Popular Dishes'}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
        ) : recipes.length === 0 ? (
          <Text style={styles.noResults}>No recipes found.</Text>
        ) : (
          recipes.map((recipe) => {
            const color = catColors[recipe.category] || '#F25C05';
            const icon = catIcons[recipe.category] || 'R';
            const ing = recipe.ingredients?.length > 48
              ? recipe.ingredients.substring(0, 48) + '...'
              : recipe.ingredients;
            return (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => router.push(`/recipe/${recipe.id}`)}>
                <View style={[styles.iconBox, { backgroundColor: color + '25' }]}>
                  <Text style={[styles.iconText, { color }]}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeTitle}>{recipe.title}</Text>
                  <Text style={styles.recipeIng}>{ing}</Text>
                  <View style={styles.tagRow}>
                    <Text style={[styles.recipeCat, { color }]}>{recipe.category}</Text>
                    {recipe.region ? (
                      <View style={styles.regionTag}>
                        <Ionicons name="map-outline" size={10} color="#9B59B6" />
                        <Text style={styles.regionText}>{recipe.region}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0DC' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 10,
  },
  appTitle: { fontSize: 18, fontWeight: 'bold', color: '#2E1A06' },
  appSub: { fontSize: 11, color: '#B07820', marginTop: 2 },
  topBtns: { flexDirection: 'row', gap: 8 },
  chatBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#F25C05',
    justifyContent: 'center', alignItems: 'center',
  },
  chatBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  userBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#DDDDDD',
    justifyContent: 'center', alignItems: 'center',
  },
  userBtnText: { color: '#444', fontSize: 11, fontWeight: 'bold' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 28,
    marginHorizontal: 16, marginBottom: 14, height: 50,
  },
  searchInput: {
    flex: 1, fontSize: 13, color: '#333',
    paddingHorizontal: 8, height: '100%',
  },
  scanBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#4A8FE7', borderRadius: 18,
    marginHorizontal: 16, marginBottom: 16,
    padding: 16, gap: 14, minHeight: 90,
  },
  scanIconBox: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  scanTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  scanSub: { fontSize: 11, color: 'rgba(255,255,255,0.88)', marginTop: 3 },
  sectionTitle: {
    fontSize: 16, fontWeight: 'bold', color: '#2E1A06',
    marginHorizontal: 16, marginBottom: 10, marginTop: 4,
  },
  catRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  catBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E8D8A0',
  },
  catText: { fontSize: 13, fontWeight: '600', color: '#888' },
  recipeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 10,
    padding: 14, gap: 12,
  },
  iconBox: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  iconText: { fontSize: 20, fontWeight: 'bold' },
  recipeTitle: { fontSize: 13, fontWeight: 'bold', color: '#2E1A06' },
  recipeIng: { fontSize: 10, color: '#888', marginTop: 2 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  recipeCat: { fontSize: 10, fontWeight: '600' },
  regionTag: {
    flexDirection: 'row', alignItems: 'center',
    gap: 3, backgroundColor: '#9B59B622',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  regionText: { fontSize: 9, color: '#9B59B6', fontWeight: '600' },
  noResults: { textAlign: 'center', color: '#aaa', marginTop: 40 },
});