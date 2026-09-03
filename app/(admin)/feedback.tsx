import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, getProfile } from "../../lib/firebase";
import {
    archiveConversation, deleteConversation, deleteMessage, getArchivedConversations,
    getConversations, getMessages, markMessagesRead, onMessagesUpdate, sendMessage as sendMsg, unarchiveConversation, type Message,
} from "../../lib/firebase-store";

interface Convo { customer_id: string; customer_name: string; last_message: string; unread: number; }

function formatMessageTimestamp(seconds?: number): string {
  if (!seconds) return "";
  const date = new Date(seconds * 1000);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isToday) {
    return `Today, ${timeStr}`;
  } else if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    return `${dateStr}, ${timeStr}`;
  }
}

export default function AdminMessages() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [archivedConvos, setArchivedConvos] = useState<Convo[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const listRef = useRef<FlatList>(null);

  useFocusEffect(useCallback(() => { loadConvos(); loadArchivedConvos(); loadAdminName(); }, []));

  useEffect(() => {
    if (!selected) return;
    const unsub = onMessagesUpdate(selected.customer_id, (msgs) => {
      setMessages(msgs);
      setLoadingChat(false);
      markMessagesRead(selected.customer_id, "admin").catch(() => {});
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsub?.();
  }, [selected]);

  async function loadAdminName() {
    const u = getCurrentUser();
    if (u) { const p = await getProfile(u.uid); if (p) setAdminName(p.username || "Admin"); }
  }

  async function loadConvos() {
    setLoading(true);
    try { setConvos(await getConversations()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadArchivedConvos() {
    try { setArchivedConvos(await getArchivedConversations()); } catch (e) { console.error(e); }
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

  function handleDeleteMessage(msg: Message) {
    Alert.alert("Delete Message", "Delete this message for everyone?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteMessage(msg.id);
          if (selected) {
            const msgs = await getMessages(selected.customer_id);
            setMessages(msgs);
          }
        } catch (e) { console.error(e); }
      }},
    ]);
  }

  function handleArchiveConversation(convo: Convo) {
    Alert.alert("Archive Conversation", `Archive conversation with ${convo.customer_name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", onPress: async () => {
        try {
          await archiveConversation(convo.customer_id);
          await loadConvos();
          await loadArchivedConvos();
        } catch (e) { console.error(e); }
      }},
    ]);
  }

  function handleUnarchiveConversation(convo: Convo) {
    Alert.alert("Unarchive Conversation", `Restore conversation with ${convo.customer_name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Unarchive", onPress: async () => {
        try {
          await unarchiveConversation(convo.customer_id);
          await loadConvos();
          await loadArchivedConvos();
        } catch (e) { console.error(e); }
      }},
    ]);
  }

  function handleDeleteConversation(convo: Convo) {
    Alert.alert("Delete Conversation", `Permanently delete conversation with ${convo.customer_name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteConversation(convo.customer_id);
          await loadConvos();
          await loadArchivedConvos();
        } catch (e) { console.error(e); }
      }},
    ]);
  }

  function handleClearChat() {
    if (!selected) return;
    Alert.alert("Archive Chat", `Archive all messages with ${selected.customer_name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", onPress: async () => {
        try {
          await archiveConversation(selected.customer_id);
          setMessages([]);
          setSelected(null);
          await loadConvos();
          await loadArchivedConvos();
        } catch (e) { console.error(e); }
      }},
    ]);
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

  const displayConvos = showArchived ? archivedConvos : convos;

  // Conversation List View
  if (!selected) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Modern Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="chatbubbles" size={20} color="#F25C05" />
            </View>
            <View>
              <Text style={styles.headerSub}>Owner Portal</Text>
              <Text style={styles.headerTitle}>Customer Inquiries</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => { loadConvos(); loadArchivedConvos(); }} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Toggle: Active / Archived */}
        <View style={styles.tabContainer}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, !showArchived && styles.tabBtnActive]}
              onPress={() => setShowArchived(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, !showArchived && styles.tabTextActive]}>
                Active ({convos.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, showArchived && styles.tabBtnActive]}
              onPress={() => { setShowArchived(true); loadArchivedConvos(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, showArchived && styles.tabTextActive]}>
                Archived ({archivedConvos.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
        ) : displayConvos.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubbles-outline" size={42} color="#bbb" />
            </View>
            <Text style={styles.emptyText}>{showArchived ? "No archived conversations" : "No active messages"}</Text>
            <Text style={styles.emptySubtext}>Customer messages will appear here in real-time</Text>
          </View>
        ) : (
          <FlatList 
            data={displayConvos} 
            keyExtractor={(i) => i.customer_id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.convoCard} 
                onPress={() => openConvo(item)}
                onLongPress={() => showArchived ? handleUnarchiveConversation(item) : handleArchiveConversation(item)}
                activeOpacity={0.8}
              >
                <View style={styles.convoAvatar}>
                  <Text style={styles.convoAvatarText}>{item.customer_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.convoInfo}>
                  <View style={styles.convoHeaderRow}>
                    <Text style={styles.convoName}>{item.customer_name}</Text>
                    {item.unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unread} new</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.convoLast} numberOfLines={1}>{item.last_message || "Started a conversation"}</Text>
                </View>
                {showArchived ? (
                  <TouchableOpacity onPress={() => handleUnarchiveConversation(item)} style={styles.archiveBtn}>
                    <Ionicons name="arrow-undo" size={16} color="#3498DB" />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#2E1A06" />
        </TouchableOpacity>
        <View style={styles.chatAvatar}>
          <Text style={styles.chatAvatarText}>{selected.customer_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chatTitle}>{selected.customer_name}</Text>
          <Text style={styles.chatSubtitle}>Customer</Text>
        </View>
        <TouchableOpacity onPress={handleClearChat} style={styles.actionHeaderBtn}>
          <Ionicons name="archive-outline" size={20} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 25}
      >
        {loadingChat ? (
          <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
        ) : (
          <FlatList 
            ref={listRef} 
            data={messages} 
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.chatListContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isAdmin = item.sender_role === "admin";
              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onLongPress={() => handleDeleteMessage(item)}
                  style={[styles.bubbleWrapper, isAdmin ? styles.bubbleRight : styles.bubbleLeft]}
                >
                  <View style={[styles.bubble, isAdmin ? styles.bubbleAdmin : styles.bubbleCustomer]}>
                    <Text style={[styles.bubbleText, isAdmin && { color: "#fff" }]}>{item.content}</Text>
                    <Text style={[styles.bubbleTime, isAdmin ? { color: "rgba(255,255,255,0.7)" } : { color: "#999" }]}>
                      {formatMessageTimestamp(item.created_at?.seconds)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
        <View style={styles.inputRow}>
          <TextInput 
            style={styles.inputField} 
            placeholder="Reply to customer..." 
            placeholderTextColor="#aaa"
            value={input} 
            onChangeText={setInput} 
            onFocus={() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200)}
            multiline 
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !input.trim() && { backgroundColor: "#E0D8C8" }]} 
            onPress={send}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={18} color={input.trim() ? "#fff" : "#aaa"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0E4CE",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFF0E6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerSub: { fontSize: 11, color: "#888", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#2E1A06" },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F7F2E7",
    justifyContent: "center",
    alignItems: "center",
  },
  tabContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#EAE0CC",
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: "#F25C05" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#666" },
  tabTextActive: { color: "#fff" },
  empty: { alignItems: "center", marginTop: 70, paddingHorizontal: 30 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EFE6D2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyText: { fontSize: 16, fontWeight: "bold", color: "#666", textAlign: "center" },
  emptySubtext: { fontSize: 13, color: "#999", textAlign: "center", marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 30 },
  convoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  convoAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14, // Squircle
    backgroundColor: "#FFF0E6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FAD7BE",
  },
  convoAvatarText: { color: "#F25C05", fontWeight: "bold", fontSize: 18 },
  convoInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  convoHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  convoName: { fontSize: 15, fontWeight: "700", color: "#2E1A06" },
  convoLast: { fontSize: 13, color: "#777", marginTop: 2 },
  unreadBadge: {
    backgroundColor: "#F25C05",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadText: { color: "#fff", fontWeight: "bold", fontSize: 10 },
  archiveBtn: { padding: 8, borderRadius: 10, backgroundColor: "#EBF5FB" },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E4CE",
  },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: "#F7F2E7" },
  chatAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFF0E6",
    justifyContent: "center",
    alignItems: "center",
  },
  chatAvatarText: { color: "#F25C05", fontWeight: "bold", fontSize: 16 },
  chatTitle: { fontSize: 16, fontWeight: "800", color: "#2E1A06" },
  chatSubtitle: { fontSize: 11, color: "#888", fontWeight: "500" },
  actionHeaderBtn: { padding: 8, borderRadius: 10, backgroundColor: "#FDF2E9" },
  chatListContent: { padding: 16, paddingBottom: 16 },
  bubbleWrapper: { marginBottom: 10, maxWidth: "80%" },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleRight: { alignSelf: "flex-end" },
  bubble: {
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  bubbleAdmin: { backgroundColor: "#F25C05", borderBottomRightRadius: 4 },
  bubbleCustomer: { backgroundColor: "#fff", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: "#2E1A06" },
  bubbleTime: { fontSize: 10, marginTop: 4, textAlign: "right" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F0E4CE",
    gap: 10,
  },
  inputField: {
    flex: 1,
    backgroundColor: "#F9F5EF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: "#2E1A06",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F25C05",
    justifyContent: "center",
    alignItems: "center",
  },
});
