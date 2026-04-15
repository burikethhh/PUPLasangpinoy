import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, getProfile } from "../../lib/firebase";
import {
  clockIn, clockOut, getStaffStatus, getAllAttendance,
  type AttendanceRecord,
} from "../../lib/firebase-store";
import type { StaffStatus } from "../../constants/order";

export default function StaffAttendanceScreen() {
  const [status, setStatus] = useState<StaffStatus>("off_duty");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [staffName, setStaffName] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setStaffId(user.uid);
      getProfile(user.uid).then((p) => {
        if (p) setStaffName(p.username);
      });
    }
  }, []);

  useEffect(() => {
    if (staffId) fetchData();
  }, [staffId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [s, recs] = await Promise.all([
        getStaffStatus(staffId),
        getAllAttendance(),
      ]);
      setStatus(s);
      setRecords(recs.filter((r) => r.staff_id === staffId).slice(0, 30));
    } catch (e) {
      console.error("Attendance fetch error:", e);
    }
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  async function handleToggle() {
    setToggling(true);
    try {
      if (status === "off_duty") {
        await clockIn(staffId, staffName);
        setStatus("on_duty");
        Alert.alert("Clocked In", "You are now On Duty!");
      } else {
        await clockOut(staffId);
        setStatus("off_duty");
        Alert.alert("Clocked Out", "You are now Off Duty.");
      }
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setToggling(false);
  }

  const isOnDuty = status === "on_duty";
  const presentCount = records.filter((r) => r.status === "on_duty" || r.clock_in).length;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Attendance</Text>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={[styles.statusDot, { backgroundColor: isOnDuty ? "#27AE60" : "#E74C3C" }]} />
        <Text style={styles.statusText}>
          {isOnDuty ? "On Duty" : "Off Duty"}
        </Text>
        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: isOnDuty ? "#E74C3C" : "#27AE60" }]}
          onPress={handleToggle}
          disabled={toggling}
        >
          {toggling ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name={isOnDuty ? "log-out-outline" : "log-in-outline"} size={18} color="#fff" />
              <Text style={styles.toggleText}>{isOnDuty ? "Clock Out" : "Clock In"}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{presentCount}</Text>
          <Text style={styles.summaryLabel}>Days Present</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{records.length - presentCount}</Text>
          <Text style={styles.summaryLabel}>Days Absent</Text>
        </View>
      </View>

      {/* Records */}
      <Text style={styles.sectionTitle}>Recent Records</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#3498DB" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.recordRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recordDate}>{item.date}</Text>
                <Text style={styles.recordTime}>
                  {item.clock_in ? `In: ${new Date(item.clock_in).toLocaleTimeString()}` : ""}
                  {item.clock_out ? ` | Out: ${new Date(item.clock_out).toLocaleTimeString()}` : ""}
                </Text>
              </View>
              <View style={[styles.recordBadge, {
                backgroundColor: item.status === "on_duty" || item.clock_in ? "#27AE6022" : "#E74C3C22",
              }]}>
                <Text style={{
                  color: item.status === "on_duty" || item.clock_in ? "#27AE60" : "#E74C3C",
                  fontSize: 12, fontWeight: "bold",
                }}>
                  {item.status === "on_duty" || item.clock_in ? "Present" : "Absent"}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No attendance records yet</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 8 },
  statusCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    margin: 16, padding: 16, borderRadius: 16, elevation: 2, gap: 12,
  },
  statusDot: { width: 14, height: 14, borderRadius: 7 },
  statusText: { flex: 1, fontSize: 18, fontWeight: "bold", color: "#2E1A06" },
  toggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  toggleText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  summaryRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  summaryCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16,
    alignItems: "center", elevation: 1,
  },
  summaryNum: { fontSize: 28, fontWeight: "bold", color: "#2E1A06" },
  summaryLabel: { fontSize: 12, color: "#888", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#2E1A06", paddingHorizontal: 16, paddingVertical: 8 },
  recordRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  recordDate: { fontSize: 14, fontWeight: "600", color: "#2E1A06" },
  recordTime: { fontSize: 12, color: "#888", marginTop: 2 },
  recordBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  emptyText: { color: "#aaa", textAlign: "center", marginTop: 20 },
});
