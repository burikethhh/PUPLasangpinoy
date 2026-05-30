// Test Firestore using REST API directly
async function testFirestoreREST() {
  const projectId = 'lasangpinoy-mobile';
  const databaseId = 'default';
  const collectionName = 'test_connection';
  const documentId = 'rest_api_test';
  
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}/${documentId}`;
  
  console.log('🧪 Testing Firestore via REST API\n');
  console.log(`URL: ${url}\n`);
  
  const data = {
    fields: {
      message: { stringValue: 'REST API test' },
      timestamp: { timestampValue: new Date().toISOString() },
      test_number: { doubleValue: Math.random() }
    }
  };
  
  try {
    console.log('📝 Attempting to write document...');
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Write successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Write failed');
      console.log('Error:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testFirestoreREST();
