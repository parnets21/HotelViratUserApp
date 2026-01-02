// Network connectivity test script
// Run this in the React Native app to test network connectivity

const testNetworkConnectivity = async () => {
  console.log('🔍 Testing network connectivity...');
  
  const endpoints = [
    'https://hotelvirat.com/api/v1/hotel/category',
    'https://hotelvirat.com/api/v1/hotel/category',
    'https://hotelvirat.com/api/v1/hotel/category'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Testing: ${endpoint}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ SUCCESS: ${endpoint} - Status: ${response.status}`);
        console.log(`📊 Data length: ${JSON.stringify(data).length} characters`);
        return endpoint; // Return the working endpoint
      } else {
        console.log(`❌ FAILED: ${endpoint} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${endpoint} - ${error.message}`);
    }
  }
  
  console.log('❌ All endpoints failed');
  return null;
};

// Export for use in components
export default testNetworkConnectivity;

// Test immediately when imported
testNetworkConnectivity();