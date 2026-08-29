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
  console.log('[FIREBASE] Testing Firebase connection...\n');
  
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('[OK] Firebase initialized');
    
    // Try to write a test document
    console.log('[NOTE] Trying to write test document...');
    const docRef = await addDoc(collection(db, 'test'), {
      message: 'Hello from seed script!',
      timestamp: new Date()
    });
    console.log('[OK] Test document written with ID:', docRef.id);
    
    // Try to read it back
    console.log('[READ] Reading test collection...');
    const snapshot = await getDocs(collection(db, 'test'));
    console.log(`[OK] Found ${snapshot.size} document(s)`);
    
    console.log('\n[DONE] Connection successful! Database is ready.');
    
  } catch (error: any) {
    console.error('\n[FAIL] Error:', error.message);
    console.error('\n[TASK] Possible fixes:');
    console.error('1. Check that Firestore rules are published in Console');
    console.error('2. Make sure rules allow writes (development mode)');
    console.error('3. Wait a few minutes for changes to propagate');
    console.error('\nGo to: https://console.firebase.google.com/project/lasangpinoy-mobile/firestore/databases/default/rules');
  }
}

testConnection();
