// Test script to understand table booking API requirements
const testTableBooking = async () => {
  console.log('🧪 Testing table booking API...');
  
  // Test data similar to what the app sends
  const testBookingData = {
    tableId: '6933d62c01f2d53e0fd20507', // From the logs
    customerName: 'Test User',
    customerPhone: '1234567890',
    guestCount: 2,
    reservationDate: '2025-12-30',
    timeSlot: '11:00 AM - 12:00 PM',
    status: 'confirmed'
  };
  
  try {
    console.log('📋 Sending test booking data:', testBookingData);
    
    const response = await fetch('http://192.168.1.27:9000/api/v1/hotel/reservation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testBookingData),
    });
    
    const result = await response.json();
    
    console.log('📋 Test API Response:', {
      status: response.status,
      ok: response.ok,
      result: result
    });
    
    if (!response.ok) {
      console.log('❌ Test booking failed. Trying alternative field names...');
      
      // Try with alternative field names
      const alternativeData = {
        tableId: '6933d62c01f2d53e0fd20507',
        name: 'Test User',
        phone: '1234567890',
        guests: 2,
        date: '2025-12-30',
        time: '11:00 AM - 12:00 PM',
        status: 'confirmed'
      };
      
      console.log('📋 Trying alternative field names:', alternativeData);
      
      const altResponse = await fetch('http://192.168.1.27:9000/api/v1/hotel/reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alternativeData),
      });
      
      const altResult = await altResponse.json();
      
      console.log('📋 Alternative API Response:', {
        status: altResponse.status,
        ok: altResponse.ok,
        result: altResult
      });
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// Run the test
testTableBooking();