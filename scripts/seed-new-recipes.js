#!/usr/bin/env node
/**
 * LasangPinoy — New Recipes Seed Script
 * Uploads images to Cloudinary then seeds recipes to Firestore
 */

const CLOUD_NAME = "dafcyj6fh";
const UPLOAD_PRESET = "lasangpinoy_unsigned";
const FIREBASE_KEY = "AIzaSyAZ36rq3scKZDT5SsETJ_SYIOEB9Gcbkyk";
const FIRESTORE_URL =
  "https://firestore.googleapis.com/v1/projects/lasangpinoy-mobile/databases/default/documents";

// ── Cloudinary: upload from remote URL ──────────────────────────────────────
async function uploadImageToCloudinary(imageUrl, publicId) {
  const body = new URLSearchParams({
    file: imageUrl,
    upload_preset: UPLOAD_PRESET,
    folder: "lasangpinoy/recipes",
    public_id: publicId,
  });

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );

  const data = await res.json();
  if (!res.ok)
    throw new Error(`Cloudinary upload failed: ${data.error?.message}`);

  // Return optimized CDN URL
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_800/");
}

// ── Firestore: save document ─────────────────────────────────────────────────
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number")
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val))
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// ── Firebase: email/password sign-in → ID token ──────────────────────────────
async function getFirebaseToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "Kethaguacito@gmail.com",
        password: "Totogwapo123",
        returnSecureToken: true,
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Firebase auth failed: ${data.error?.message}`);
  return data.idToken;
}

async function saveRecipe(id, data, idToken) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);

  const res = await fetch(`${FIRESTORE_URL}/recipes/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore error for ${id}: ${err}`);
  }
  return res.json();
}

// ── Recipe data ───────────────────────────────────────────────────────────────
const newRecipes = [
  // ── ILOCOS REGION ──────────────────────────────────────────────────────────
  {
    id: "bagnet",
    title: "Bagnet",
    category: "Main Dish",
    region: "Ilocos Region",
    ingredients:
      "Pork belly, water, salt, black peppercorns, bay leaves, garlic, cooking oil",
    instructions:
      "1. Boil pork belly in water with salt, peppercorns, bay leaves, and garlic for 1 hour until tender.\n2. Drain and let cool completely. Score the skin with a fork.\n3. Rub skin generously with salt and let air-dry for at least 1 hour (overnight in ref is better).\n4. Deep fry in hot oil over medium heat for 20–25 minutes until golden.\n5. Remove, let cool, then re-fry in very hot oil for 5–10 minutes until skin is extremely crispy and blistered.\n6. Drain on paper towels. Serve with sukang Ilocos (Ilocos vinegar) and dinuguan or pinakbet.",
    nutrition: "Calories: 550, Protein: 28g, Fat: 48g, Carbs: 2g",
    health_notes:
      "High in protein. Best enjoyed occasionally due to high fat content. The double-frying renders out significant fat from the skin.",
    history:
      "Bagnet is the Ilocano answer to lechon kawali. Unlike the Manila version, bagnet is deep-fried twice — the first fry cooks it through, the second fry at very high heat creates the signature super-crispy, blistered skin. It has been an Ilocano staple for generations.",
    fun_fact:
      'Bagnet is so beloved in Ilocos that it inspired a national dish craze — you will find "Ilocos bagnet" on menus from Laoag to Davao!',
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/e/ee/Crispy_Bagnet%2C_Mar_2024.jpg",
    user_id: "",
    created_at: new Date(),
  },
  {
    id: "pinakbet",
    title: "Pinakbet",
    category: "Main Dish",
    region: "Ilocos Region",
    ingredients:
      "Pork belly or shrimp, ampalaya (bitter melon), eggplant, okra, kalabasa (squash), sitaw (string beans), tomatoes, onion, garlic, bagaoong Ilocano (fermented fish or shrimp paste), water",
    instructions:
      "1. Sauté garlic and onion in oil until fragrant.\n2. Add pork and cook until browned. Add tomatoes and cook until soft.\n3. Add bagaoong and a little water. Stir and bring to boil.\n4. Layer vegetables in the pot: kalabasa first, then eggplant, ampalaya, okra, and sitaw on top.\n5. Cover and cook over medium heat for 10–15 minutes. Do NOT stir — let vegetables steam and absorb the flavors.\n6. Season to taste. Serve with rice.",
    nutrition: "Calories: 185, Protein: 12g, Fat: 10g, Carbs: 16g",
    health_notes:
      "Extremely nutritious — ampalaya lowers blood sugar, squash is rich in beta-carotene, and okra is high in fiber. One of the healthiest Filipino dishes.",
    history:
      'Pinakbet is one of the oldest indigenous Filipino dishes, predating Spanish colonization. The name comes from the Ilocano word "pinakebbet" meaning "shriveled." The Ilocano version uses bagaoong isda (fermented fish paste) while the Tagalog version uses bagaoong alamang (shrimp paste).',
    fun_fact:
      "Pinakbet is considered one of the most authentically Filipino dishes because it uses vegetables and flavors that existed in the Philippines long before foreign influence!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/6/61/Pinakbet.jpg",
    user_id: "",
    created_at: new Date(),
  },
  {
    id: "ilocos-empanada",
    title: "Ilocos Empanada",
    category: "Main Dish",
    region: "Ilocos Region",
    ingredients:
      "Galapong (rice flour), annatto powder (achuete), water, salt, Vigan longganisa (skinless), egg, green papaya or beansprouts, cooking oil",
    instructions:
      "1. Mix galapong with annatto powder, salt, and water to form a smooth orange dough.\n2. Prepare filling: mix shredded green papaya with a little salt. Set aside skinless longganisa.\n3. Flatten a portion of dough into a thin circle on a banana leaf or plastic wrap.\n4. Place filling in center: a spoonful of papaya, one longganisa, and crack a raw egg on top.\n5. Fold dough over filling and crimp edges tightly to seal into a half-moon shape.\n6. Deep fry in hot oil for 3–4 minutes, turning once, until golden orange and crispy.\n7. Serve hot with sukang Ilocos (Ilocos sugarcane vinegar).",
    nutrition: "Calories: 320, Protein: 14g, Fat: 18g, Carbs: 28g",
    health_notes:
      "Annatto (achuete) is a natural antioxidant. Best enjoyed fresh and hot while the shell is crispy.",
    history:
      "The Ilocos Empanada is distinctly different from the Spanish empanada it was derived from. The Ilocano version uses a rice flour shell colored bright orange with annatto — a testament to how Filipino cooks transformed a Spanish import into something entirely their own.",
    fun_fact:
      "The town of Batac in Ilocos Norte is the empanada capital of the Philippines. Every year, the Batac Empanada Festival celebrates this iconic street food with cooking competitions!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/1/16/Ilocos_Empanada_in_Batac%2C_Ilocos_Norte.jpg",
    user_id: "",
    created_at: new Date(),
  },

  // ── CALABARZON ────────────────────────────────────────────────────────────
  {
    id: "bulalo",
    title: "Bulalo",
    category: "Soup",
    region: "CALABARZON",
    ingredients:
      "Beef shank with bone marrow, corn on the cob, cabbage, pechay (bok choy), onion, whole black peppercorns, fish sauce, salt, water",
    instructions:
      "1. Place beef shank in a large pot. Cover with cold water and bring to a boil. Discard this first water (removes impurities).\n2. Refill with fresh water. Add onion and peppercorns. Simmer on low heat for 2.5–3 hours until beef is very tender.\n3. Skim off fat and foam periodically for a clear broth.\n4. Add corn and cook for 15 minutes.\n5. Add cabbage and pechay. Cook for 3–5 minutes.\n6. Season with fish sauce and salt.\n7. Serve immediately in bowls, making sure each serving gets a piece of bone with marrow.",
    nutrition: "Calories: 420, Protein: 38g, Fat: 24g, Carbs: 16g",
    health_notes:
      "Rich in collagen from the bone marrow which supports joint and skin health. The slow-cooked broth is excellent for gut health.",
    history:
      "Bulalo is the pride of Batangas province in CALABARZON. The dish became famous because Batangas was historically a major cattle-raising region, giving locals access to quality beef. The Tagaytay-Nasugbu area in Batangas is particularly known for its bulalo restaurants.",
    fun_fact:
      "The bone marrow in bulalo is considered the greatest prize — locals fight over who gets to scoop out the rich marrow with a spoon and eat it with rice!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/e/e2/Bulalo%2C_Pamana._%28Philippines%29.jpg",
    user_id: "",
    created_at: new Date(),
  },
  {
    id: "lomi",
    title: "Lomi",
    category: "Noodles",
    region: "CALABARZON",
    ingredients:
      "Thick fresh egg noodles (lomi noodles), pork slices, pork liver, kikiam, fishballs, chicharrón, egg, onion, garlic, chicken or pork broth, cornstarch, soy sauce, oyster sauce, green onion",
    instructions:
      "1. Sauté garlic and onion in oil. Add pork and liver, cook for 5 minutes.\n2. Pour in broth and bring to boil. Add kikiam and fishballs.\n3. Add lomi noodles and cook for 3–5 minutes until tender.\n4. Mix cornstarch with cold water and add to thicken the broth.\n5. Season with soy sauce and oyster sauce.\n6. Beat an egg and pour in a slow stream while stirring to create egg threads.\n7. Top with chicharrón, green onion, and a drizzle of calamansi juice.",
    nutrition: "Calories: 385, Protein: 22g, Fat: 16g, Carbs: 40g",
    health_notes:
      "High in protein. The thick starchy broth is warming and filling — popular as a cold weather or late-night comfort food.",
    history:
      "Batangas Lomi has been a Batangueño institution for generations. The thick egg noodles and glutinous, starchy broth set it apart from any other noodle dish in the Philippines. Lomi houses in Batangas are legendary local institutions, open late into the night.",
    fun_fact:
      "True Batangas lomi uses fresh handmade thick egg noodles — the thicker and chewier, the better. No two lomi houses in Batangas taste exactly alike!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/f/f7/BATANGAS_LOMI.jpg",
    user_id: "",
    created_at: new Date(),
  },

  // ── NOODLES (NCR/National) ─────────────────────────────────────────────────
  {
    id: "pancit-canton",
    title: "Pancit Canton",
    category: "Noodles",
    region: "NCR - Metro Manila",
    ingredients:
      "Canton egg noodles, chicken breast, shrimp, pork belly, cabbage, carrots, celery, snow peas, garlic, onion, soy sauce, oyster sauce, chicken broth, calamansi, cooking oil",
    instructions:
      "1. Boil canton noodles for 3 minutes until al dente. Drain and set aside.\n2. Sauté garlic and onion in oil. Add pork and chicken, cook until done.\n3. Add shrimp and cook for 2 minutes.\n4. Pour broth, soy sauce, and oyster sauce. Bring to boil.\n5. Add vegetables (carrots, cabbage, snow peas) and cook for 3 minutes.\n6. Add noodles and toss everything together until noodles absorb the sauce.\n7. Serve with calamansi wedges and extra soy sauce.",
    nutrition: "Calories: 325, Protein: 18g, Fat: 9g, Carbs: 44g",
    health_notes:
      "Good source of protein from multiple sources. Adding extra vegetables increases fiber and vitamin content.",
    history:
      "Canton noodles were brought to the Philippines by Chinese immigrants from Canton (Guangdong) province. Over centuries, Filipinos adapted the dish with local ingredients and flavors, and today pancit canton is eaten at every birthday, fiesta, and family gathering — symbolizing long life.",
    fun_fact:
      "Pancit is served at EVERY Filipino birthday party without exception — the long noodles represent a long, healthy life. Never cut the noodles before serving!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/d/d3/Pancit_Canton_Guisado_1.jpg",
    user_id: "",
    created_at: new Date(),
  },
  {
    id: "pancit-malabon",
    title: "Pancit Malabon",
    category: "Noodles",
    region: "NCR - Metro Manila",
    ingredients:
      "Thick rice noodles, shrimp, squid, tinapa (smoked fish), pork belly, shrimp broth, annatto/achuete oil, chicharrón, hard-boiled eggs, green onion, calamansi, fish sauce",
    instructions:
      "1. Soak thick rice noodles in water for 30 minutes, then boil for 5 minutes. Drain.\n2. Make the sauce: sauté garlic in annatto oil. Add shrimp broth, shrimp paste, and fish sauce. Thicken with cornstarch. Add shrimp and squid.\n3. Flake tinapa and mix into the sauce.\n4. Toss noodles in the sauce until fully coated with the orange color.\n5. Arrange on a large platter. Top with sliced pork, more shrimp, sliced hard-boiled eggs, chicharrón, and green onion.\n6. Serve with calamansi.",
    nutrition: "Calories: 380, Protein: 22g, Fat: 12g, Carbs: 48g",
    health_notes:
      "Rich in omega-3 from seafood. The tinapa (smoked fish) adds a distinctive smoky umami flavor that is hard to replicate.",
    history:
      "Pancit Malabon originated in Malabon City, a coastal city north of Manila that has historically been a major fishing community. The abundance of fresh seafood in Malabon naturally led to this seafood-rich pancit variation. It is traditionally served in large bilao (bamboo trays) at parties.",
    fun_fact:
      "Pancit Malabon is always served in a bilao (round bamboo tray) and is a must at Filipino parties — one tray can feed an entire barkada!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/7/76/4499Pancit_Malabon_in_Susie%27s_Cuisine.jpg",
    user_id: "",
    created_at: new Date(),
  },
  {
    id: "pancit-palabok",
    title: "Pancit Palabok",
    category: "Noodles",
    region: "NCR - Metro Manila",
    ingredients:
      "Bihon rice noodles, shrimp, pork, tinapa flakes, chicharrón, hard-boiled eggs, green onion, calamansi, annatto powder, shrimp broth, cornstarch, garlic, fish sauce",
    instructions:
      "1. Soak bihon noodles and cook until tender. Drain and arrange on a platter.\n2. Make palabok sauce: sauté garlic, add shrimp broth and annatto for color. Thicken with cornstarch. Season with fish sauce.\n3. Pour sauce generously over noodles.\n4. Top with shrimp, flaked tinapa, sliced pork, chicharrón, hard-boiled egg slices, and green onion.\n5. Serve with calamansi on the side.",
    nutrition: "Calories: 345, Protein: 18g, Fat: 11g, Carbs: 46g",
    health_notes:
      "Contains seafood providing omega-3 fatty acids. Rice noodles are gluten-free making this a good option for gluten-sensitive individuals.",
    history:
      'Pancit Palabok is one of the most popular pancit varieties in the Philippines, especially in Manila. The dish is distinctive for its bright orange sauce made from annatto and shrimp broth. The word "palabok" refers to the sauce that is poured on top.',
    fun_fact:
      "Jollibee, the Philippines most loved fast food chain, put pancit palabok on their menu — making it one of the few traditional Filipino dishes that successfully entered fast food!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/b/b1/Pancit_Palabok.jpg",
    user_id: "",
    created_at: new Date(),
  },

  // ── DESSERTS ───────────────────────────────────────────────────────────────
  {
    id: "leche-flan",
    title: "Leche Flan",
    category: "Dessert",
    region: "NCR - Metro Manila",
    ingredients:
      "10 egg yolks, 1 can condensed milk, 1 can evaporated milk, 1 tsp vanilla extract, 1 cup sugar (for caramel)",
    instructions:
      "1. Make caramel: melt sugar in a llanera (oval mold) over low heat until amber. Swirl to coat the bottom. Let cool and harden.\n2. Mix egg yolks, condensed milk, evaporated milk, and vanilla until smooth. Strain through a fine sieve.\n3. Pour custard mixture over the hardened caramel in the llanera.\n4. Cover tightly with aluminum foil.\n5. Steam over low heat for 35–45 minutes until set (a toothpick comes out clean).\n6. Cool completely, then refrigerate for at least 2 hours.\n7. To serve, run a knife around the edge and invert onto a plate — the caramel cascades over the custard.",
    nutrition: "Calories: 285, Protein: 7g, Fat: 11g, Carbs: 42g",
    health_notes:
      "High in calcium from dairy. The egg yolks provide choline which is important for brain health. Best enjoyed in moderation due to sugar content.",
    history:
      "Leche flan was introduced to the Philippines by Spanish colonizers who brought the crème caramel tradition from Spain. Filipino cooks adapted it using only egg yolks (not whole eggs) and condensed milk — giving the Filipino version a much richer, creamier texture than the Spanish original.",
    fun_fact:
      "Filipino leche flan is notably richer and heavier than its Spanish or French counterparts because it uses up to 10 egg yolks! Some Filipino grandmothers use even more.",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/c/c9/Leche_flan_%28Philippines%29_01.jpg",
    user_id: "",
    created_at: new Date(),
  },
  {
    id: "bibingka",
    title: "Bibingka",
    category: "Dessert",
    region: "NCR - Metro Manila",
    ingredients:
      "Galapong (ground rice or rice flour), coconut milk, eggs, sugar, butter, salted duck egg, kesong puti or cheese, banana leaves",
    instructions:
      "1. Preheat a clay pot or heavy pan. Line with banana leaf, brushed with butter.\n2. Mix galapong with coconut milk, eggs, and sugar until smooth.\n3. Pour batter into the banana leaf-lined mold.\n4. Cook over hot coals below and above (or bake at 200°C) for 15–20 minutes.\n5. When top is set, add sliced salted duck egg and cheese on top.\n6. Continue cooking until golden and edges pull away from the leaf.\n7. Brush with softened butter and sprinkle sugar. Serve hot.",
    nutrition: "Calories: 245, Protein: 5g, Fat: 9g, Carbs: 38g",
    health_notes:
      "Rice-based and naturally gluten-free. Coconut milk provides healthy medium-chain triglycerides.",
    history:
      "Bibingka is one of the most ancient Filipino foods, with roots in pre-colonial rice cake traditions. The Spanish colonial period added the egg and cheese topping. It is most famously associated with the Christmas season — traditionally sold outside churches during Simbang Gabi (nine-day dawn masses before Christmas).",
    fun_fact:
      "The smell of bibingka cooking on charcoal outside a church at 4am during Simbang Gabi is one of the most iconic Filipino Christmas memories — every Filipino who grew up going to Simbang Gabi will immediately recognize that aroma!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/8/83/Bibingka_%28Philippines%29.jpg",
    user_id: "",
    created_at: new Date(),
  },

  // ── DAVAO REGION ──────────────────────────────────────────────────────────
  {
    id: "kinilaw",
    title: "Kinilaw na Isda",
    category: "Main Dish",
    region: "Davao Region",
    ingredients:
      "Fresh tanigue (wahoo/Spanish mackerel) or malasugi (swordfish), coconut vinegar (sukang tuba), coconut milk, fresh ginger (julienned), red onion, calamansi, green or red chili, salt, pepper",
    instructions:
      '1. Cut fresh fish into small cubes. The fish MUST be sashimi-grade fresh.\n2. Soak fish in coconut vinegar for 3–5 minutes — the acid will "cook" the surface.\n3. Drain most of the vinegar.\n4. Add julienned ginger, sliced red onion, and chopped chili.\n5. Squeeze calamansi juice generously.\n6. Add a splash of fresh coconut milk for creaminess.\n7. Season with salt and pepper.\n8. Toss gently. Taste and adjust — it should be sour, spicy, and slightly sweet.\n9. Serve immediately, chilled.',
    nutrition: "Calories: 180, Protein: 24g, Fat: 8g, Carbs: 5g",
    health_notes:
      'Excellent source of omega-3 fatty acids. The vinegar "cures" the fish safely. High protein, low carb. Use only the freshest sashimi-grade fish.',
    history:
      "Kinilaw is a pre-colonial Filipino dish that predates Spanish arrival by thousands of years. It is the Philippine answer to ceviche, and is actually older than the Peruvian version. The Visayas and Mindanao regions are most famous for kinilaw, with each region having their own style.",
    fun_fact:
      "Kinilaw is proof that Filipinos were creating sophisticated raw seafood cuisine long before it became a global trend — this dish has been eaten in the Philippines for over 2,000 years!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/7/7f/Kinilaw_%28Philippine_Ceviche%29.jpg",
    user_id: "",
    created_at: new Date(),
  },

  // ── SOUPS (NCR/National) ───────────────────────────────────────────────────
  {
    id: "tinolang-manok",
    title: "Tinolang Manok",
    category: "Soup",
    region: "NCR - Metro Manila",
    ingredients:
      "Whole chicken (cut into pieces), green papaya or sayote (chayote), dahon ng sili (chili leaves) or malunggay leaves, ginger (sliced), garlic, onion, fish sauce, cooking oil, water or chicken broth",
    instructions:
      "1. Sauté ginger, garlic, and onion in oil until fragrant.\n2. Add chicken pieces and cook until lightly browned.\n3. Season with fish sauce and stir.\n4. Pour water or broth. Bring to boil then simmer for 20–25 minutes.\n5. Add green papaya or sayote. Cook for 8 minutes until tender.\n6. Add chili leaves or malunggay. Cook for 1 minute only — do not overcook the leaves.\n7. Adjust seasoning. Serve hot with white rice.",
    nutrition: "Calories: 220, Protein: 25g, Fat: 9g, Carbs: 12g",
    health_notes:
      "One of the healthiest Filipino dishes. Malunggay (moringa) is called a superfood — it is extremely rich in vitamins A, C, and iron. Ginger aids digestion and boosts immunity. Low in fat.",
    history:
      'Tinola is one of the oldest Filipino dishes, immortalized in Jose Rizal\'s novel "Noli Me Tangere" (1887) when the villain Padre Damaso deliberately gave the hero Crisostomo Ibarra only the neck and wings while keeping the best pieces for himself — a scene that perfectly captures Filipino class tensions.',
    fun_fact:
      "Jose Rizal featured tinolang manok in his famous novel Noli Me Tangere — it's possibly the most literarily famous Filipino dish! The soup scene is taught in every Filipino high school.",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/6/62/Chicken_tinola.jpg",
    user_id: "",
    created_at: new Date(),
  },

  // ── BICOL REGION ──────────────────────────────────────────────────────────
  {
    id: "ginataang-langka",
    title: "Ginataang Langka",
    category: "Main Dish",
    region: "Bicol Region",
    ingredients:
      "Young unripe jackfruit (langka), coconut milk, coconut cream, pork belly or shrimp, shrimp paste (bagoong), garlic, onion, ginger, chili peppers, fish sauce",
    instructions:
      "1. Boil young jackfruit in salted water for 15 minutes to remove bitterness. Drain.\n2. Sauté garlic, onion, and ginger in oil.\n3. Add pork belly and cook until browned.\n4. Add shrimp paste and cook for 2 minutes.\n5. Add jackfruit and pour coconut milk. Simmer for 15 minutes.\n6. Add chili peppers and coconut cream. Simmer until sauce thickens and oil separates.\n7. Season with fish sauce. Serve over rice.",
    nutrition: "Calories: 280, Protein: 14g, Fat: 21g, Carbs: 18g",
    health_notes:
      "Young jackfruit is high in fiber and potassium. Coconut milk provides healthy MCTs. This dish is naturally satisfying and filling.",
    history:
      "Ginataan (coconut milk-based cooking) is the hallmark of Bicol cuisine, where almost every dish includes coconut milk. Ginataang langka demonstrates how Bicolanos turn the abundant young jackfruit from local trees into a rich, flavorful main course. The addition of chili is signature Bicol.",
    fun_fact:
      "Young green jackfruit has a meaty, fibrous texture that makes it a popular meat substitute worldwide — but Bicolanos have been eating it this way for centuries long before the vegan food trend!",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/b/bf/Ginataang_langka_%28Philippines%29_01.jpg",
    user_id: "",
    created_at: new Date(),
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🌱  LasangPinoy — Seeding New Recipes");
  console.log("════════════════════════════════════════\n");
  console.log(`  Total recipes to seed: ${newRecipes.length}\n`);

  process.stdout.write("  🔐  Authenticating with Firebase... ");
  const idToken = await getFirebaseToken();
  process.stdout.write("✅ Token acquired\n\n");

  let successCount = 0;
  let failCount = 0;

  for (const recipe of newRecipes) {
    process.stdout.write(`  📷  Uploading image for "${recipe.title}"... `);

    let cloudinaryUrl = recipe.image_url; // fallback to original if upload fails

    try {
      cloudinaryUrl = await uploadImageToCloudinary(
        recipe.image_url,
        recipe.id,
      );
      process.stdout.write("✅ Cloudinary\n");
    } catch (err) {
      process.stdout.write(
        `⚠️  Using original URL (${err.message.slice(0, 60)})\n`,
      );
    }

    process.stdout.write(`  🍲  Seeding "${recipe.title}" to Firestore... `);

    try {
      await saveRecipe(
        recipe.id,
        { ...recipe, image_url: cloudinaryUrl },
        idToken,
      );
      process.stdout.write("✅ Done\n");
      successCount++;
    } catch (err) {
      process.stdout.write(`❌ FAILED: ${err.message.slice(0, 80)}\n`);
      failCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
    console.log("");
  }

  console.log("════════════════════════════════════════");
  console.log(`✅  Seeded:  ${successCount} recipes`);
  if (failCount > 0) console.log(`❌  Failed:  ${failCount} recipes`);
  console.log("════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
