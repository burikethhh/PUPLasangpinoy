import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser, getProfile } from '../../lib/firebase';
import { getMessages, sendMessage as sendMsg, type Message } from '../../lib/firebase-store';

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Customer');
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(useCallback(() => { loadMessages(); }, []));

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      getProfile(user.uid).then((p) => { if (p) setUserName(p.username); });
    }
  }, []);

  // Poll for new messages every 10s
  useEffect(() => {
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadMessages() {
    const user = getCurrentUser();
    if (!user) { setLoading(false); return; }
    try {
      const msgs = await getMessages(user.uid);
      setMessages(msgs.reverse()); // oldest first
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

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === userId;
    return (
      <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {!isMe && (
          <View style={styles.avatarBox}>
            <Ionicons name="storefront" size={16} color="#F25C05" />
          </View>
        )}
        <View style={[styles.msgContent, isMe ? styles.myContent : styles.theirContent]}>
          {!isMe && <Text style={styles.senderName}>{item.sender_name || 'Store'}</Text>}
          <Text style={[styles.msgText, isMe && { color: '#fff' }]}>{item.content}</Text>
          <Text style={[styles.timeText, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
            {item.created_at?.seconds
              ? new Date(item.created_at.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Ionicons name="storefront" size={22} color="#F25C05" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Lasang Pinoy</Text>
            <Text style={styles.headerSub}>Message the store</Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadMessages} style={{ padding: 8 }}>
          <Ionicons name="refresh" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color="#ddd" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Send a message to the store!</Text>
            </View>
          }
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.inputRow}>
          <TextInput style={styles.input} placeholder="Type a message..."
            placeholderTextColor="#aaa" value={inputText} onChangeText={setInputText}
            multiline maxLength={500} returnKeyType="send" onSubmitEditing={handleSend} />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && { backgroundColor: '#E0D8C8' }]}
            onPress={handleSend} disabled={!inputText.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> :
              <Ionicons name="send" size={18} color={inputText.trim() ? '#fff' : '#ccc'} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0DC' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, paddingHorizontal: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E8D8A0',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF5EE',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E1A06' },
  headerSub: { fontSize: 11, color: '#888' },
  list: { padding: 16, paddingBottom: 8 },
  bubble: { flexDirection: 'row', marginBottom: 10, maxWidth: '85%' },
  myBubble: { alignSelf: 'flex-end' },
  theirBubble: { alignSelf: 'flex-start' },
  avatarBox: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF5EE',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  msgContent: { padding: 12, borderRadius: 16, maxWidth: '100%' },
  myContent: { backgroundColor: '#F25C05', borderBottomRightRadius: 4 },
  theirContent: { backgroundColor: '#fff', borderBottomLeftRadius: 4, elevation: 1 },
  senderName: { fontSize: 11, fontWeight: 'bold', color: '#F25C05', marginBottom: 2 },
  msgText: { fontSize: 14, lineHeight: 20, color: '#2E1A06' },
  timeText: { fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: 'flex-end' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: '#aaa', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#bbb', marginTop: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingHorizontal: 16,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8D8A0', gap: 10,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100, backgroundColor: '#F9F5EF',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#2E1A06',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F25C05',
    justifyContent: 'center', alignItems: 'center',
  },
});
