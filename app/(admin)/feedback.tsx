import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, getProfile } from "../../lib/firebase";
import {
  getConversations, getMessages, markMessagesRead,
  sendMessage as sendMsg, type Message,
} from "../../lib/firebase-store";

interface Convo { customer_id: string; customer_name: string; last_message: string; unread: number; }

export default function AdminMessages() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [selected, setSelected] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const listRef = useRef<FlatList>(null);

  useFocusEffect(useCallback(() => { loadConvos(); loadAdminName(); }, []));

  async function loadAdminName() {
    const u = getCurrentUser();
    if (u) { const p = await getProfile(u.uid); if (p) setAdminName(p.username || "Admin"); }
  }

  async function loadConvos() {
    setLoading(true);
    try { setConvos(await getConversations()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function openConvo(c: Convo) {
    setSelected(c);
    setLoadingChat(true);
    try {
      const msgs = await getMessages(c.customer_id);
      setMessages(msgs);
      await markMessagesRead(c.customer_id, "admin");
      loadConvos();
    } catch (e) { console.error(e); }
    setLoadingChat(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 200);
  }

  async function send() {
    if (!input.trim() || !selected) return;
    const u = getCurrentUser();
    if (!u) return;
    const text = input.trim();
    setInput("");
    try {
      await sendMsg({
        conversation_id: selected.customer_id,
        sender_id: u.uid,
        sender_name: adminName,
        sender_role: "admin",
        content: text,
      });
      const msgs = await getMessages(selected.customer_id);
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) { console.error(e); }
  }

  // Conversation List View
  if (!selected) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Messages</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
        ) : convos.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No conversations yet</Text>
          </View>
        ) : (
          <FlatList data={convos} keyExtractor={(i) => i.customer_id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.convoCard} onPress={() => openConvo(item)}>
                <View style={styles.convoAvatar}>
                  <Text style={styles.convoAvatarText}>{item.customer_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.convoInfo}>
                  <Text style={styles.convoName}>{item.customer_name}</Text>
                  <Text style={styles.convoLast} numberOfLines={1}>{item.last_message}</Text>
                </View>
                {item.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // Chat View
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#2E1A06" />
        </TouchableOpacity>
        <Text style={styles.chatTitle}>{selected.customer_name}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {loadingChat ? (
          <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
        ) : (
          <FlatList ref={listRef} data={messages} keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            renderItem={({ item }) => {
              const isAdmin = item.sender_role === "admin";
              return (
                <View style={[styles.bubble, isAdmin ? styles.bubbleAdmin : styles.bubbleCustomer]}>
                  <Text style={[styles.bubbleText, isAdmin && { color: "#fff" }]}>{item.content}</Text>
                  <Text style={[styles.bubbleTime, isAdmin && { color: "rgba(255,255,255,0.7)" }]}>
                    {item.created_at?.seconds
                      ? new Date(item.created_at.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </Text>
                </View>
              );
            }}
          />
        )}
        <View style={styles.inputRow}>
          <TextInput style={styles.inputField} placeholder="Type a message..." placeholderTextColor="#aaa"
            value={input} onChangeText={setInput} multiline />
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 22, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 8 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: "#aaa", marginTop: 10 },
  convoCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, elevation: 1 },
  convoAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F25C05", justifyContent: "center", alignItems: "center" },
  convoAvatarText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  convoInfo: { flex: 1, marginLeft: 12 },
  convoName: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  convoLast: { fontSize: 12, color: "#888", marginTop: 2 },
  unreadBadge: { backgroundColor: "#F25C05", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  unreadText: { color: "#fff", fontWeight: "bold", fontSize: 11 },
  chatHeader: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: "#f0e8d0" },
  backBtn: { padding: 4 },
  chatTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06" },
  bubble: { maxWidth: "78%", borderRadius: 16, padding: 12, marginBottom: 8 },
  bubbleAdmin: { backgroundColor: "#F25C05", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleCustomer: { backgroundColor: "#fff", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: "#333" },
  bubbleTime: { fontSize: 10, color: "#aaa", marginTop: 4, textAlign: "right" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: "#f0e8d0" },
  inputField: { flex: 1, backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, color: "#333" },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F25C05", justifyContent: "center", alignItems: "center" },
});
