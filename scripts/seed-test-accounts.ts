// Script to seed test accounts in Firebase Auth and Firestore
const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAZ36rq3scKZDT5SsETJ_SYIOEB9Gcbkyk';
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'lasangpinoy-mobile';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/default/documents`;
const AUTH_SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const AUTH_SIGNIN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;

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

async function createOrSignInUser(email: string, password: string) {
  // Try signup
  const signupRes = await fetch(AUTH_SIGNUP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const signupData = await signupRes.json();
  if (signupRes.ok) {
    return { uid: signupData.localId, email: signupData.email, token: signupData.idToken };
  }

  // If already exists, sign in
  const signinRes = await fetch(AUTH_SIGNIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const signinData = await signinRes.json();
  if (signinRes.ok) {
    return { uid: signinData.localId, email: signinData.email, token: signinData.idToken };
  }

  throw new Error(`Auth error for ${email}: ${JSON.stringify(signinData)}`);
}

async function saveProfile(token: string, uid: string, profileData: any) {
  const url = `${FIRESTORE_BASE_URL}/profiles/${uid}?key=${API_KEY}`;
  const doc = toFirestoreDocument(profileData);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`Failed to save profile for ${uid}:`, res.status, text);
  } else {
    console.log(`✅ Profile saved for ${profileData.username} (${profileData.role})`);
  }
}

async function main() {
  console.log('Seeding test accounts into Firebase...\n');
  const accounts = [
    {
      email: 'customer@foodfix.com',
      password: 'password123',
      username: 'Juan Dela Cruz',
      role: 'customer',
      is_admin: false,
      phone: '09171234567',
      address: 'Anonas St, Sta. Mesa, Manila',
      email_verified: true,
    },
    {
      email: 'admin@foodfix.com',
      password: 'admin12345',
      username: 'FoodFix Admin',
      role: 'admin',
      is_admin: true,
      phone: '09181234567',
      address: 'FoodFix Central Kitchen, Manila',
      email_verified: true,
    },
    {
      email: 'staff@foodfix.com',
      password: 'staff12345',
      username: 'Kuya Rider Staff',
      role: 'staff',
      is_admin: false,
      phone: '09191234567',
      address: 'FoodFix Hub, Manila',
      email_verified: true,
    },
  ];

  for (const acc of accounts) {
    try {
      const user = await createOrSignInUser(acc.email, acc.password);
      console.log(`👤 Auth user ready: ${acc.email} (UID: ${user.uid})`);
      await saveProfile(user.token, user.uid, {
        email: acc.email,
        username: acc.username,
        is_admin: acc.is_admin,
        role: acc.role,
        phone: acc.phone,
        address: acc.address,
        email_verified: acc.email_verified,
        created_at: new Date(),
      });
    } catch (e: any) {
      console.error(`❌ Error with ${acc.email}:`, e.message);
    }
  }

  console.log('\n🎉 Seed complete!');
}

main();
