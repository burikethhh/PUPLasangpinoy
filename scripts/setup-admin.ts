// Complete Firebase Setup using REST API
// Creates admin user in Firebase Auth and corresponding profile in Firestore

const PROJECT_ID = 'lasangpinoy-mobile';
const DATABASE_ID = 'default';
const API_KEY = 'REDACTED_FIREBASE_API_KEY';

// Firebase Auth REST API endpoint
const AUTH_SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// Helper to convert to Firestore format
function toFirestoreValue(obj: any): any {
  if (obj === null || obj === undefined) return { nullValue: null };
  if (typeof obj === 'string') return { stringValue: obj };
  if (typeof obj === 'number') return Number.isInteger(obj) ? { integerValue: obj.toString() } : { doubleValue: obj };
  if (typeof obj === 'boolean') return { booleanValue: obj };
  if (obj instanceof Date) return { timestampValue: obj.toISOString() };
  if (Array.isArray(obj)) return { arrayValue: { values: obj.map(item => toFirestoreValue(item)) } };
  if (typeof obj === 'object') {
    const fields: any = {};
    for (const [key, value] of Object.entries(obj)) {
      fields[key] = toFirestoreValue(value);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(obj) };
}

function toFirestoreDocument(data: any) {
  const fields: any = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }
  return { fields };
}

async function createAuthUser(email: string, password: string) {
  console.log(`📧 Creating Firebase Auth user: ${email}`);
  
  const response = await fetch(AUTH_SIGNUP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email,
      password: password,
      returnSecureToken: true
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    if (error.error?.message === 'EMAIL_EXISTS') {
      console.log('   ⚠️  User already exists, fetching existing user...');
      // User exists, we'll return a placeholder UID
      // In production, you'd want to use Firebase Admin SDK to get the actual UID
      throw new Error('User already exists. Please delete the existing user first or use a different email.');
    }
    throw new Error(`Failed to create user: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  console.log(`   ✅ Auth user created successfully!`);
  console.log(`   🆔 User UID: ${data.localId}`);
  
  return {
    uid: data.localId,
    email: data.email,
    idToken: data.idToken
  };
}

async function createFirestoreProfile(uid: string, email: string, username: string, isAdmin: boolean) {
  console.log(`\n📝 Creating Firestore profile for UID: ${uid}`);
  
  const profileData = {
    email: email,
    username: username,
    is_admin: isAdmin,
    created_at: new Date()
  };
  
  const url = `${FIRESTORE_BASE_URL}/profiles/${uid}`;
  const doc = toFirestoreDocument(profileData);
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create profile: ${response.status} - ${error}`);
  }
  
  console.log('   ✅ Profile created successfully!');
  return await response.json();
}

async function deleteDocument(collectionName: string, documentId: string) {
  const url = `${FIRESTORE_BASE_URL}/${collectionName}/${documentId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (response.ok || response.status === 404) {
    return true;
  }
  
  throw new Error(`Failed to delete ${collectionName}/${documentId}`);
}

async function setupAdmin() {
  console.log('🔧 Firebase Admin Setup\n');
  console.log('═══════════════════════════════════════════\n');
  
  const adminEmail = 'Kethaguacito@gmail.com';
  const adminPassword = 'Totogwapo123';
  const adminUsername = 'Admin';
  
  try {
    // Step 1: Create Auth user
    const authUser = await createAuthUser(adminEmail, adminPassword);
    
    // Step 2: Create Firestore profile
    await createFirestoreProfile(authUser.uid, authUser.email, adminUsername, true);
    
    // Step 3: Delete the placeholder profile
    console.log('\n🗑️  Cleaning up placeholder profile...');
    try {
      await deleteDocument('profiles', 'admin_placeholder');
      console.log('   ✅ Placeholder deleted');
    } catch (err) {
      console.log('   ℹ️  No placeholder to delete');
    }
    
    console.log('\n═══════════════════════════════════════════');
    console.log('✅ Admin Setup Complete!\n');
    console.log('📊 Admin Account Details:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   User UID: ${authUser.uid}`);
    console.log(`   Admin Status: Yes`);
    console.log('\n🚀 You can now log in to the app!\n');
    
  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    
    if (error.message.includes('EMAIL_EXISTS') || error.message.includes('already exists')) {
      console.error('\n📋 To fix this:');
      console.error('   1. Delete the existing user in Firebase Console:');
      console.error('      https://console.firebase.google.com/project/lasangpinoy-mobile/authentication/users');
      console.error('   2. Run this script again');
      console.error('\n   OR use Firebase CLI:');
      console.error(`   npx firebase-tools auth:export users.json --project ${PROJECT_ID}`);
      console.error(`   # Find and delete the user, then import back`);
    }
    
    process.exit(1);
  }
}

setupAdmin();
