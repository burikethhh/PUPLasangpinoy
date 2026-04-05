// Firebase Data Seeding Script using REST API
// This seeds the initial data to Firestore using REST API (bypasses SDK issues in Node.js)

const PROJECT_ID = 'lasangpinoy-mobile';
const DATABASE_ID = 'default';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// Helper function to convert JS object to Firestore REST format
function toFirestoreValue(obj: any): any {
  if (obj === null || obj === undefined) {
    return { nullValue: null };
  }
  if (typeof obj === 'string') {
    return { stringValue: obj };
  }
  if (typeof obj === 'number') {
    return Number.isInteger(obj) ? { integerValue: obj.toString() } : { doubleValue: obj };
  }
  if (typeof obj === 'boolean') {
    return { booleanValue: obj };
  }
  if (obj instanceof Date) {
    return { timestampValue: obj.toISOString() };
  }
  if (Array.isArray(obj)) {
    return {
      arrayValue: {
        values: obj.map(item => toFirestoreValue(item))
      }
    };
  }
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

async function createDocument(collectionName: string, documentId: string, data: any) {
  const url = `${BASE_URL}/${collectionName}/${documentId}`;
  const doc = toFirestoreDocument(data);
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create ${collectionName}/${documentId}: ${response.status} - ${error}`);
  }
  
  return await response.json();
}

// Philippine Regions
const regions = [
  { id: 'ncr', name: 'NCR - Metro Manila', description: 'The National Capital Region, heart of Philippine cuisine diversity', created_at: new Date() },
  { id: 'ilocos', name: 'Ilocos Region', description: 'Known for Ilocano cuisine, including bagnet and pinakbet', created_at: new Date() },
  { id: 'central-luzon', name: 'Central Luzon', description: 'The rice bowl of the Philippines with Kapampangan culinary heritage', created_at: new Date() },
  { id: 'calabarzon', name: 'CALABARZON', description: 'Southern Tagalog region known for its diverse dishes', created_at: new Date() },
  { id: 'bicol', name: 'Bicol Region', description: 'Famous for spicy coconut-based dishes like Bicol Express', created_at: new Date() },
  { id: 'western-visayas', name: 'Western Visayas', description: 'Home to Ilonggo cuisine including La Paz Batchoy', created_at: new Date() },
  { id: 'central-visayas', name: 'Central Visayas', description: 'Cebuano cuisine featuring lechon and seafood', created_at: new Date() },
  { id: 'davao', name: 'Davao Region', description: 'Mindanao cuisine with unique tribal and fusion dishes', created_at: new Date() },
];

// Filipino Recipes
const recipes = [
  {
    id: 'adobo',
    title: 'Adobo',
    category: 'Main Dish',
    region: 'NCR - Metro Manila',
    ingredients: 'Chicken or pork, soy sauce, vinegar, garlic, bay leaves, black peppercorns',
    instructions: '1. Combine meat with soy sauce, vinegar, and garlic. Marinate for 30 minutes.\n2. In a pan, bring to boil then simmer for 30-40 minutes.\n3. Remove meat and fry until golden.\n4. Reduce sauce and pour over meat.',
    nutrition: 'Calories: 350, Protein: 28g, Fat: 22g, Carbs: 5g',
    health_notes: 'High in protein. The vinegar aids digestion.',
    history: 'Adobo predates Spanish colonization and was originally a preservation method using vinegar. The Spanish added soy sauce, creating the dish we know today.',
    fun_fact: 'There are over 100 variations of adobo across the Philippines! Each region and family has their own secret recipe.',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Adobo_DSCF4391.jpg/800px-Adobo_DSCF4391.jpg',
    rating: 4.8,
    created_at: new Date(),
  },
  {
    id: 'sinigang',
    title: 'Sinigang na Baboy',
    category: 'Soup',
    region: 'NCR - Metro Manila',
    ingredients: 'Pork ribs, tamarind, tomatoes, radish, kangkong, string beans, onion, fish sauce',
    instructions: '1. Boil pork in water until tender.\n2. Add tomatoes and onion.\n3. Add tamarind soup base.\n4. Add vegetables and cook until tender.\n5. Season with fish sauce.',
    nutrition: 'Calories: 280, Protein: 20g, Fat: 15g, Carbs: 18g',
    health_notes: 'Rich in vitamins from vegetables. Tamarind is good for digestion.',
    history: 'Sinigang is an ancient Filipino soup that showcases our love for sour flavors. It has been a staple in Filipino households for centuries.',
    fun_fact: 'Sinigang was voted the world\'s best soup by TasteAtlas in 2021!',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/The_Best_Sinigang_Cuisine.jpg/800px-The_Best_Sinigang_Cuisine.jpg',
    rating: 4.9,
    created_at: new Date(),
  },
  {
    id: 'kare-kare',
    title: 'Kare-Kare',
    category: 'Main Dish',
    region: 'Central Luzon',
    ingredients: 'Oxtail, tripe, peanut butter, ground rice, banana blossom, eggplant, string beans, annatto oil',
    instructions: '1. Boil oxtail until very tender (2-3 hours).\n2. Make peanut sauce with ground peanuts and toasted rice.\n3. Add vegetables and simmer.\n4. Serve with bagoong (shrimp paste).',
    nutrition: 'Calories: 450, Protein: 32g, Fat: 28g, Carbs: 20g',
    health_notes: 'High in protein. Peanuts provide healthy fats and vitamins.',
    history: 'Kare-kare originated in Pampanga. Some believe it was influenced by the curry dishes of sepoy soldiers who came to the Philippines.',
    fun_fact: 'The word "kare" sounds like "curry" which may explain its origins!',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Mac_MG_5939.jpg/800px-Mac_MG_5939.jpg',
    rating: 4.7,
    created_at: new Date(),
  },
  {
    id: 'lechon-kawali',
    title: 'Lechon Kawali',
    category: 'Main Dish',
    region: 'Central Visayas',
    ingredients: 'Pork belly, salt, pepper, bay leaves, garlic, cooking oil',
    instructions: '1. Boil pork belly with salt, bay leaves, and pepper until tender.\n2. Refrigerate to dry the skin.\n3. Deep fry until skin is crispy.\n4. Serve with liver sauce or vinegar.',
    nutrition: 'Calories: 520, Protein: 25g, Fat: 45g, Carbs: 2g',
    health_notes: 'Best enjoyed in moderation due to high fat content.',
    history: 'Lechon kawali is the home version of the famous whole roasted pig, adapted for everyday cooking.',
    fun_fact: 'The crispy skin called "chicharon" is considered the best part!',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Lechon_Kawali.jpg/800px-Lechon_Kawali.jpg',
    rating: 4.8,
    created_at: new Date(),
  },
  {
    id: 'bicol-express',
    title: 'Bicol Express',
    category: 'Main Dish',
    region: 'Bicol Region',
    ingredients: 'Pork belly, coconut milk, coconut cream, shrimp paste, chili peppers, garlic, onion',
    instructions: '1. Sauté garlic, onion, and pork until browned.\n2. Add shrimp paste and chilies.\n3. Pour coconut milk and simmer.\n4. Add coconut cream and cook until oil separates.',
    nutrition: 'Calories: 420, Protein: 22g, Fat: 35g, Carbs: 8g',
    health_notes: 'Capsaicin from chilies can boost metabolism.',
    history: 'Created by Cely Kalaw in the 1970s, named after the Manila-Bicol train route where she sold her creation.',
    fun_fact: 'Real Bicolanos make this dish so spicy it will make you cry!',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Bicol_Express.jpg/800px-Bicol_Express.jpg',
    rating: 4.6,
    created_at: new Date(),
  },
  {
    id: 'la-paz-batchoy',
    title: 'La Paz Batchoy',
    category: 'Soup',
    region: 'Western Visayas',
    ingredients: 'Pork, liver, bone marrow, egg noodles, chicharron, green onions, garlic oil, beef broth',
    instructions: '1. Prepare rich broth from pork bones.\n2. Cook egg noodles separately.\n3. Slice pork and liver thin.\n4. Assemble in bowl, add toppings.\n5. Pour hot broth over.',
    nutrition: 'Calories: 380, Protein: 26g, Fat: 18g, Carbs: 32g',
    health_notes: 'Rich in iron from liver. High in protein.',
    history: 'Originated in La Paz district of Iloilo City in the 1930s by the Deco family.',
    fun_fact: 'The original recipe is still a family secret!',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Batchoy_of_Iloilo.jpg/800px-Batchoy_of_Iloilo.jpg',
    rating: 4.7,
    created_at: new Date(),
  },
  {
    id: 'sisig',
    title: 'Sisig',
    category: 'Main Dish',
    region: 'Central Luzon',
    ingredients: 'Pork face/ears, chicken liver, onions, chili peppers, calamansi, mayonnaise, egg',
    instructions: '1. Boil pork parts until tender.\n2. Grill until crispy.\n3. Chop finely and mix with onions, peppers.\n4. Sauté with liver and seasonings.\n5. Serve on sizzling plate with egg.',
    nutrition: 'Calories: 400, Protein: 24g, Fat: 30g, Carbs: 8g',
    health_notes: 'High in protein. Best enjoyed in moderation.',
    history: 'Created by Lucia Cunanan in Pampanga. The word sisig comes from "sisigan" meaning to make sour.',
    fun_fact: 'Sisig was originally a sour salad before the sizzling version became popular!',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Authentic_Kapampangan_Sisig.jpg/800px-Authentic_Kapampangan_Sisig.jpg',
    rating: 4.9,
    created_at: new Date(),
  },
  {
    id: 'halo-halo',
    title: 'Halo-Halo',
    category: 'Dessert',
    region: 'NCR - Metro Manila',
    ingredients: 'Shaved ice, evaporated milk, sweetened beans, nata de coco, kaong, sago, gulaman, ube ice cream, leche flan',
    instructions: '1. Layer sweetened ingredients in tall glass.\n2. Add shaved ice.\n3. Top with ice cream and leche flan.\n4. Pour evaporated milk.\n5. Mix everything before eating!',
    nutrition: 'Calories: 320, Protein: 6g, Fat: 8g, Carbs: 58g',
    health_notes: 'Refreshing dessert. High in sugar.',
    history: 'Halo-halo evolved from the Japanese kakigori brought to the Philippines. Filipinos added their own twist with local ingredients.',
    fun_fact: 'Halo-halo literally means "mix-mix" in Tagalog, which is how you eat it!',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Halo-Halo.jpg/800px-Halo-Halo.jpg',
    rating: 4.8,
    created_at: new Date(),
  },
];

async function seedData() {
  console.log('🌱 Starting Firebase Seeding (REST API method)\n');
  
  try {
    // Seed regions
    console.log('📍 Seeding regions...');
    for (const region of regions) {
      await createDocument('regions', region.id, region);
      console.log(`   ✅ Created region: ${region.name}`);
    }
    console.log(`✅ ${regions.length} regions created!\n`);
    
    // Seed recipes
    console.log('🍲 Seeding recipes...');
    for (const recipe of recipes) {
      await createDocument('recipes', recipe.id, recipe);
      console.log(`   ✅ Created recipe: ${recipe.title}`);
    }
    console.log(`✅ ${recipes.length} recipes created!\n`);
    
    // Create admin profile (you'll need to create the user via Firebase Auth Console)
    console.log('👤 Creating admin profile placeholder...');
    const adminProfile = {
      email: 'Kethaguacito@gmail.com',
      username: 'Admin',
      is_admin: true,
      created_at: new Date()
    };
    await createDocument('profiles', 'admin_placeholder', adminProfile);
    console.log('   ✅ Admin profile placeholder created');
    console.log('   ⚠️  You need to create the actual user in Firebase Auth Console:\n');
    console.log('   1. Go to: https://console.firebase.google.com/project/lasangpinoy-mobile/authentication/users');
    console.log('   2. Click "Add user"');
    console.log('   3. Email: Kethaguacito@gmail.com');
    console.log('   4. Password: Totogwapo123');
    console.log('   5. Copy the User UID');
    console.log('   6. Update the profile document ID from "admin_placeholder" to the actual UID\n');
    
    console.log('✅ Seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - ${regions.length} regions`);
    console.log(`   - ${recipes.length} recipes`);
    console.log(`   - 1 admin profile (needs Auth user creation)`);
    
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seedData();
