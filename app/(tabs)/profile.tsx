import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => { getProfile(); }, []);

  async function getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');
      const { data } = await supabase
        .from('profiles').select('username').eq('id', user.id).single();
      setUsername(data?.username || user.email?.split('@')[0] || 'Chef');
    }
  }

  async function logout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        }
      }
    ]);
  }

  const bg = isDarkMode ? '#1A1A2E' : '#F9F0DC';
  const cardBg = isDarkMode ? '#2A2A3E' : '#FFFFFF';
  const textColor = isDarkMode ? '#FFFFFF' : '#2E1A06';
  const subColor = isDarkMode ? '#AAAACC' : '#888888';
  const orange = '#F25C05';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: textColor }]}>Profile</Text>
        </View>

        {/* PROFILE CARD */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[styles.name, { color: textColor }]}>
            {username.charAt(0).toUpperCase() + username.slice(1)}
          </Text>
          <Text style={[styles.email, { color: subColor }]}>{email}</Text>
          <Text style={[styles.role, { color: orange }]}>Home Chef</Text>
          <View style={[styles.divider, { backgroundColor: isDarkMode ? '#3A3A5E' : '#F0EAE0' }]} />
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: textColor }]}>3</Text>
              <Text style={[styles.statLbl, { color: orange }]}>Saved</Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: isDarkMode ? '#3A3A5E' : '#E0D8C8' }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: textColor }]}>12</Text>
              <Text style={[styles.statLbl, { color: orange }]}>Cooked</Text>
            </View>
          </View>
        </View>

        {/* SETTINGS CARD */}
        <View style={[styles.card, { backgroundColor: cardBg, alignItems: 'flex-start' }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Settings</Text>
          <View style={[styles.divider, { backgroundColor: isDarkMode ? '#3A3A5E' : '#F0EAE0' }]} />

          {/* DARK MODE - ENABLED */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#4A8FE7' + '22' }]}>
                <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={18} color="#4A8FE7" />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>
                {isDarkMode ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={setIsDarkMode}
              trackColor={{ false: '#ddd', true: orange }}
              thumbColor="#fff"
            />
          </View>

          {/* NOTIFICATIONS - DISABLED */}
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#34B36A22' }]}>
                <Ionicons name="notifications" size={18} color="#34B36A" />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>Notifications</Text>
            </View>
            <Text style={{ fontSize: 11, color: subColor }}>Coming Soon</Text>
          </View>
        </View>

        {/* ABOUT CARD */}
        <View style={[styles.card, { backgroundColor: cardBg, alignItems: 'flex-start' }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>About App</Text>
          <View style={[styles.divider, { backgroundColor: isDarkMode ? '#3A3A5E' : '#F0EAE0' }]} />

          {/* ABOUT - DISABLED */}
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: orange + '22' }]}>
                <Ionicons name="information-circle" size={18} color={orange} />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>About Lasang Pinoy</Text>
            </View>
            <Text style={{ fontSize: 11, color: subColor }}>Coming Soon</Text>
          </View>

          {/* RATE APP - DISABLED */}
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: orange + '22' }]}>
                <Ionicons name="star" size={18} color={orange} />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>Rate the App</Text>
            </View>
            <Text style={{ fontSize: 11, color: subColor }}>Coming Soon</Text>
          </View>

          {/* PRIVACY POLICY - DISABLED */}
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#88888822' }]}>
                <Ionicons name="document-text" size={18} color="#888" />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>Privacy Policy</Text>
            </View>
            <Text style={{ fontSize: 11, color: subColor }}>Coming Soon</Text>
          </View>

          <Text style={[styles.version, { color: subColor }]}>Version 1.0.0</Text>
        </View>

        {/* LOG OUT */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: isDarkMode ? '#3A1A1A' : '#FFE8E5' }]}
          onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#D92614" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  card: {
    borderRadius: 20, marginHorizontal: 16,
    marginBottom: 14, padding: 20,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#F25C05',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 32 },
  name: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  email: { fontSize: 12, marginBottom: 4 },
  role: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  divider: { width: '100%', height: 1, marginVertical: 12 },
  statsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: 'bold' },
  statLbl: { fontSize: 12, marginTop: 2 },
  statDiv: { width: 1, height: '100%' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', width: '100%', paddingVertical: 10,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  settingText: { fontSize: 14 },
  version: { fontSize: 11, marginTop: 8, alignSelf: 'center' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, borderRadius: 14, padding: 16, gap: 8,
  },
  logoutText: { color: '#D92614', fontWeight: 'bold', fontSize: 15 },
});