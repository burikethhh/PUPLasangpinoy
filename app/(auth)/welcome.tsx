import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>

        {/* LOGO / TITLE */}
        <View style={styles.logoBox}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🍽️</Text>
          </View>
          <Text style={styles.appName}>Lasang Pinoy</Text>
          <Text style={styles.appSub}>Authentic Filipino Recipes</Text>
        </View>

        {/* CARDS */}
        <View style={styles.cardsBox}>

          {/* USER CARD */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#F25C0522' }]}>
                <Ionicons name="person" size={24} color="#F25C05" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Continue as User</Text>
                <Text style={styles.cardSub}>Browse and discover Filipino recipes</Text>
              </View>
            </View>
            <View style={styles.cardBtns}>
              <TouchableOpacity
                style={styles.signInBtn}
                onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.signInText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.signUpBtn}
                onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.signUpText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ADMIN CARD */}
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#2E1A06' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#2E1A0622' }]}>
                <Ionicons name="settings" size={24} color="#2E1A06" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Admin Portal</Text>
                <Text style={styles.cardSub}>Manage recipes, users and more</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.signInBtn, { backgroundColor: '#2E1A06' }]}
              onPress={() => router.push('/(auth)/admin-login')}>
              <Text style={styles.signInText}>Admin Sign In</Text>
            </TouchableOpacity>
          </View>

        </View>

        <Text style={styles.footer}>Lasang Pinoy © 2026</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0DC' },
  inner: { flex: 1, justifyContent: 'space-between', padding: 24 },
  logoBox: { alignItems: 'center', marginTop: 20 },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#F25C05',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    elevation: 6,
    // @ts-ignore - web shadow
    boxShadow: '0px 4px 10px rgba(242, 92, 5, 0.3)',
  },
  logoEmoji: { fontSize: 40 },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#2E1A06' },
  appSub: { fontSize: 13, color: '#C07A20', marginTop: 4 },
  cardsBox: { gap: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 20, gap: 16,
    elevation: 3,
    // @ts-ignore - web shadow
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.08)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardIcon: {
    width: 50, height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E1A06' },
  cardSub: { fontSize: 11, color: '#888', marginTop: 2 },
  cardBtns: { flexDirection: 'row', gap: 10 },
  signInBtn: {
    flex: 1, backgroundColor: '#F25C05',
    borderRadius: 12, padding: 13, alignItems: 'center',
  },
  signInText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  signUpBtn: {
    flex: 1, backgroundColor: '#F9F0DC',
    borderRadius: 12, padding: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#F25C05',
  },
  signUpText: { color: '#F25C05', fontWeight: 'bold', fontSize: 14 },
  footer: { textAlign: 'center', color: '#bbb', fontSize: 11 },
});