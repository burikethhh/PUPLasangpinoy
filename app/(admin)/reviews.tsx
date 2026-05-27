import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { deleteDoc, doc } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../lib/firebase";
import { deleteReview, getReviews, type Review } from "../../lib/firebase-store";

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  useFocusEffect(useCallback(() => { loadReviews(); }, []));

  async function loadReviews() {
    setLoading(true);
    try {
      const data = await getReviews();
      setReviews(data);
    } catch (error) {
      console.error("Error loading reviews:", error);
      Alert.alert("Error", "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(reviewId: string) {
    Alert.alert(
      "Delete Review",
      "Are you sure you want to delete this review?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteReview(reviewId);
              setReviews(prev => prev.filter(r => r.id !== reviewId));
              Alert.alert("Success", "Review deleted.");
              setDetailsModalVisible(false);
            } catch (error) {
              console.error("Error deleting review:", error);
              Alert.alert("Error", "Failed to delete review.");
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  }

  function formatDate(date: any) {
    if (!date) return "N/A";
    try {
      const d = new Date(date instanceof Object && 'seconds' in date ? date.seconds * 1000 : date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return "N/A";
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Customer Reviews & Feedback</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#F25C05" style={{ marginVertical: 60 }} />
        ) : reviews.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No reviews yet</Text>
          </View>
        ) : (
          <View>
            {reviews.map((review) => (
              <TouchableOpacity
                key={review.id}
                style={styles.reviewCard}
                onPress={() => {
                  setSelectedReview(review);
                  setDetailsModalVisible(true);
                }}
              >
                <View style={styles.reviewHeader}>
                  <View>
                    <Text style={styles.reviewerName}>{review.username || "Anonymous"}</Text>
                    <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
                  </View>
                  <View style={styles.starsContainer}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Ionicons
                        key={i}
                        name={i < review.rating ? "star" : "star-outline"}
                        size={16}
                        color={i < review.rating ? "#FFD700" : "#ccc"}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.comment} numberOfLines={2}>{review.comment}</Text>
                {review.image_url && (
                  <Image source={{ uri: review.image_url }} style={styles.thumbImage} contentFit="cover" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Review Details Modal */}
      <Modal visible={detailsModalVisible} animationType="slide" transparent onRequestClose={() => setDetailsModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Review Details</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedReview && (
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Customer</Text>
                <Text style={styles.detailValue}>{selectedReview.username || "Anonymous"}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Rating</Text>
                <View style={styles.starsContainer}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ionicons
                      key={i}
                      name={i < selectedReview.rating ? "star" : "star-outline"}
                      size={20}
                      color={i < selectedReview.rating ? "#FFD700" : "#ccc"}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Feedback</Text>
                <Text style={styles.detailValue}>{selectedReview.comment || "No comment provided."}</Text>
              </View>

              {selectedReview.image_url && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Photo</Text>
                  <Image source={{ uri: selectedReview.image_url }} style={styles.fullImage} contentFit="cover" />
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(selectedReview.created_at)}</Text>
              </View>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(selectedReview.id)}
                disabled={deleting}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.deleteBtnText}>Delete Review</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: "bold", color: "#2E1A06", marginBottom: 20 },

  emptyState: { alignItems: "center", marginVertical: 60 },
  emptyText: { fontSize: 16, color: "#999", marginTop: 12 },

  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  reviewerName: { fontSize: 14, fontWeight: "600", color: "#2E1A06" },
  reviewDate: { fontSize: 12, color: "#999", marginTop: 2 },
  starsContainer: { flexDirection: "row", gap: 2 },
  comment: { fontSize: 13, color: "#555", marginBottom: 8, lineHeight: 18 },
  thumbImage: { width: "100%", height: 120, borderRadius: 8 },

  modalContainer: { flex: 1, backgroundColor: "#F9F0DC" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#2E1A06" },
  modalContent: { flex: 1 },
  modalScrollContent: { padding: 16, paddingBottom: 32 },

  detailSection: { marginBottom: 20 },
  detailLabel: { fontSize: 14, fontWeight: "600", color: "#F25C05", marginBottom: 6 },
  detailValue: { fontSize: 14, color: "#2E1A06", lineHeight: 20 },
  fullImage: { width: "100%", height: 250, borderRadius: 8 },

  deleteBtn: {
    backgroundColor: "#E74C3C",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  deleteBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
