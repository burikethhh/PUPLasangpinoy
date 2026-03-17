import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    recipes: 0, users: 0, regions: 0,
    mainDish: 0, soup: 0, noodles: 0,
  });
  const [recentRecipes, setRecentRecipes] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    setLoading(true);
    const [
      { count: recipes },
      { count: users },
      { count: regions },
      { count: mainDish },
      { count: soup },
      { count: noodles },
    ] = await Promise.all([
      supabase.from('recipes').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('regions').select('*', { count: 'exact', head: true }),
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('category', 'Main Dish'),
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('category', 'Soup'),
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('category', 'Noodles'),
    ]);

    const { data: recentR } = await supabase
      .from('recipes').select('id, title, category, created_at')
      .order('created_at', { ascending: false }).limit(5);

    const { data: recentU } = await supabase
      .from('profiles').select('id, email, username, created_at')
      .order('created_at', { ascending: false }).limit(5);

    setStats({
      recipes: recipes || 0,
      users: users || 0,
      regions: regions || 0,
      mainDish: mainDish || 0,
      soup: soup || 0,
      noodles: noodles || 0,
    });
    setRecentRecipes(recentR || []);
    setRecentUsers(recentU || []);
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  const catColors: Record<string, string> = {
    'Main Dish': '#F25C05', 'Soup': '#4A8FE7', 'Noodles': '#34B36A',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Welcome back,</Text>
            <Text style={styles.headerTitle}>⚙ Admin Panel</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color="#F25C05" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#F25C05" style={{ marginTop: 20 }} />
        ) : (
          <>
            {/* STATS OVERVIEW */}
            <Text style={styles.sectionTitle}>📊 Overview</Text>
            <View style={styles.statsRow}>
              {[
                { label: 'Recipes', value: stats.recipes, color: '#F25C05', icon: 'restaurant' },
                { label: 'Users', value: stats.users, color: '#4A8FE7', icon: 'people' },
                { label: 'Regions', value: stats.regions, color: '#9B59B6', icon: 'map' },
              ].map((s) => (
                <View key={s.label} style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + '22' }]}>
                    <Ionicons name={s.icon as any} size={22} color={s.color} />
                  </View>
                  <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLbl}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* RECIPE BY CATEGORY REPORT */}
            <Text style={styles.sectionTitle}>🍽️ Recipes by Category</Text>
            <View style={styles.reportCard}>
              {[
                { label: 'Main Dish', value: stats.mainDish, color: '#F25C05', total: stats.recipes },
                { label: 'Soup', value: stats.soup, color: '#4A8FE7', total: stats.recipes },
                { label: 'Noodles', value: stats.noodles, color: '#34B36A', total: stats.recipes },
              ].map((cat) => {
                const percent = stats.recipes > 0
                  ? Math.round((cat.value / cat.total) * 100) : 0;
                return (
                  <View key={cat.label} style={styles.catReportRow}>
                    <View style={styles.catReportLeft}>
                      <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                      <Text style={styles.catReportLabel}>{cat.label}</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill,
                        { width: `${percent}%` as any, backgroundColor: cat.color }]} />
                    </View>
                    <Text style={[styles.catReportCount, { color: cat.color }]}>
                      {cat.value}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* MANAGEMENT MENU */}
            <Text style={styles.sectionTitle}>⚙️ Management</Text>
            <View style={styles.menuGrid}>
              {[
                { icon: 'restaurant', label: 'Manage Recipes', color: '#F25C05', route: '/(admin)/recipes' },
                { icon: 'people', label: 'Manage Users', color: '#4A8FE7', route: '/(admin)/users' },
                { icon: 'nutrition', label: 'Nutrition Info', color: '#34B36A', route: '/(admin)/nutrition' },
                { icon: 'map', label: 'Regions', color: '#9B59B6', route: '/(admin)/regions' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.menuCard}
                  onPress={() => router.push(item.route as any)}>
                  <View style={[styles.menuIcon, { backgroundColor: item.color + '22' }]}>
                    <Ionicons name={item.icon as any} size={28} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* RECENT RECIPES */}
            <Text style={styles.sectionTitle}>🕒 Recent Recipes</Text>
            <View style={styles.reportCard}>
              {recentRecipes.length === 0 ? (
                <Text style={styles.emptyText}>No recipes yet.</Text>
              ) : (
                recentRecipes.map((recipe, index) => (
                  <View key={recipe.id} style={styles.recentRow}>
                    <View style={[styles.recentNum,
                      { backgroundColor: (catColors[recipe.category] || '#888') + '22' }]}>
                      <Text style={[styles.recentNumText,
                        { color: catColors[recipe.category] || '#888' }]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentTitle}>{recipe.title}</Text>
                      <Text style={styles.recentSub}>{recipe.category}</Text>
                    </View>
                    <View style={[styles.recentTag,
                      { backgroundColor: (catColors[recipe.category] || '#888') + '22' }]}>
                      <Text style={[styles.recentTagText,
                        { color: catColors[recipe.category] || '#888' }]}>
                        {recipe.category}
                      </Text>
                    </View>
                  </View>
                ))
              )}
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => router.push('/(admin)/recipes')}>
                <Text style={styles.viewAllText}>View All Recipes →</Text>
              </TouchableOpacity>
            </View>

            {/* RECENT USERS */}
            <Text style={styles.sectionTitle}>👥 Recent Users</Text>
            <View style={styles.reportCard}>
              {recentUsers.length === 0 ? (
                <Text style={styles.emptyText}>No users yet.</Text>
              ) : (
                recentUsers.map((user) => (
                  <View key={user.id} style={styles.recentRow}>
                    <View style={[styles.recentNum, { backgroundColor: '#4A8FE722' }]}>
                      <Text style={[styles.recentNumText, { color: '#4A8FE7' }]}>
                        {(user.username || user.email || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentTitle}>
                        {user.username || user.email?.split('@')[0]}
                      </Text>
                      <Text style={styles.recentSub}>{user.email}</Text>
                    </View>
                  </View>
                ))
              )}
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => router.push('/(admin)/users')}>
                <Text style={styles.viewAllText}>View All Users →</Text>
              </TouchableOpacity>
            </View>

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0DC' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, paddingTop: 8,
  },
  headerSub: { fontSize: 12, color: '#888' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#2E1A06' },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFE8E5',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15, fontWeight: 'bold', color: '#2E1A06',
    marginHorizontal: 16, marginBottom: 10, marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 16,
    marginBottom: 8, gap: 10,
  },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statNum: { fontSize: 24, fontWeight: 'bold' },
  statLbl: { fontSize: 11, color: '#888', marginTop: 2 },
  reportCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 8, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  catReportRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, gap: 10,
  },
  catReportLeft: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, width: 80,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catReportLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
  progressBarBg: {
    flex: 1, height: 8, backgroundColor: '#F0EAE0',
    borderRadius: 4, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  catReportCount: { fontSize: 13, fontWeight: 'bold', width: 24, textAlign: 'right' },
  menuGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: 16, gap: 12, marginBottom: 8,
  },
  menuCard: {
    width: '47%', backgroundColor: '#fff',
    borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  menuIcon: {
    width: 56, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  menuLabel: {
    fontSize: 13, fontWeight: '600',
    color: '#2E1A06', textAlign: 'center',
  },
  recentRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 12,
  },
  recentNum: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  recentNumText: { fontSize: 14, fontWeight: 'bold' },
  recentTitle: { fontSize: 13, fontWeight: 'bold', color: '#2E1A06' },
  recentSub: { fontSize: 11, color: '#888', marginTop: 2 },
  recentTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  recentTagText: { fontSize: 10, fontWeight: '600' },
  viewAllBtn: { marginTop: 4, alignItems: 'center' },
  viewAllText: { fontSize: 13, color: '#F25C05', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#aaa', fontSize: 13 },
});