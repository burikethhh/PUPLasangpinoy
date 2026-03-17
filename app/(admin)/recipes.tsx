import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type Recipe = {
  id: number;
  title: string;
  ingredients: string;
  instructions: string;
  category: string;
  nutrition: string;
  health_notes: string;
  region: string;
};

export default function RecipeDetail() {
  const { id } = useLocalSearchParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRecipe(); }, [id]);

  async function fetchRecipe() {
    const { data } = await supabase
      .from('recipes').select('*').eq('id', id).single();
    setRecipe(data);
    setLoading(false);
  }

  const catColors: Record<string, string> = {
    'Main Dish': '#F25C05', 'Soup': '#4A8FE7', 'Noodles': '#34B36A',
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 100 }} />
    </SafeAreaView>
  );

  if (!recipe) return (
    <SafeAreaView style={styles.container}>
      <Text style={{ textAlign: 'center', marginTop: 100 }}>Recipe not found.</Text>
    </SafeAreaView>
  );

  const color = catColors[recipe.category] || '#F25C05';
  const ingList = recipe.ingredients?.split(',').map((i: string) => i.trim()) || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#2E1A06" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={2}>{recipe.title}</Text>
        </View>

        {/* TAGS */}
        <View style={styles.tagsRow}>
          {recipe.category ? (
            <View style={[styles.tag, { backgroundColor: color + '22' }]}>
              <Text style={[styles.tagText, { color }]}>{recipe.category}</Text>
            </View>
          ) : null}
          {recipe.region ? (
            <View style={[styles.tag, { backgroundColor: '#9B59B622' }]}>
              <Ionicons name="map-outline" size={12} color="#9B59B6" />
              <Text style={[styles.tagText, { color: '#9B59B6' }]}>{recipe.region}</Text>
            </View>
          ) : null}
        </View>

        {/* INGREDIENTS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: color + '22' }]}>
              <Ionicons name="basket-outline" size={20} color={color} />
            </View>
            <Text style={styles.cardTitle}>Ingredients</Text>
          </View>
          <View style={styles.divider} />
          {ingList.map((ing: string, i: number) => (
            <View key={i} style={styles.ingRow}>
              <View style={[styles.ingDot, { backgroundColor: color }]} />
              <Text style={styles.ingText}>{ing}</Text>
            </View>
          ))}
        </View>

        {/* INSTRUCTIONS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: '#4A8FE722' }]}>
              <Ionicons name="list-outline" size={20} color="#4A8FE7" />
            </View>
            <Text style={styles.cardTitle}>Instructions</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.bodyText}>{recipe.instructions}</Text>
        </View>

        {/* NUTRITION */}
        {recipe.nutrition ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#34B36A22' }]}>
                <Ionicons name="nutrition-outline" size={20} color="#34B36A" />
              </View>
              <Text style={styles.cardTitle}>Nutrition Info</Text>
            </View>
            <View style={styles.divider} />
            {recipe.nutrition.split(',').map((n: string, i: number) => (
              <View key={i} style={styles.nutritionRow}>
                <Ionicons name="checkmark-circle" size={16} color="#34B36A" />
                <Text style={styles.nutritionText}>{n.trim()}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* HEALTH NOTES */}
        {recipe.health_notes ? (
          <View style={[styles.card, { backgroundColor: '#F0FFF4' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#34B36A22' }]}>
                <Ionicons name="heart-outline" size={20} color="#34B36A" />
              </View>
              <Text style={styles.cardTitle}>Health Notes</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.bodyText}>{recipe.health_notes}</Text>
          </View>
        ) : null}

        {/* REGION */}
        {recipe.region ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#9B59B622' }]}>
                <Ionicons name="map-outline" size={20} color="#9B59B6" />
              </View>
              <Text style={styles.cardTitle}>Region</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.bodyText}>{recipe.region}</Text>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0DC' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingTop: 8, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    flex: 1, fontSize: 18,
    fontWeight: 'bold', color: '#2E1A06',
  },
  tagsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, marginBottom: 12,
  },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 10,
  },
  tagText: { fontSize: 11, fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#2E1A06' },
  divider: { height: 1, backgroundColor: '#F0EAE0', marginVertical: 12 },
  ingRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 8,
  },
  ingDot: { width: 8, height: 8, borderRadius: 4 },
  ingText: { fontSize: 13, color: '#4A3010', flex: 1 },
  bodyText: { fontSize: 13, color: '#4A3010', lineHeight: 22 },
  nutritionRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 6,
  },
  nutritionText: { fontSize: 13, color: '#4A3010' },
});