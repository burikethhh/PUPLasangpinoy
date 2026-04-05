import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatWithQwen, QwenMessage, testQwenConnectivity } from '../../lib/qwen-ai';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Mabuhay! I'm Chef Pinoy, your AI guide to Filipino cuisine! 🇵🇭

I can help you with:
• Learning about Filipino dishes and their history
• Finding recipes based on ingredients you have
• Understanding regional variations of dishes
• Cooking tips and techniques
• Fun facts about Filipino food culture

What would you like to know about Filipino cuisine today?`,
  timestamp: new Date(),
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [aiStatusText, setAiStatusText] = useState('Checking AI...');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const result = await testQwenConnectivity();
      setAiReady(result.ok);
      setAiStatusText(result.ok ? 'Online' : result.error || 'AI unavailable');
    })();
  }, []);

  async function sendMessage() {
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Build conversation history for context (last 10 messages)
      const history: QwenMessage[] = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await chatWithQwen(userMessage.content, history);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      // Mark AI as ready if it was previously shown as offline
      if (!aiReady) {
        setAiReady(true);
        setAiStatusText('Online');
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          "Pasensya na, I’m having trouble reaching the AI right now. In the meantime, try asking about: Adobo, Sinigang, Kare-Kare, regional dishes, or ingredient substitutions.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setAiReady(false);
      setAiStatusText('Temporarily unavailable');
      Alert.alert('Chef Pinoy', 'AI is temporarily unavailable. Please try again in a moment.');
    } finally {
      setIsLoading(false);
    }
  }

  function clearChat() {
    setMessages([WELCOME_MESSAGE]);
  }

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>👨‍🍳</Text>
            </View>
          </View>
        )}
        <View style={[styles.messageContent, isUser ? styles.userContent : styles.assistantContent]}>
          <Text style={[styles.messageText, isUser && styles.userText]}>{item.content}</Text>
          <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const renderSuggestions = () => (
    <View style={styles.suggestionsContainer}>
      <Text style={styles.suggestionsLabel}>Try asking:</Text>
      <View style={styles.suggestionsRow}>
        {[
          'What is Adobo?',
          'Best Sinigang recipe',
          'Regional dishes of Pampanga',
        ].map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestionChip}
            onPress={() => setInputText(suggestion)}>
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Text style={{ fontSize: 24 }}>👨‍🍳</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Chef Pinoy</Text>
            <Text style={styles.headerStatus}>
              {isLoading ? 'Typing...' : aiReady === false ? 'Offline' : aiStatusText}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.clearBtn} onPress={clearChat}>
          <Ionicons name="refresh" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      {/* MESSAGES */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListFooterComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#F25C05" />
              <Text style={styles.loadingText}>Chef Pinoy is thinking...</Text>
            </View>
          ) : null
        }
      />

      {/* SUGGESTIONS (show only at start) */}
      {messages.length <= 1 && renderSuggestions()}

      {/* INPUT */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask about Filipino cuisine..."
            placeholderTextColor="#aaa"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}>
            <Ionicons 
              name="send" 
              size={20} 
              color={inputText.trim() && !isLoading ? '#fff' : '#ccc'} 
            />
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
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8D8A0',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E1A06' },
  headerStatus: { fontSize: 11, color: '#34B36A' },
  clearBtn: { padding: 8 },
  
  messagesList: { padding: 16, paddingBottom: 8 },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
  },
  userBubble: { alignSelf: 'flex-end' },
  assistantBubble: { alignSelf: 'flex-start' },
  
  avatarContainer: { marginRight: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16 },
  
  messageContent: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '100%',
  },
  userContent: {
    backgroundColor: '#F25C05',
    borderBottomRightRadius: 4,
  },
  assistantContent: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    elevation: 1,
    // @ts-ignore
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
  },
  
  messageText: { fontSize: 14, lineHeight: 20, color: '#2E1A06' },
  userText: { color: '#fff' },
  
  timestamp: { fontSize: 10, color: '#aaa', marginTop: 6, alignSelf: 'flex-end' },
  userTimestamp: { color: 'rgba(255,255,255,0.7)' },
  
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    alignSelf: 'flex-start',
  },
  loadingText: { fontSize: 12, color: '#888' },
  
  suggestionsContainer: {
    padding: 16,
    paddingTop: 0,
  },
  suggestionsLabel: { fontSize: 12, color: '#888', marginBottom: 8 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8D8A0',
  },
  suggestionText: { fontSize: 12, color: '#F25C05' },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8D8A0',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#F9F5EF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#2E1A06',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F25C05',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#E0D8C8' },
});
