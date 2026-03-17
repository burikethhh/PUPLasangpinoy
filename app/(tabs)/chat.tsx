import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function ChatScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Ionicons name="chatbubble" size={80} color="#c5e0f5" />
        <Text style={styles.title}>Coming Soon!</Text>
        <Text style={styles.sub}>Chat with our AI chef for{'\n'}personalized Filipino recipes!</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F2DF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#381A04', marginTop: 20 },
  sub: { fontSize: 13, color: '#C07A20', textAlign: 'center', marginTop: 10 },
});