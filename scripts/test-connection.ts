// Simple Firebase Connection Test
import { initializeApp } from 'firebase/app';
import { addDoc, collection, getDocs, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "lasangpinoy-mobile.firebaseapp.com",
  projectId: "lasangpinoy-mobile",
  storageBucket: "lasangpinoy-mobile.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ""
};

async function testConnection() {
  console.log('🔥 Testing Firebase connection...\n');
  
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Firebase initialized');
    
    // Try to write a test document
    console.log('📝 Trying to write test document...');
    const docRef = await addDoc(collection(db, 'test'), {
      message: 'Hello from seed script!',
      timestamp: new Date()
    });
    console.log('✅ Test document written with ID:', docRef.id);
    
    // Try to read it back
    console.log('📖 Reading test collection...');
    const snapshot = await getDocs(collection(db, 'test'));
    console.log(`✅ Found ${snapshot.size} document(s)`);
    
    console.log('\n🎉 Connection successful! Database is ready.');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\n📋 Possible fixes:');
    console.error('1. Check that Firestore rules are published in Console');
    console.error('2. Make sure rules allow writes (development mode)');
    console.error('3. Wait a few minutes for changes to propagate');
    console.error('\nGo to: https://console.firebase.google.com/project/lasangpinoy-mobile/firestore/databases/default/rules');
  }
}

testConnection();
