// Simple Firebase Connection Test
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAZ36rq3scKZDT5SsETJ_SYIOEB9Gcbkyk",
  authDomain: "lasangpinoy-mobile.firebaseapp.com",
  projectId: "lasangpinoy-mobile",
  storageBucket: "lasangpinoy-mobile.firebasestorage.app",
  messagingSenderId: "931661584129",
  appId: "1:931661584129:web:c9755a01f54a31cf29ed00"
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
