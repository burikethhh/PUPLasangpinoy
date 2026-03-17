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
    recipes: 0, users: 0, categories: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    const [{ count: recipes }, { count: users }, { count: categories }] =
      await Promise.all([
        supabase.from('recipes').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
      ]);
    setStats({
      recipes: recipes || 0,
      users: users || 0,
      categories: categories || 0,
    });
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  const menuItems = [
    { icon: 'restaurant', label: 'Manage Recipes', color: '#F25C05', route: '/(admin)/recipes' },
    { icon: 'people', label: 'Manage Users', color: '#4A8FE7', route: '/(admin)/users' },
    { icon: 'nutrition', label: 'Nutrition Info', color: '#34B36A', route: '/(admin)/nutrition' },
    { icon: 'map', label: 'Regions', color: '#9B59B6', route: '/(admin)/regions' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

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

        {/* STATS */}
        {loading ? (
          <ActivityIndicator color="#F25C05" style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.statsRow}>
            {[
              { label: 'Recipes', value: stats.recipes, color: '#F25C05' },
              { label: 'Users', value: stats.users, color: '#4A8FE7' },
              { label: 'Categories', value: stats.categories, color: '#34B36A' },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLbl}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* MENU */}
        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
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
  statsRow: {
    flexDirection: 'row', marginHorizontal: 16,
    marginBottom: 20, gap: 10,
  },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statNum: { fontSize: 28, fontWeight: 'bold' },
  statLbl: { fontSize: 11, color: '#888', marginTop: 4 },
  sectionTitle: {
    fontSize: 16, fontWeight: 'bold', color: '#2E1A06',
    marginHorizontal: 16, marginBottom: 12,
  },
  menuGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: 16, gap: 12,
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
  menuLabel: { fontSize: 13, fontWeight: '600', color: '#2E1A06', textAlign: 'center' },
});