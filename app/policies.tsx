import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PolicyItem = {
  title: string;
  details: string[];
};

const POLICIES: PolicyItem[] = [
  {
    title: "1. User Access Policy",
    details: [
      "The application is intended for small eatery owners and kitchen staff for food preparation and menu development.",
      "Users must not share account credentials with unauthorized individuals to maintain data security and proper activity tracking.",
      "Each user is responsible for all actions made through their own account.",
    ],
  },
  {
    title: "2. Data Usage Policy",
    details: [
      "Photos scanned using the Digital Vision Scanner are used only for ingredient and dish identification.",
      "Scanned content is not sold or shared with third-party advertisers.",
      "Caloric and health information is a general guide and does not replace professional medical or nutritional advice.",
    ],
  },
  {
    title: "3. System Maintenance Procedure",
    details: [
      "Bug reports from users through the Help section are reviewed by the development team.",
      "Critical issues are prioritized to maintain reliability and continuous improvement.",
      "Planned maintenance may be scheduled to apply fixes and platform updates.",
    ],
  },
  {
    title: "4. Content Quality Policy",
    details: [
      "User-submitted recipes are reviewed before approval for quality, clarity, and food safety relevance.",
      "Misleading, harmful, or inappropriate content may be rejected or removed.",
      "Repeated policy violations may result in account restrictions.",
    ],
  },
  {
    title: "5. Privacy & Security Procedure",
    details: [
      "User account data is protected using authenticated access controls.",
      "Only authorized admins may access moderation and user management functions.",
      "Security-related incidents should be reported immediately to administrators for investigation.",
    ],
  },
  {
    title: "6. Service Availability & Backup Policy",
    details: [
      "The team aims for high service availability, but temporary downtime can occur during upgrades or maintenance.",
      "Important application data should be regularly synchronized and backed up through platform infrastructure.",
      "Recovery procedures are followed to restore operations quickly after unexpected outages.",
    ],
  },
];

export default function PoliciesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#2E1A06" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Policies & Procedures</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Ionicons name="shield-checkmark" size={18} color="#4A8FE7" />
          <Text style={styles.introText}>
            These policies define how the Lasang Pinoy system should be used and managed.
          </Text>
        </View>

        {POLICIES.map((item) => (
          <View key={item.title} style={styles.policyCard}>
            <Text style={styles.policyTitle}>{item.title}</Text>
            {item.details.map((detail) => (
              <View key={detail} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.policyDetail}>{detail}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  backBtnPlaceholder: { width: 38, height: 38 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#2E1A06" },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  introCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#EAF3FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  introText: { flex: 1, color: "#2E1A06", fontSize: 12, lineHeight: 18 },
  policyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    // @ts-ignore
    boxShadow: "0px 1px 5px rgba(0,0,0,0.06)",
  },
  policyTitle: { fontSize: 14, fontWeight: "700", color: "#2E1A06", marginBottom: 8 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F25C05",
    marginTop: 6,
  },
  policyDetail: { flex: 1, fontSize: 12, color: "#4A3010", lineHeight: 18 },
});
