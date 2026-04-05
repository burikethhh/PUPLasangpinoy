import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllFeedback, deleteFeedback, Feedback } from '../../lib/firebase';

type EnrichedFeedback = Feedback & { recipe_title?: string; username?: string };

export default function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<EnrichedFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchFeedbacks(); }, []);

  async function fetchFeedbacks() {
    setLoading(true);
    try {
      const data = await getAllFeedback();
      setFeedbacks(data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
    setLoading(false);
  }

  async function handleDelete(fb: EnrichedFeedback) {
    Alert.alert(
      'Delete Review',
      `Delete review by ${fb.username} on "${fb.recipe_title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteFeedback(fb.id);
              fetchFeedbacks();
              Alert.alert('Deleted', 'Review has been removed.');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  }

  function renderStars(rating: number) {
    return '★'.repeat(Math.max(0, Math.min(5, rating))) + '☆'.repeat(Math.max(0, 5 - rating));
  }

  function formatDate(dateVal: any): string {
    if (!dateVal) return '';
    if (dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleDateString();
    if (typeof dateVal === 'string') return new Date(dateVal).toLocaleDateString();
    return '';
  }

  const avgRating = feedbacks.length > 0
    ? (feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / feedbacks.length).toFixed(1)
    : '0';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#2E1A06" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews & Feedback</Text>
        <Text style={styles.countBadge}>{feedbacks.length} reviews</Text>
      </View>

      {/* STATS BAR */}
      {!loading && feedbacks.length > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{feedbacks.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statDivider]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#F4A623' }]}>★ {avgRating}</Text>
            <Text style={styles.statLabel}>Average</Text>
          </View>
          <View style={[styles.statDivider]} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {feedbacks.filter(f => f.rating >= 4).length}
            </Text>
            <Text style={styles.statLabel}>Positive</Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#F4A623" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
          {feedbacks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color="#ddd" />
              <Text style={styles.emptyText}>No reviews yet.</Text>
            </View>
          ) : (
            feedbacks.map((fb) => (
              <View key={fb.id} style={styles.feedbackCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.userBadge}>
                    <Text style={styles.userInitial}>
                      {(fb.username || 'A').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{fb.username}</Text>
                    <Text style={styles.recipeName}>on "{fb.recipe_title}"</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(fb)}>
                    <Ionicons name="trash-outline" size={16} color="#D92614" />
                  </TouchableOpacity>
                </View>
                <View style={styles.ratingRow}>
                  <Text style={styles.stars}>{renderStars(fb.rating)}</Text>
                  <Text style={styles.dateText}>{formatDate(fb.created_at)}</Text>
                </View>
                {fb.comment ? (
                  <Text style={styles.commentText}>{fb.comment}</Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
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
    backgroundColor: '#F4A62322', color: '#F4A623',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, fontSize: 12, fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16,
    borderRadius: 16, padding: 16, marginBottom: 8,
    elevation: 2,
    // @ts-ignore
    boxShadow: '0px 1px 8px rgba(0, 0, 0, 0.06)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#E0D8C8', marginVertical: 2 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#2E1A06' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { textAlign: 'center', color: '#aaa', fontSize: 14 },
  feedbackCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 10, elevation: 2,
    // @ts-ignore
    boxShadow: '0px 1px 6px rgba(0, 0, 0, 0.06)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4A8FE7', justifyContent: 'center', alignItems: 'center',
  },
  userInitial: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  userName: { fontSize: 13, fontWeight: 'bold', color: '#2E1A06' },
  recipeName: { fontSize: 11, color: '#888', marginTop: 1 },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#D9261414', justifyContent: 'center', alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 10, marginBottom: 6,
  },
  stars: { fontSize: 16, color: '#F4A623', letterSpacing: 2 },
  dateText: { fontSize: 11, color: '#aaa' },
  commentText: {
    fontSize: 13, color: '#555', lineHeight: 19,
    backgroundColor: '#FDF5E0', borderRadius: 10, padding: 10, marginTop: 4,
  },
});
