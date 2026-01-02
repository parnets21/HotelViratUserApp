import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Appearance,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

const TableBooking = ({ route }) => {
  const navigation = useNavigation();
  const { tables: initialTables = [], branchId: initialBranchId, availableCount } = route.params || {};
  
  const [tables, setTables] = useState(initialTables);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId);
  const [selectedBranchIndex, setSelectedBranchIndex] = useState(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  const [selectedTable, setSelectedTable] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [unavailableSlots, setUnavailableSlots] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookingDetails, setBookingDetails] = useState({
    customerName: '',
    phoneNumber: '',
    numberOfGuests: '2',
    bookingDate: new Date().toISOString().split('T')[0],
    timeSlot: '', // Empty by default to force selection
    specialRequests: ''
  });

  // Define available time slots
  const timeSlots = [
    { value: '09:00 AM - 10:00 AM', label: '9:00 AM - 10:00 AM' },
    { value: '10:00 AM - 11:00 AM', label: '10:00 AM - 11:00 AM' },
    { value: '11:00 AM - 12:00 PM', label: '11:00 AM - 12:00 PM' },
    { value: '12:00 PM - 01:00 PM', label: '12:00 PM - 1:00 PM' },
    { value: '01:00 PM - 02:00 PM', label: '1:00 PM - 2:00 PM' },
    { value: '02:00 PM - 03:00 PM', label: '2:00 PM - 3:00 PM' },
    { value: '03:00 PM - 04:00 PM', label: '3:00 PM - 4:00 PM' },
    { value: '04:00 PM - 05:00 PM', label: '4:00 PM - 5:00 PM' },
    { value: '05:00 PM - 06:00 PM', label: '5:00 PM - 6:00 PM' },
    { value: '06:00 PM - 07:00 PM', label: '6:00 PM - 7:00 PM' },
    { value: '07:00 PM - 08:00 PM', label: '7:00 PM - 8:00 PM' },
    { value: '08:00 PM - 09:00 PM', label: '8:00 PM - 9:00 PM' },
    { value: '09:00 PM - 10:00 PM', label: '9:00 PM - 10:00 PM' },
  ];
  const [userId, setUserId] = useState(null);

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Get user ID from AsyncStorage
  useEffect(() => {
    const getUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
        }
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };
    getUserId();
  }, []);

  // Fetch branches when component loads
  useEffect(() => {
    fetchBranches();
  }, []);

  // Fetch tables when component loads or branch changes
  useEffect(() => {
    if (selectedBranchId) {
      refreshTables();
    }
  }, [selectedBranchId]);

  const fetchBranches = async () => {
    try {
      console.log("🌐 Fetching branches for table booking...");
      
      const response = await fetch('https://hotelvirat.com/api/v1/hotel/branch');
      
      if (response.ok) {
        const branchesData = await response.json();
        console.log("✅ Branches fetched:", branchesData);
        
        if (Array.isArray(branchesData) && branchesData.length > 0) {
          setBranches(branchesData);
          
          // If no branch was pre-selected, show branch selection
          if (!selectedBranchId) {
            setShowBranchModal(true);
          } else {
            // Find the index of the selected branch
            const branchIndex = branchesData.findIndex(branch => branch._id === selectedBranchId);
            setSelectedBranchIndex(branchIndex >= 0 ? branchIndex : 0);
          }
        } else {
          console.log("⚠️ No branches found");
          setBranches([]);
        }
      } else {
        console.log("⚠️ Failed to fetch branches");
        setBranches([]);
      }
    } catch (error) {
      console.error("❌ Error fetching branches:", error);
      setBranches([]);
    }
  };

  const refreshTables = async () => {
    if (!selectedBranchId) {
      console.log("⚠️ No branch selected, cannot fetch tables");
      return;
    }

    try {
      setLoading(true);
      
      // Fetch tables for the selected branch from admin panel backend
      const response = await fetch(`https://hotelvirat.com/api/v1/hotel/table?branchId=${selectedBranchId}`);
      
      const data = await response.json();
      
      if (response.ok && data) {
        const tablesArray = Array.isArray(data) ? data : [];
        setTables(tablesArray);
        console.log('✅ Tables fetched for branch:', selectedBranchId, tablesArray);
      } else {
        console.log('⚠️ No tables found for branch:', selectedBranchId);
        setTables([]);
      }
    } catch (error) {
      console.error('❌ Error refreshing tables:', error);
      Alert.alert('Error', 'Failed to refresh table data');
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (table) => {
    console.log('🏢 Selected table:', table);
    console.log('📅 Current booking date:', bookingDetails.bookingDate);
    
    // Don't check table.status here since tables can be available for different time slots
    // The time slot availability will be checked when user selects a time
    setSelectedTable(table);
    setShowBookingModal(true);
    
    // Initialize selected date with current booking date
    setSelectedDate(new Date(bookingDetails.bookingDate));
    
    // Fetch unavailable slots for this table and date
    fetchUnavailableSlots(table._id, bookingDetails.bookingDate);
  };

  const fetchUnavailableSlots = async (tableId, date) => {
    try {
      console.log('🔍 Fetching unavailable slots for:', { tableId, date });
      
      // Create multiple date format variations to try
      const dateObj = new Date(date);
      const dateFormats = [
        date, // Original format (YYYY-MM-DD)
        dateObj.toISOString().split('T')[0], // YYYY-MM-DD
        dateObj.toLocaleDateString('en-US'), // MM/DD/YYYY
        dateObj.toLocaleDateString('en-GB'), // DD/MM/YYYY
        dateObj.toISOString(), // Full ISO string
        `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}` // Manual YYYY-MM-DD
      ];
      
      console.log('📅 Trying multiple date formats:', dateFormats);
      
      let reservations = [];
      let apiWorked = false;
      
      // Try each date format until one works
      for (const dateFormat of dateFormats) {
        try {
          const response = await fetch(
            `https://hotelvirat.com/api/v1/hotel/reservation?tableId=${tableId}&date=${dateFormat}`
          );
          
          console.log(`📡 API call with date "${dateFormat}": ${response.status}`);
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              reservations = data;
              apiWorked = true;
              console.log(`✅ Success with date format: "${dateFormat}"`);
              break;
            } else {
              console.log(`📋 No reservations found with date format: "${dateFormat}"`);
            }
          }
        } catch (err) {
          console.log(`❌ Error with date format "${dateFormat}":`, err.message);
        }
      }
      
      // If date-specific queries didn't work, try getting all reservations and filter manually
      if (!apiWorked) {
        console.log('🔄 Trying to fetch all reservations and filter manually...');
        try {
          const allResponse = await fetch(
            `https://hotelvirat.com/api/v1/hotel/reservation?tableId=${tableId}`
          );
          
          if (allResponse.ok) {
            const allReservations = await allResponse.json();
            console.log('📋 All reservations for table:', allReservations);
            
            // Filter reservations manually by date
            const targetDate = new Date(date);
            reservations = allReservations.filter(reservation => {
              const reservationDate = new Date(reservation.reservationDate);
              const isSameDate = 
                reservationDate.getFullYear() === targetDate.getFullYear() &&
                reservationDate.getMonth() === targetDate.getMonth() &&
                reservationDate.getDate() === targetDate.getDate();
              
              console.log(`📅 Comparing dates:`, {
                target: targetDate.toDateString(),
                reservation: reservationDate.toDateString(),
                match: isSameDate,
                reservationId: reservation._id
              });
              
              return isSameDate;
            });
            
            console.log(`✅ Manual filtering found ${reservations.length} reservations for the date`);
          }
        } catch (err) {
          console.error('❌ Error fetching all reservations:', err);
        }
      }
      
      // If still no reservations, try without tableId filter (get all reservations and filter manually)
      if (reservations.length === 0) {
        console.log('🔄 Trying to fetch ALL reservations and filter by table + date...');
        try {
          const allResponse = await fetch(`https://hotelvirat.com/api/v1/hotel/reservation`);
          
          if (allResponse.ok) {
            const allReservations = await allResponse.json();
            console.log(`📋 Total reservations in system: ${allReservations.length}`);
            
            // Filter by table and date manually
            const targetDate = new Date(date);
            reservations = allReservations.filter(reservation => {
              // Check table match
              const tableMatch = 
                reservation.tableId === tableId ||
                (reservation.tableId && reservation.tableId._id === tableId) ||
                (reservation.tableId && reservation.tableId.toString() === tableId);
              
              // Check date match
              const reservationDate = new Date(reservation.reservationDate);
              const dateMatch = 
                reservationDate.getFullYear() === targetDate.getFullYear() &&
                reservationDate.getMonth() === targetDate.getMonth() &&
                reservationDate.getDate() === targetDate.getDate();
              
              console.log(`🔍 Reservation ${reservation._id}:`, {
                tableId: reservation.tableId,
                tableMatch,
                reservationDate: reservationDate.toDateString(),
                dateMatch,
                status: reservation.status,
                timeSlot: reservation.timeSlot
              });
              
              return tableMatch && dateMatch;
            });
            
            console.log(`✅ Manual table+date filtering found ${reservations.length} reservations`);
          }
        } catch (err) {
          console.error('❌ Error fetching all reservations:', err);
        }
      }
      
      console.log('📋 Final reservations found:', reservations);
      
      // Process the reservations to get unavailable slots
      const unavailable = reservations
        .filter(reservation => {
          const isNotCancelled = reservation.status !== 'cancelled';
          console.log(`📅 Processing reservation ${reservation._id}:`, {
            status: reservation.status,
            timeSlot: reservation.timeSlot,
            included: isNotCancelled
          });
          return isNotCancelled;
        })
        .map(reservation => {
          // Comprehensive time slot normalization
          let normalizedSlot = reservation.timeSlot;
          
          if (normalizedSlot) {
            // Remove extra whitespace
            normalizedSlot = normalizedSlot.trim();
            
            // Handle various format variations
            normalizedSlot = normalizedSlot
              // Add space before AM/PM if missing
              .replace(/(\d)(AM|PM)/gi, '$1 $2')
              // Normalize AM/PM case
              .replace(/am/gi, 'AM')
              .replace(/pm/gi, 'PM')
              // Normalize dash spacing
              .replace(/\s*[-–—]\s*/g, ' - ')
              // Remove extra spaces
              .replace(/\s+/g, ' ')
              // Handle 12-hour format variations
              .replace(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/gi, 
                (match, h1, m1, ap1, h2, m2, ap2) => {
                  // Ensure consistent format: "HH:MM AM - HH:MM PM"
                  const time1 = `${h1.padStart(2, '0')}:${m1} ${ap1.toUpperCase()}`;
                  const time2 = `${h2.padStart(2, '0')}:${m2} ${ap2.toUpperCase()}`;
                  return `${time1} - ${time2}`;
                });
          }
          
          console.log(`🔄 Time slot normalization:`, {
            original: reservation.timeSlot,
            normalized: normalizedSlot
          });
          
          return normalizedSlot;
        })
        .filter(slot => slot); // Remove any null/undefined slots
      
      console.log('🚫 Final unavailable slots:', unavailable);
      console.log('📋 Available time slots for comparison:', timeSlots.map(slot => slot.value));
      
      // Enhanced matching with fuzzy logic
      const matchedSlots = [];
      unavailable.forEach(unavailableSlot => {
        // Exact match first
        let match = timeSlots.find(slot => slot.value === unavailableSlot);
        
        if (match) {
          console.log(`🔍 Exact match found: "${unavailableSlot}" ✅`);
          matchedSlots.push(unavailableSlot);
        } else {
          // Try fuzzy matching
          const fuzzyMatch = timeSlots.find(slot => {
            const slotNormalized = slot.value.toLowerCase().replace(/\s/g, '');
            const unavailableNormalized = unavailableSlot.toLowerCase().replace(/\s/g, '');
            return slotNormalized === unavailableNormalized;
          });
          
          if (fuzzyMatch) {
            console.log(`🔍 Fuzzy match found: "${unavailableSlot}" → "${fuzzyMatch.value}" ✅`);
            matchedSlots.push(fuzzyMatch.value); // Use the correct format
          } else {
            console.log(`🔍 No match found for: "${unavailableSlot}" ❌`);
            
            // Show potential close matches for debugging
            const closeMatches = timeSlots.filter(slot => {
              const slotLower = slot.value.toLowerCase();
              const unavailableLower = unavailableSlot.toLowerCase();
              return slotLower.includes(unavailableLower.substring(0, 5)) || 
                     unavailableLower.includes(slotLower.substring(0, 5));
            });
            
            if (closeMatches.length > 0) {
              console.log(`🔍 Close matches:`, closeMatches.map(m => m.value));
            }
          }
        }
      });
      
      console.log('✅ Final matched unavailable slots:', matchedSlots);
      setUnavailableSlots(matchedSlots);
      
    } catch (error) {
      console.error('❌ Error fetching unavailable slots:', error);
      setUnavailableSlots([]);
    }
  };

  // Update unavailable slots when date changes
  const handleDateChange = (newDate) => {
    setBookingDetails({...bookingDetails, bookingDate: newDate, timeSlot: ''});
    if (selectedTable) {
      fetchUnavailableSlots(selectedTable._id, newDate);
    }
  };

  // Handle date picker change
  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false); // Always close on Android
    
    if (event.type === 'dismissed') {
      return; // User cancelled the picker
    }
    
    const currentDate = selectedDate || new Date();
    
    // Don't allow dates in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (currentDate < today) {
      Alert.alert('Invalid Date', 'Please select today or a future date for your reservation.');
      return;
    }
    
    setSelectedDate(currentDate);
    
    // Format date for booking
    const formattedDate = currentDate.toISOString().split('T')[0];
    handleDateChange(formattedDate);
  };

  // Show date picker
  const showDatePickerModal = () => {
    setShowDatePicker(true);
  };

  // Get minimum date (today)
  const getMinimumDate = () => {
    return new Date();
  };

  // Get maximum date (3 months from now)
  const getMaximumDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate;
  };

  const handleBookTable = async () => {
    if (!selectedTable) {
      Alert.alert('Error', 'Please select a table first');
      return;
    }

    if (!selectedBranchId) {
      Alert.alert('Error', 'Please select a branch first');
      return;
    }

    if (!bookingDetails.customerName.trim() || !bookingDetails.phoneNumber.trim() || !bookingDetails.timeSlot) {
      Alert.alert('Error', 'Please fill in all required fields including time slot');
      return;
    }

    try {
      setLoading(true);
      
      // Check if the time slot is already booked for this table on the selected date
      const checkResponse = await fetch(
        `https://hotelvirat.com/api/v1/hotel/reservation?tableId=${selectedTable._id}&date=${bookingDetails.bookingDate}`
      );
      
      if (checkResponse.ok) {
        const existingReservations = await checkResponse.json();
        const conflictingReservation = existingReservations.find(
          reservation => 
            reservation.timeSlot === bookingDetails.timeSlot && 
            reservation.status !== 'cancelled'
        );
        
        if (conflictingReservation) {
          Alert.alert(
            'Time Slot Unavailable',
            `This time slot (${bookingDetails.timeSlot}) is already booked for Table ${selectedTable.number} on ${bookingDetails.bookingDate}. Please select a different time slot.`,
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }
      }

      // Try different booking data structures based on what the backend expects
      let bookingData = {
        tableId: selectedTable._id,
        branchId: selectedBranchId, // Include branch ID
        customerName: bookingDetails.customerName.trim(),
        customerPhone: bookingDetails.phoneNumber.trim(),
        guestCount: parseInt(bookingDetails.numberOfGuests),
        reservationDate: bookingDetails.bookingDate,
        timeSlot: bookingDetails.timeSlot,
        status: 'confirmed',
        notes: bookingDetails.specialRequests.trim()
      };

      // Add optional fields
      if (userId) {
        bookingData.customerId = userId;
      }
      
      if (bookingDetails.customerName.trim()) {
        bookingData.customerEmail = ''; // Empty email as optional
      }

      console.log('📋 Sending booking data:', bookingData);
      console.log('📋 Backend URL:', 'https://hotelvirat.com/api/v1/hotel/reservation');
      console.log('📋 Request headers:', {
        'Content-Type': 'application/json',
      });

      // Create table reservation using the admin panel reservation endpoint
      let response = await fetch('https://hotelvirat.com/api/v1/hotel/reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      let result = await response.json();

      console.log('📋 Booking API Response:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        result: result
      });

      // If customer not found, try multiple fallback approaches
      if (!response.ok && response.status === 404 && (
        result.message?.toLowerCase().includes('customer') || 
        result.error?.toLowerCase().includes('customer') ||
        result.message?.toLowerCase().includes('not found') ||
        result.error?.toLowerCase().includes('not found')
      )) {
        console.log('🔄 Customer not found error detected. Trying fallback approaches...');
        console.log('🔄 Original error:', result);
        
        // First retry: Remove customerId and customerEmail
        const { customerId, customerEmail, ...bookingDataWithoutCustomer } = bookingData;
        
        console.log('🔄 Retry 1: Booking without customer fields:', bookingDataWithoutCustomer);
        
        response = await fetch('https://hotelvirat.com/api/v1/hotel/reservation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bookingDataWithoutCustomer),
        });

        result = await response.json();
        
        console.log('📋 Retry 1 API Response:', {
          status: response.status,
          ok: response.ok,
          result: result
        });

        // Second retry: Use minimal required data only
        if (!response.ok) {
          console.log('🔄 Retry 2: Using minimal required data...');
          
          const minimalBookingData = {
            tableId: selectedTable._id,
            branchId: selectedBranchId, // Include branch ID
            customerName: bookingDetails.customerName.trim(),
            customerPhone: bookingDetails.phoneNumber.trim(),
            guestCount: parseInt(bookingDetails.numberOfGuests),
            reservationDate: bookingDetails.bookingDate,
            timeSlot: bookingDetails.timeSlot,
            status: 'confirmed'
          };
          
          console.log('🔄 Minimal booking data:', minimalBookingData);
          
          response = await fetch('https://hotelvirat.com/api/v1/hotel/reservation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(minimalBookingData),
          });

          result = await response.json();
          
          console.log('📋 Retry 2 API Response:', {
            status: response.status,
            ok: response.ok,
            result: result
          });

          // Third retry: Try alternative field names that backend might expect
          if (!response.ok) {
            console.log('🔄 Retry 3: Using alternative field names...');
            
            const alternativeBookingData = {
              tableId: selectedTable._id,
              branchId: selectedBranchId, // Include branch ID
              name: bookingDetails.customerName.trim(),
              phone: bookingDetails.phoneNumber.trim(),
              guests: parseInt(bookingDetails.numberOfGuests),
              date: bookingDetails.bookingDate,
              time: bookingDetails.timeSlot,
              status: 'confirmed',
              notes: bookingDetails.specialRequests.trim() || ''
            };
            
            console.log('🔄 Alternative field names data:', alternativeBookingData);
            
            response = await fetch('https://hotelvirat.com/api/v1/hotel/reservation', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(alternativeBookingData),
            });

            result = await response.json();
            
            console.log('📋 Retry 3 API Response:', {
              status: response.status,
              ok: response.ok,
              result: result
            });

            // Fourth retry: Try to create customer first, then book
            if (!response.ok) {
              console.log('🔄 Retry 4: Attempting to create customer first...');
              
              try {
                // Try to create customer first
                const customerData = {
                  name: bookingDetails.customerName.trim(),
                  phone: bookingDetails.phoneNumber.trim(),
                  email: '', // Empty email
                };
                
                console.log('👤 Creating customer:', customerData);
                
                const customerResponse = await fetch('https://hotelvirat.com/api/v1/hotel/customer', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(customerData),
                });
                
                if (customerResponse.ok) {
                  const customerResult = await customerResponse.json();
                  console.log('✅ Customer created:', customerResult);
                  
                  // Now try booking with the new customer ID
                  const bookingWithNewCustomer = {
                    ...bookingData,
                    customerId: customerResult._id || customerResult.id,
                    branchId: selectedBranchId // Ensure branch ID is included
                  };
                  
                  console.log('🔄 Booking with new customer ID:', bookingWithNewCustomer);
                  
                  response = await fetch('https://hotelvirat.com/api/v1/hotel/reservation', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(bookingWithNewCustomer),
                  });

                  result = await response.json();
                  
                  console.log('📋 Retry 4 API Response:', {
                    status: response.status,
                    ok: response.ok,
                    result: result
                  });
                } else {
                  console.log('❌ Customer creation failed:', await customerResponse.text());
                }
              } catch (customerError) {
                console.log('❌ Customer creation error:', customerError);
              }
            }
          }
        }
      }

      if (response.ok) {
        const selectedBranchName = selectedBranchIndex !== null && branches[selectedBranchIndex] ? 
          branches[selectedBranchIndex].name : 'Selected Branch';
        
        Alert.alert(
          'Booking Confirmed!',
          `Your table ${selectedTable.number} has been reserved at ${selectedBranchName} for ${bookingDetails.bookingDate} at ${bookingDetails.timeSlot}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowBookingModal(false);
                setSelectedTable(null);
                // Reset form
                setBookingDetails({
                  customerName: '',
                  phoneNumber: '',
                  numberOfGuests: '2',
                  bookingDate: new Date().toISOString().split('T')[0],
                  timeSlot: '',
                  specialRequests: ''
                });
                refreshTables();
              }
            }
          ]
        );
      } else {
        console.error('❌ Booking failed:', result);
        Alert.alert('Booking Failed', result.message || result.error || 'Failed to book table');
      }
    } catch (error) {
      console.error('Error booking table:', error);
      Alert.alert('Error', 'Failed to book table. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTableStatusColor = (status) => {
    switch (status) {
      case 'available':
        return '#28a745';
      case 'occupied':
        return '#dc3545';
      case 'reserved':
        return '#ffc107';
      case 'maintenance':
        return '#6c757d';
      default:
        return '#28a745';
    }
  };

  const getTableStatusText = (status) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'occupied':
        return 'Occupied';
      case 'reserved':
        return 'Reserved';
      case 'maintenance':
        return 'Maintenance';
      default:
        return 'Available';
    }
  };

  const renderTableItem = ({ item }) => {
    // Tables are always selectable - availability is determined by time slots
    const isSelectable = true;
    
    return (
      <TouchableOpacity
        style={[
          styles.tableCard,
          colorScheme === 'dark' ? styles.tableCardDark : styles.tableCardLight
        ]}
        onPress={() => handleTableSelect(item)}
      >
        <View style={styles.tableHeader}>
          <View style={styles.tableNumberContainer}>
            <Icon name="table-restaurant" size={24} color="#800000" />
            <Text style={[styles.tableNumber, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              Table {item.number}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: '#28a745' }]}>
            <Text style={styles.statusText}>Available</Text>
          </View>
        </View>
        
        <View style={styles.tableDetails}>
          <View style={styles.tableInfo}>
            <Icon name="people" size={16} color="#666" />
            <Text style={[styles.capacityText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              Capacity: {item.capacity || 4} people
            </Text>
          </View>
          
          {item.location && (
            <View style={styles.tableInfo}>
              <Icon name="location-on" size={16} color="#666" />
              <Text style={[styles.locationText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                {item.location}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.bookButton}>
          <Text style={styles.bookButtonText}>Tap to Book</Text>
          <Icon name="arrow-forward" size={16} color="#800000" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar backgroundColor={colorScheme === 'dark' ? '#1a1a1a' : '#fff'} barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Icon name="arrow-back" size={24} color="#800000" />
        </TouchableOpacity>
        <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Book a Table</Text>
        <TouchableOpacity onPress={refreshTables} style={styles.headerIcon}>
          <Icon name="refresh" size={24} color="#800000" />
        </TouchableOpacity>
      </View>

      {/* Branch Selection */}
      {branches.length > 0 && (
        <TouchableOpacity 
          style={[styles.branchSelector, colorScheme === 'dark' ? styles.branchSelectorDark : styles.branchSelectorLight]}
          onPress={() => setShowBranchModal(true)}
        >
          <View style={styles.branchSelectorLeft}>
            <Icon name="location-on" size={20} color="#800000" />
            <View style={styles.branchTextContainer}>
              <Text style={[styles.branchSelectorLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                Selected Branch
              </Text>
              <Text style={[styles.branchName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                {selectedBranchIndex !== null && branches[selectedBranchIndex] ? 
                  branches[selectedBranchIndex].name : 
                  'Select Branch'
                }
              </Text>
              {selectedBranchIndex !== null && branches[selectedBranchIndex]?.address && (
                <Text style={[styles.branchAddress, colorScheme === 'dark' ? styles.textDark : styles.textLight]} numberOfLines={1}>
                  {branches[selectedBranchIndex].address}
                </Text>
              )}
            </View>
          </View>
          <Icon name="arrow-drop-down" size={24} color="#800000" />
        </TouchableOpacity>
      )}

      {/* Info Banner */}
      <View style={[styles.infoBanner, colorScheme === 'dark' ? styles.infoBannerDark : styles.infoBannerLight]}>
        <Icon name="info" size={20} color="#800000" />
        <Text style={[styles.infoBannerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
          {selectedBranchId ? 
            'All tables are available. Select a table to see available time slots.' :
            'Please select a branch first to view available tables.'
          }
        </Text>
      </View>

      {/* Stats */}
      <View style={[styles.statsContainer, colorScheme === 'dark' ? styles.statsContainerDark : styles.statsContainerLight]}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{tables.length}</Text>
          <Text style={[styles.statLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Total Tables</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#28a745' }]}>
            {tables.length}
          </Text>
          <Text style={[styles.statLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Available</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#ffc107' }]}>
            {unavailableSlots.length}
          </Text>
          <Text style={[styles.statLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Booked Slots</Text>
        </View>
      </View>

      {/* Tables List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#800000" />
          <Text style={[styles.loadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            Loading tables...
          </Text>
        </View>
      ) : (
        <FlatList
          data={tables}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderTableItem}
          contentContainerStyle={styles.tablesList}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.tableRow}
        />
      )}

      {/* Booking Modal */}
      <Modal
        visible={showBookingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, colorScheme === 'dark' ? styles.modalContainerDark : styles.modalContainerLight]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                  Book Table {selectedTable?.number}
                </Text>
                <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                  <Icon name="close" size={24} color="#800000" />
                </TouchableOpacity>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Customer Name *</Text>
                  <TextInput
                    style={[styles.textInput, colorScheme === 'dark' ? styles.textInputDark : styles.textInputLight]}
                    value={bookingDetails.customerName}
                    onChangeText={(text) => setBookingDetails({...bookingDetails, customerName: text})}
                    placeholder="Enter your name"
                    placeholderTextColor={colorScheme === 'dark' ? '#888' : '#999'}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Phone Number *</Text>
                  <TextInput
                    style={[styles.textInput, colorScheme === 'dark' ? styles.textInputDark : styles.textInputLight]}
                    value={bookingDetails.phoneNumber}
                    onChangeText={(text) => setBookingDetails({...bookingDetails, phoneNumber: text})}
                    placeholder="Enter phone number"
                    placeholderTextColor={colorScheme === 'dark' ? '#888' : '#999'}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Number of Guests</Text>
                  <TextInput
                    style={[styles.textInput, colorScheme === 'dark' ? styles.textInputDark : styles.textInputLight]}
                    value={bookingDetails.numberOfGuests}
                    onChangeText={(text) => setBookingDetails({...bookingDetails, numberOfGuests: text})}
                    placeholder="Number of guests"
                    placeholderTextColor={colorScheme === 'dark' ? '#888' : '#999'}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Booking Date *</Text>
                  <TouchableOpacity
                    style={[styles.datePickerButton, colorScheme === 'dark' ? styles.textInputDark : styles.textInputLight]}
                    onPress={showDatePickerModal}
                  >
                    <View style={styles.datePickerContent}>
                      <Icon name="calendar-today" size={20} color="#800000" />
                      <Text style={[styles.datePickerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                        {new Date(bookingDetails.bookingDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Text>
                      <Icon name="arrow-drop-down" size={20} color="#800000" />
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.helperText, { color: '#666' }]}>
                    Select a date (today to 3 months ahead)
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Time Slot *</Text>
                  <Text style={[styles.instructionText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                    Scroll horizontally to see all time slots. Red slots are already booked.
                  </Text>
                  <View style={[styles.pickerContainer, colorScheme === 'dark' ? styles.textInputDark : styles.textInputLight]}>
                    <ScrollView 
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.timeSlotContainer}
                      style={styles.timeSlotScrollView}
                    >
                      {timeSlots.map((slot, index) => {
                        const isUnavailable = unavailableSlots.includes(slot.value);
                        const isSelected = bookingDetails.timeSlot === slot.value;
                        
                        // Debug logging for the first few slots
                        if (index < 3) {
                          console.log(`🎯 Slot ${index}: "${slot.value}" - unavailable: ${isUnavailable}, selected: ${isSelected}`);
                          console.log(`🎯 Checking against unavailable slots:`, unavailableSlots);
                        }
                        
                        return (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.timeSlotButton,
                              // Apply base theme style first
                              !isSelected && !isUnavailable && (colorScheme === 'dark' ? styles.timeSlotButtonDark : styles.timeSlotButtonLight),
                              // Apply unavailable style if needed
                              isUnavailable && !isSelected && styles.unavailableTimeSlot,
                              // Apply selected style last to ensure it overrides everything
                              isSelected && styles.selectedTimeSlot,
                            ]}
                            onPress={() => {
                              if (!isUnavailable) {
                                setBookingDetails({...bookingDetails, timeSlot: slot.value});
                              }
                            }}
                            disabled={isUnavailable}
                          >
                            <Text style={[
                              styles.timeSlotText,
                              isSelected && styles.selectedTimeSlotText,
                              isUnavailable && styles.unavailableTimeSlotText,
                              colorScheme === 'dark' && !isSelected && !isUnavailable && styles.timeSlotTextDark
                            ]}>
                              {slot.label}
                            </Text>
                            {isUnavailable && (
                              <Text style={styles.unavailableLabel}>Booked</Text>
                            )}
                            {isSelected && (
                              <Icon name="check-circle" size={16} color="#fff" style={{ marginTop: 2 }} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                  {!bookingDetails.timeSlot && (
                    <Text style={styles.helperText}>Please select an available time slot</Text>
                  )}
                  {bookingDetails.timeSlot && (
                    <Text style={[styles.selectedSlotText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                      ✓ Selected: {bookingDetails.timeSlot}
                    </Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Special Requests</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea, colorScheme === 'dark' ? styles.textInputDark : styles.textInputLight]}
                    value={bookingDetails.specialRequests}
                    onChangeText={(text) => setBookingDetails({...bookingDetails, specialRequests: text})}
                    placeholder="Any special requests or dietary requirements"
                    placeholderTextColor={colorScheme === 'dark' ? '#888' : '#999'}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, colorScheme === 'dark' ? styles.cancelButtonDark : styles.cancelButtonLight]}
                  onPress={() => setShowBookingModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bookConfirmButton, loading && styles.bookConfirmButtonDisabled]}
                  onPress={handleBookTable}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.bookConfirmButtonText}>Confirm Booking</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Branch Selection Modal */}
      <Modal
        visible={showBranchModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (selectedBranchId) {
            setShowBranchModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, colorScheme === 'dark' ? styles.modalContainerDark : styles.modalContainerLight]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                Select Branch
              </Text>
              {selectedBranchId && (
                <TouchableOpacity onPress={() => setShowBranchModal(false)}>
                  <Icon name="close" size={24} color="#800000" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {branches.map((branch, index) => (
                <TouchableOpacity
                  key={branch._id}
                  style={[
                    styles.branchItem,
                    selectedBranchIndex === index && (colorScheme === 'dark' ? styles.selectedBranchItemDark : styles.selectedBranchItem)
                  ]}
                  onPress={() => {
                    setSelectedBranchIndex(index);
                    setSelectedBranchId(branch._id);
                    setShowBranchModal(false);
                    console.log('🏢 Branch selected:', branch.name, branch._id);
                  }}
                >
                  <View style={styles.branchItemLeft}>
                    <Icon 
                      name="location-on" 
                      size={20} 
                      color={selectedBranchIndex === index ? "#800000" : (colorScheme === 'dark' ? "#888" : "#6b7280")} 
                    />
                  </View>
                  <View style={styles.branchItemDetails}>
                    <Text style={[
                      styles.branchItemName, 
                      colorScheme === 'dark' ? styles.textDark : styles.textLight,
                      selectedBranchIndex === index && styles.selectedBranchText
                    ]}>
                      {branch.name}
                    </Text>
                    <Text style={[styles.branchItemAddress, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                      {branch.address}
                    </Text>
                  </View>
                  {selectedBranchIndex === index && <Icon name="check" size={20} color="#800000" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker - Android Only */}
      {showDatePicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={selectedDate}
          mode="date"
          is24Hour={true}
          display="default"
          onChange={onDateChange}
          minimumDate={getMinimumDate()}
          maximumDate={getMaximumDate()}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  textLight: {
    color: '#333',
  },
  textDark: {
    color: '#e5e5e5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  headerLight: {
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
  },
  headerDark: {
    backgroundColor: '#2a2a2a',
    borderBottomColor: '#444',
  },
  headerText: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerIcon: {
    width: 40,
    alignItems: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoBannerLight: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  infoBannerDark: {
    backgroundColor: '#3a2a1a',
    borderColor: '#92400e',
  },
  infoBannerText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 15,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 12,
  },
  statsContainerLight: {
    backgroundColor: '#fff',
  },
  statsContainerDark: {
    backgroundColor: '#2a2a2a',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#800000',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#ddd',
    marginHorizontal: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  tablesList: {
    padding: 15,
  },
  tableRow: {
    justifyContent: 'space-between',
  },
  tableCard: {
    flex: 0.48,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
  },
  tableCardLight: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  tableCardDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#444',
  },
  tableCardDisabled: {
    opacity: 0.6,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tableNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tableDetails: {
    marginBottom: 10,
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  capacityText: {
    fontSize: 14,
    marginLeft: 8,
  },
  locationText: {
    fontSize: 14,
    marginLeft: 8,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  bookButtonText: {
    color: '#800000',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 15,
    padding: 20,
  },
  modalContainerLight: {
    backgroundColor: '#fff',
  },
  modalContainerDark: {
    backgroundColor: '#2a2a2a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textInputLight: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    color: '#333',
  },
  textInputDark: {
    backgroundColor: '#3a3a3a',
    borderColor: '#555',
    color: '#e5e5e5',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 0.45,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonLight: {
    backgroundColor: '#fff',
    borderColor: '#800000',
  },
  cancelButtonDark: {
    backgroundColor: '#3a3a3a',
    borderColor: '#800000',
  },
  cancelButtonText: {
    color: '#800000',
    fontSize: 16,
    fontWeight: '600',
  },
  bookConfirmButton: {
    flex: 0.45,
    backgroundColor: '#800000',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookConfirmButtonDisabled: {
    opacity: 0.6,
  },
  bookConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    height: 80,
  },
  timeSlotScrollView: {
    height: 60,
  },
  timeSlotContainer: {
    paddingHorizontal: 8,
    alignItems: 'center',
    paddingRight: 20, // Extra padding at the end to show there's more content
  },
  timeSlotButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    height: 50,
  },
  timeSlotButtonLight: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e5e7eb',
  },
  timeSlotButtonDark: {
    backgroundColor: '#4a4a4a',
    borderColor: '#666',
  },
  selectedTimeSlot: {
    backgroundColor: '#800000',
    borderColor: '#800000',
    shadowColor: '#800000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ scale: 1.05 }], // Slightly larger when selected
  },
  unavailableTimeSlot: {
    backgroundColor: '#f5f5f5',
    borderColor: '#d6d6d6',
    opacity: 0.6,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  timeSlotTextDark: {
    color: '#e5e5e5',
  },
  selectedTimeSlotText: {
    color: '#fff',
    fontWeight: '600',
  },
  unavailableTimeSlotText: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  unavailableLabel: {
    fontSize: 10,
    color: '#dc3545',
    fontWeight: 'bold',
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 4,
    fontStyle: 'italic',
  },
  selectedSlotText: {
    fontSize: 12,
    color: '#28a745',
    marginTop: 4,
    fontWeight: '600',
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 15,
    marginBottom: 8,
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerText: {
    fontSize: 16,
    flex: 1,
    marginLeft: 12,
  },
  branchSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 15,
    marginTop: 10,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  branchSelectorLight: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  branchSelectorDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#444',
  },
  branchSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  branchTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  branchSelectorLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '600',
  },
  branchAddress: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.8,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  selectedBranchItem: {
    backgroundColor: '#fff7ed',
  },
  selectedBranchItemDark: {
    backgroundColor: '#3a3a3a',
  },
  branchItemLeft: {
    marginRight: 16,
  },
  branchItemDetails: {
    flex: 1,
  },
  branchItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedBranchText: {
    color: '#800000',
  },
  branchItemAddress: {
    fontSize: 13,
    opacity: 0.8,
  },
});

export default TableBooking;