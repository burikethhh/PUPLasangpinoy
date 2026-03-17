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
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type Profile = {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
  created_at: string;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({ username: '', email: '' });

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  function openEdit(user: Profile) {
    setEditing(user);
    setForm({ username: user.username || '', email: user.email || '' });
    setModalVisible(true);
  }

  async function saveUser() {
    if (!editing) return;
    await supabase.from('profiles')
      .update({ username: form.username, email: form.email })
      .eq('id', editing.id);
    setModalVisible(false);
    fetchUsers();
  }

  async function deleteUser(user: Profile) {
    if (user.is_admin) {
      Alert.alert('Cannot Delete', 'Admin accounts cannot be deleted.');
      return;
    }
    Alert.alert('Delete User', `Delete ${user.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('profiles').delete().eq('id', user.id);
          fetchUsers();
        }
      }
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#2E1A06" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Users</Text>
        <Text style={styles.countBadge}>{users.length} users</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={[styles.avatar, { backgroundColor: user.is_admin ? '#F25C05' : '#4A8FE7' }]}>
                <Text style={styles.avatarText}>
                  {(user.username || user.email || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>
                    {user.username || user.email?.split('@')[0] || 'Unknown'}
                  </Text>
                  {user.is_admin && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>ADMIN</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
              <View style={styles.actionBtns}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(user)}>
                  <Ionicons name="pencil" size={16} color="#4A8FE7" />
                </TouchableOpacity>
                {!user.is_admin && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteUser(user)}>
                    <Ionicons name="trash" size={16} color="#D92614" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#bbb"
                value={form.username}
                onChangeText={(v) => setForm(prev => ({ ...prev, username: v }))}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#bbb"
                value={form.email}
                onChangeText={(v) => setForm(prev => ({ ...prev, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveUser}>
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
  countBadge: {
    backgroundColor: '#4A8FE722', color: '#4A8FE7',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, fontSize: 12, fontWeight: '600',
  },
  userCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: 'bold', color: '#2E1A06' },
  adminBadge: {
    backgroundColor: '#F25C0522', paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6,
  },
  adminBadgeText: { fontSize: 9, color: '#F25C05', fontWeight: 'bold' },
  userEmail: { fontSize: 11, color: '#888', marginTop: 2 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  editBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#4A8FE722', justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#D9261422', justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
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
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
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