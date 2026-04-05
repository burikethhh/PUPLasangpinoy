// Diagnostic script to troubleshoot Firestore connection issues
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "REDACTED_FIREBASE_API_KEY",
  authDomain: "lasangpinoy-mobile.firebaseapp.com",
  projectId: "lasangpinoy-mobile",
  storageBucket: "lasangpinoy-mobile.firebasestorage.app",
  messagingSenderId: "931661584129",
  appId: "1:931661584129:web:c9755a01f54a31cf29ed00"
};

console.log('🔧 Firebase Firestore Diagnostic Tool\n');
console.log('📋 Configuration:');
console.log(`   Project ID: ${firebaseConfig.projectId}`);
console.log(`   Auth Domain: ${firebaseConfig.authDomain}`);
console.log(`   App ID: ${firebaseConfig.appId}\n`);

async function diagnose() {
  try {
    console.log('1️⃣ Initializing Firebase app...');
    const app = initializeApp(firebaseConfig);
    console.log('   ✅ Firebase app initialized\n');

    console.log('2️⃣ Getting Firestore instance...');
    const db = getFirestore(app);
    console.log('   ✅ Firestore instance obtained\n');

    console.log('3️⃣ Attempting to write a test document...');
    const testRef = doc(db, 'test_connection', 'diagnostic_test');
    const testData = {
      timestamp: Timestamp.now(),
      message: 'Diagnostic test',
      test_number: Math.random()
    };
    
    console.log('   📝 Writing to: test_connection/diagnostic_test');
    console.log('   📦 Data:', testData);
    
    await setDoc(testRef, testData);
    console.log('   ✅ Write successful!\n');

    console.log('4️⃣ Attempting to read the document back...');
    const docSnap = await getDoc(testRef);
    
    if (docSnap.exists()) {
      console.log('   ✅ Read successful!');
      console.log('   📄 Document data:', docSnap.data());
      console.log('\n✅ ALL TESTS PASSED! Firestore is working correctly.\n');
    } else {
      console.log('   ⚠️ Document does not exist after writing');
    }

  } catch (error: any) {
    console.error('\n❌ ERROR OCCURRED:\n');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('\nFull error:', error);
    
    console.error('\n📋 Troubleshooting suggestions:');
    
    if (error.code === 'permission-denied') {
      console.error('   • Check Firestore rules in Firebase Console');
      console.error('   • Ensure rules allow read/write access');
      console.error('   • Rules may take 1-2 minutes to propagate');
    } else if (error.message.includes('NOT_FOUND') || error.code === 5) {
      console.error('   • Database may not be fully initialized');
      console.error('   • Try creating a collection manually in Firebase Console');
      console.error('   • Go to: https://console.firebase.google.com/project/lasangpinoy-mobile/firestore');
      console.error('   • Click "Start collection" and create any test collection');
      console.error('   • Wait 2-3 minutes and try again');
    } else if (error.message.includes('RESOURCE_EXHAUSTED')) {
      console.error('   • Free tier quota exceeded');
      console.error('   • Check Firebase Console usage dashboard');
    } else {
      console.error('   • Check internet connection');
      console.error('   • Verify Firebase project exists');
      console.error('   • Check API key is valid');
    }
    
    process.exit(1);
  }
}

diagnose();
