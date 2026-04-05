// Test with explicit database URL configuration
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "lasangpinoy-mobile.firebaseapp.com",
  projectId: "lasangpinoy-mobile",
  storageBucket: "lasangpinoy-mobile.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
  databaseURL: "https://lasangpinoy-mobile.firebaseio.com"
};

console.log('🔧 Testing Firebase SDK with explicit configuration\n');

async function test() {
  try {
    const app = initializeApp(firebaseConfig);
    
    // Try initializing with explicit settings
    const db = getFirestore(app);
    
    // Enable long polling for Node.js environments
    const settings = {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    };
    
    console.log('Using long polling mode for Node.js compatibility...\n');
    
    const testRef = doc(db, 'test_connection', 'sdk_longpoll_test');
    const testData = {
      timestamp: Timestamp.now(),
      message: 'SDK with long polling',
      test_number: Math.random()
    };
    
    console.log('📝 Writing document...');
    await setDoc(testRef, testData);
    console.log('✅ Write successful!\n');
    
    console.log('📖 Reading document back...');
    const docSnap = await getDoc(testRef);
    
    if (docSnap.exists()) {
      console.log('✅ Read successful!');
      console.log('Data:', docSnap.data());
      console.log('\n✅ Firebase SDK is now working!\n');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);
    process.exit(1);
  }
}

test();
