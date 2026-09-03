import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser, getProfile } from '../../lib/firebase';
import { deleteConversation, deleteMessage, getMessages, onMessagesUpdate, sendMessage as sendMsg, type Message } from '../../lib/firebase-store';

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

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Customer');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      getProfile(user.uid).then((p) => { if (p) setUserName(p.username); });
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadMessages();
    const user = getCurrentUser();
    if (!user) return;
    const unsub = onMessagesUpdate(user.uid, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
    return () => unsub?.();
  }, []));

  async function loadMessages() {
    const user = getCurrentUser();
    if (!user) { setLoading(false); return; }
    try {
      const msgs = await getMessages(user.uid);
      setMessages(msgs.reverse());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleSend() {
    if (!inputText.trim() || sending) return;
    const user = getCurrentUser();
    if (!user) return;

    setSending(true);
    try {
      await sendMsg({
        conversation_id: user.uid,
        sender_id: user.uid,
        sender_name: userName,
        sender_role: 'customer',
        content: inputText.trim(),
      });
      setInputText('');
      await loadMessages();
    } catch (e: any) {
      console.error('Send error:', e);
    }
    setSending(false);
  }

  const userId = getCurrentUser()?.uid;

  function handleDeleteMessage(msg: Message) {
    Alert.alert('Delete Message', 'Delete this message for everyone?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteMessage(msg.id); await loadMessages(); }
        catch (e) { console.error(e); }
      }},
    ]);
  }

  function handleClearChat() {
    const user = getCurrentUser();
    if (!user) return;
    Alert.alert('Clear Chat', 'Delete all messages in this conversation? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => {
        try {
          await deleteConversation(user.uid);
          setMessages([]);
        } catch (e) { console.error(e); }
      }},
    ]);
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === userId;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => handleDeleteMessage(item)}
        style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {!isMe && (
          <View style={styles.avatarBox}>
            <Ionicons name="storefront" size={16} color="#F25C05" />
          </View>
        )}
        <View style={[styles.msgContent, isMe ? styles.myContent : styles.theirContent]}>
          {!isMe && <Text style={styles.senderName}>{item.sender_name || 'Store'}</Text>}
          <Text style={[styles.msgText, isMe && { color: '#fff' }]}>{item.content}</Text>
          <Text style={[styles.timeText, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
            {formatMessageTimestamp(item.created_at?.seconds)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Ionicons name="storefront" size={20} color="#F25C05" />
          </View>
          <View>
            <Text style={styles.headerTitle}>FOODFIX Store</Text>
            <Text style={styles.headerSub}>Online • Typical reply within minutes</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {messages.length > 0 && (
            <TouchableOpacity onPress={handleClearChat} style={styles.headerBtn}>
              <Ionicons name="trash-outline" size={18} color="#E74C3C" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={loadMessages} style={styles.headerBtn}>
            <Ionicons name="refresh" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        {loading ? (
          <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="chatbubbles-outline" size={42} color="#bbb" />
                </View>
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Have questions about your order or our menu? Send us a message!</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputRow}>
          <TextInput 
            style={styles.input} 
            placeholder="Type a message..."
            placeholderTextColor="#aaa" 
            value={inputText} 
            onChangeText={setInputText}
            onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200)}
            multiline 
            maxLength={500} 
            returnKeyType="send" 
            onSubmitEditing={handleSend} 
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && { backgroundColor: '#E0D8C8' }]}
            onPress={handleSend} 
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> :
              <Ionicons name="send" size={18} color={inputText.trim() ? '#fff' : '#aaa'} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0DC' },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: '#fff',
    borderBottomWidth: 1, 
    borderBottomColor: '#F0E4CE',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 40, 
    height: 40, 
    borderRadius: 12, // Squircle
    backgroundColor: '#FFF0E6',
    justifyContent: 'center', 
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#2E1A06' },
  headerSub: { fontSize: 11, color: '#27AE60', fontWeight: '500' },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F7F2E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: { padding: 16, paddingBottom: 16 },
  bubble: { flexDirection: 'row', marginBottom: 10, maxWidth: '85%' },
  myBubble: { alignSelf: 'flex-end' },
  theirBubble: { alignSelf: 'flex-start' },
  avatarBox: {
    width: 32, 
    height: 32, 
    borderRadius: 10, 
    backgroundColor: '#FFF0E6',
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 8,
  },
  msgContent: { 
    padding: 12, 
    paddingHorizontal: 14, 
    borderRadius: 16, 
    maxWidth: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  myContent: { backgroundColor: '#F25C05', borderBottomRightRadius: 4 },
  theirContent: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: 'bold', color: '#F25C05', marginBottom: 2 },
  msgText: { fontSize: 14, lineHeight: 20, color: '#2E1A06' },
  timeText: { fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: 'flex-end' },
  empty: { alignItems: 'center', marginTop: 70, paddingHorizontal: 30 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFE6D2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: '#666' },
  emptySubtext: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 4 },
  inputRow: {
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    padding: 12, 
    paddingHorizontal: 16,
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderTopColor: '#F0E4CE', 
    gap: 10,
  },
  input: {
    flex: 1, 
    minHeight: 44, 
    maxHeight: 100, 
    backgroundColor: '#F9F5EF',
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    fontSize: 14, 
    color: '#2E1A06',
  },
  sendBtn: {
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    backgroundColor: '#F25C05',
    justifyContent: 'center', 
    alignItems: 'center',
  },
});
