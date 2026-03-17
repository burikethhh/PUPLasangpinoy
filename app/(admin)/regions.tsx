import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert, Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type Region = { id: number; name: string; description: string; };

export default function AdminRegions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => { fetchRegions(); }, []);

  async function fetchRegions() {
    const { data } = await supabase.from('regions').select('*').order('name');
    setRegions(data || []);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: '', description: '' });
    setModalVisible(true);
  }

  function openEdit(region: Region) {
    setEditing(region);
    setForm({ name: region.name, description: region.description || '' });
    setModalVisible(true);
  }

  async function saveRegion() {
    if (!form.name) { Alert.alert('Error', 'Region name is required.'); return; }
    if (editing) {
      await supabase.from('regions').update(form).eq('id', editing.id);
    } else {
      await supabase.from('regions').insert(form);
    }
    setModalVisible(false);
    fetchRegions();
  }

  async function deleteRegion(id: number) {
    Alert.alert('Delete Region', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('regions').delete().eq('id', id);
          fetchRegions();
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
        <Text style={styles.headerTitle}>Manage Regions</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        {regions.length === 0 && (
          <Text style={styles.empty}>No regions yet. Add one!</Text>
        )}
        {regions.map((region) => (
          <View key={region.id} style={styles.regionCard}>
            <View style={styles.regionIcon}>
              <Ionicons name="map" size={22} color="#9B59B6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.regionName}>{region.name}</Text>
              {region.description ? (
                <Text style={styles.regionDesc}>{region.description}</Text>
              ) : null}
            </View>
            <View style={styles.actionBtns}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(region)}>
                <Ionicons name="pencil" size={16} color="#4A8FE7" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteRegion(region.id)}>
                <Ionicons name="trash" size={16} color="#D92614" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Region' : 'Add Region'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Region Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Luzon, Visayas, Mindanao"
                placeholderTextColor="#bbb"
                value={form.name}
                onChangeText={(v) => setForm(prev => ({ ...prev, name: v }))}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Brief description..."
                placeholderTextColor="#bbb"
                value={form.description}
                onChangeText={(v) => setForm(prev => ({ ...prev, description: v }))}
                multiline
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveRegion}>
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
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#9B59B6', justifyContent: 'center', alignItems: 'center',
  },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40 },
  regionCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  regionIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#9B59B622',
    justifyContent: 'center', alignItems: 'center',
  },
  regionName: { fontSize: 14, fontWeight: 'bold', color: '#2E1A06' },
  regionDesc: { fontSize: 11, color: '#888', marginTop: 2 },
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
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: '#eee', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  cancelText: { color: '#666', fontWeight: '600' },
  saveBtn: {
    flex: 1, backgroundColor: '#9B59B6', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: 'bold' },
});