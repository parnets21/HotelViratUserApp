import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [tableReservations, setTableReservations] = useState({}); // Store reservations by tableId
  const [bookingDetails, setBookingDetails] = useState({
    customerName: '',
    phoneNumber: '',
    numberOfGuests: '2',
    bookingDate: new Date().toISOString().split('T')[0],
    timeSlot: '', // Empty by default to force selection
    specialRequests: ''
  });

  // Define available time slots - with leading zeros to match admin format
  const timeSlots = [
    { value: '09:00 AM - 10:00 AM', label: '09:00 AM - 10:00 AM' },
    { value: '10:00 AM - 11:00 AM', label: '10:00 AM - 11:00 AM' },
    { value: '11:00 AM - 12:00 PM', label: '11:00 AM - 12:00 PM' },
    { value: '12:00 PM - 01:00 PM', label: '12:00 PM - 01:00 PM' },
    { value: '01:00 PM - 02:00 PM', label: '01:00 PM - 02:00 PM' },
    { value: '02:00 PM - 03:00 PM', label: '02:00 PM - 03:00 PM' },
    { value: '03:00 PM - 04:00 PM', label: '03:00 PM - 04:00 PM' },
    { value: '04:00 PM - 05:00 PM', label: '04:00 PM - 05:00 PM' },
    { value: '05:00 PM - 06:00 PM', label: '05:00 PM - 06:00 PM' },
    { value: '06:00 PM - 07:00 PM', label: '06:00 PM - 07:00 PM' },
    { value: '07:00 PM - 08:00 PM', label: '07:00 PM - 08:00 PM' },
    { value: '08:00 PM - 09:00 PM', label: '08:00 PM - 09:00 PM' },
    { value: '09:00 PM - 10:00 PM', label: '09:00 PM - 10:00 PM' },
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

  const fetchBranches = useCallback(async () => {
    try {
      console.log("🌐 Fetching branches for table booking...");
      
      const response = await fetch('http://192.168.1.27:9000/api/v1/hotel/branch');
      
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
  }, [selectedBranchId]);

  const refreshTables = useCallback(async () => {
    if (!selectedBranchId) {
      console.log("⚠️ No branch selected, cannot fetch tables");
      return;
    }

    try {
      setLoading(true);
      
      // Fetch tables and all reservations for today in parallel
      const [tablesResponse, reservationsResponse] = await Promise.all([
        fetch(`http://192.168.1.27:9000/api/v1/hotel/table?branchId=${selectedBranchId}`),
        fetch(`http://192.168.1.27:9000/api/v1/hotel/reservation?date=${bookingDetails.bookingDate}&limit=1000`)
      ]);
      
      const tablesData = await tablesResponse.json();
      const reservationsData = await reservationsResponse.json();
      
      if (tablesResponse.ok && tablesData) {
        const tablesArray = Array.isArray(tablesData) ? tablesData : [];
        setTables(tablesArray);
        console.log('✅ Tables fetched for branch:', selectedBranchId, tablesArray.length);
        
        // Process reservations data
        if (reservationsResponse.ok) {
          const reservations = reservationsData.data || reservationsData || [];
          
          // Group reservations by tableId
          const reservationsByTable = {};
          reservations.forEach(res => {
            if (res.status !== 'cancelled' && res.tableId) {
              const tableId = typeof res.tableId === 'object' ? res.tableId._id : res.tableId;
              if (!reservationsByTable[tableId]) {
                reservationsByTable[tableId] = [];
              }
              reservationsByTable[tableId].push(res);
            }
          });
          
          setTableReservations(reservationsByTable);
          console.log('✅ Reservations grouped by table:', Object.keys(reservationsByTable).length);
        }
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
  }, [selectedBranchId, bookingDetails.bookingDate]);

  const handleTableSelect = (table) => {
    console.log('🏢 Selected table:', table);
    console.log('� Current booking date:', bookingDetails.bookingDate);
    
    // Don't check table.status here since tables can be available for different time slots
    // The time slot availability will be checked when user selects a time
    setSelectedTable(table);
    setShowBookingModal(true);
    
    // Initialize selected date with current booking date
    setSelectedDate(new Date(bookingDetails.bookingDate));
    
    // Fetch unavailable slots for this table and date
    fetchUnavailableSlots(table._id, bookingDetails.bookingDate);
  };

  const fetchUnavailableSlots = useCallback(async (tableId, date) => {
      try {
        console.log('🔍 Fetching unavailable slots for:', { tableId, date });

        const response = await fetch(
          `http://192.168.1.27:9000/api/v1/hotel/reservation?tableId=${tableId}&date=${date}&limit=1000`
        );

        if (!response.ok) {
          setUnavailableSlots([]);
          return;
        }

        const data = await response.json();

        // Handle both paginated and non-paginated responses
        let reservations = [];
        if (data.success && Array.isArray(data.data)) {
          reservations = data.data;
        } else if (Array.isArray(data)) {
          reservations = data;
        } else {
          setUnavailableSlots([]);
          return;
        }

        // Extract time slots from non-cancelled reservations
        const bookedSlots = reservations
          .filter(reservation => reservation.status !== 'cancelled')
          .map(reservation => reservation.timeSlot)
          .filter(slot => slot);

        setUnavailableSlots(bookedSlots);

      } catch (error) {
        console.error('❌ Error fetching unavailable slots:', error);
        setUnavailableSlots([]);
      }
    }, [])

  // Update unavailable slots when date changes
  const handleDateChange = useCallback((newDate) => {
    setBookingDetails(prev => ({...prev, bookingDate: newDate, timeSlot: ''}));
    if (selectedTable) {
      fetchUnavailableSlots(selectedTable._id, newDate);
    }
  }, [selectedTable, fetchUnavailableSlots]);

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
        `http://192.168.1.27:9000/api/v1/hotel/reservation?tableId=${selectedTable._id}&date=${bookingDetails.bookingDate}`
      );
      
      if (checkResponse.ok) {
        const responseData = await checkResponse.json();
        const existingReservations = responseData.data || [];
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
      console.log('📋 Backend URL:', 'http://192.168.1.27:9000/api/v1/hotel/reservation');
      console.log('📋 Request headers:', {
        'Content-Type': 'application/json',
      });

      // Create table reservation using the admin panel reservation endpoint
      let response = await fetch('http://192.168.1.27:9000/api/v1/hotel/reservation', {
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
        
        response = await fetch('http://192.168.1.27:9000/api/v1/hotel/reservation', {
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
          
          response = await fetch('http://192.168.1.27:9000/api/v1/hotel/reservation', {
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
            
            response = await fetch('http://192.168.1.27:9000/api/v1/hotel/reservation', {
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
                
                const customerResponse = await fetch('http://192.168.1.27:9000/api/v1/hotel/customer', {
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
                  
                  response = await fetch('http://192.168.1.27:9000/api/v1/hotel/reservation', {
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

  const renderTableItem = useCallback(({ item }) => {
    // Check if table has reservations for the current date
    const reservations = tableReservations[item._id] || [];
    const bookedSlots = reservations.map(res => res.timeSlot);
    const isFullyBooked = bookedSlots.length >= timeSlots.length;
    
    return (
      <TouchableOpacity
        style={[
          styles.tableCard,
          colorScheme === 'dark' ? styles.tableCardDark : styles.tableCardLight,
          isFullyBooked && styles.tableCardFullyBooked // Only style for fully booked
        ]}
        onPress={() => handleTableSelect(item)}
        disabled={isFullyBooked}
      >
        <View style={styles.tableHeader}>
          <View style={styles.tableNumberContainer}>
            <Icon name="table-restaurant" size={24} color={isFullyBooked ? '#999' : '#800000'} />
            <Text style={[
              styles.tableNumber, 
              colorScheme === 'dark' ? styles.textDark : styles.textLight,
              isFullyBooked && styles.disabledText
            ]}>
              Table {item.number}
            </Text>
          </View>
        </View>
        
        <View style={styles.tableDetails}>
          {item.location && (
            <View style={styles.tableInfo}>
              <Icon name="location-on" size={16} color={isFullyBooked ? '#999' : '#666'} />
              <Text style={[
                styles.locationText, 
                colorScheme === 'dark' ? styles.textDark : styles.textLight,
                isFullyBooked && styles.disabledText
              ]}>
                {item.location}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.bookButton}>
          <Text style={[styles.bookButtonText, isFullyBooked && styles.disabledText]}>
            {isFullyBooked ? 'Not Available' : 'Tap to Book'}
          </Text>
          <Icon name="arrow-forward" size={16} color={isFullyBooked ? '#999' : '#800000'} />
        </View>
      </TouchableOpacity>
    );
  }, [tableReservations, colorScheme, handleTableSelect]);

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
            'Select a table to see available time slots.' :
            'Please select a branch first to view available tables.'
          }
        </Text>
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
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={5}
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
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
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
                    Scroll horizontally to see all time slots. Red bordered slots are already booked.
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
                        
                        // Enhanced debug logging
                        console.log(`🎯 Slot ${index}: "${slot.value}"`);
                        console.log(`   - isUnavailable: ${isUnavailable}`);
                        console.log(`   - isSelected: ${isSelected}`);
                        console.log(`   - unavailableSlots array:`, unavailableSlots);
                        
                        return (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.timeSlotButton,
                              // Apply base theme style first
                              !isSelected && !isUnavailable && (colorScheme === 'dark' ? styles.timeSlotButtonDark : styles.timeSlotButtonLight),
                              // Apply unavailable style if needed - THIS SHOULD ADD RED BORDER
                              isUnavailable && !isSelected && styles.unavailableTimeSlot,
                              // Apply selected style last to ensure it overrides everything
                              isSelected && styles.selectedTimeSlot,
                            ]}
                            onPress={() => {
                              if (!isUnavailable) {
                                setBookingDetails({...bookingDetails, timeSlot: slot.value});
                              } else {
                                console.log('⚠️ Attempted to select unavailable slot:', slot.value);
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
    backgroundColor: '#f5f7fa',
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  textLight: {
    color: '#1f2937',
  },
  textDark: {
    color: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerLight: {
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
  },
  headerDark: {
    backgroundColor: '#1f1f1f',
    borderBottomColor: '#374151',
  },
  headerText: {
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(128, 0, 0, 0.08)',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#800000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  infoBannerLight: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  infoBannerDark: {
    backgroundColor: '#451a03',
    borderColor: '#78350f',
  },
  infoBannerText: {
    fontSize: 13,
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statsContainerLight: {
    backgroundColor: '#fff',
  },
  statsContainerDark: {
    backgroundColor: '#1f1f1f',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#800000',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  tablesList: {
    padding: 16,
  },
  tableRow: {
    justifyContent: 'space-between',
  },
  tableCard: {
    flex: 0.48,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden', // Prevent content from exceeding card bounds
  },
  tableCardLight: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  tableCardDark: {
    backgroundColor: '#1f1f1f',
    borderColor: '#374151',
  },
  tableCardDisabled: {
    opacity: 1,
  },
  tableCardBooked: {
    borderColor: '#ff6b6b',
    borderWidth: 2,
  },
  tableCardFullyBooked: {
    borderColor: '#dc3545',
    borderWidth: 2,
    opacity: 0.7,
  },
  bookingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
  },
  partiallyBookedBadge: {
    backgroundColor: '#fff3cd',
  },
  fullyBookedBadge: {
    backgroundColor: '#f8d7da',
  },
  bookingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#721c24',
  },
  disabledText: {
    color: '#999',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 0, 0, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  tableNumber: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.3,
    flexShrink: 1, // Allow text to shrink if needed
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
    flexShrink: 0, // Prevent badge from shrinking
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableDetails: {
    marginBottom: 12,
    paddingVertical: 8,
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
    flexWrap: 'wrap', // Allow wrapping if needed
  },
  capacityText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '600',
    flexShrink: 1, // Allow text to shrink
  },
  locationText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
    flexShrink: 1, // Allow text to shrink
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(128, 0, 0, 0.08)',
    borderRadius: 10,
    marginTop: 4,
  },
  bookButtonText: {
    color: '#800000',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '92%',
    maxWidth: 500, // Maximum width for tablets/larger screens
    maxHeight: '85%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContainerLight: {
    backgroundColor: '#fff',
  },
  modalContainerDark: {
    backgroundColor: '#1f1f1f',
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  instructionText: {
    fontSize: 12,
    opacity: 0.65,
    marginBottom: 10,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
  },
  textInputLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#d1d5db',
    borderWidth: 1.5,
    color: '#1f2937',
  },
  textInputDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#4b5563',
    color: '#f3f4f6',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    minWidth: 120, // Minimum width for smaller screens
    maxWidth: '48%', // Prevent buttons from becoming too wide
  },
  cancelButtonLight: {
    backgroundColor: '#fff',
    borderColor: '#800000',
  },
  cancelButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#800000',
  },
  cancelButtonText: {
    color: '#800000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    includeFontPadding: false, // Better text alignment
    textAlignVertical: 'center',
  },
  bookConfirmButton: {
    flex: 1,
    backgroundColor: '#800000',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#800000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 120, // Minimum width for smaller screens
    maxWidth: '48%', // Prevent buttons from becoming too wide
  },
  bookConfirmButtonDisabled: {
    opacity: 0.7,
  },
  bookConfirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false, // Better text alignment
    textAlignVertical: 'center',
  },
  pickerContainer: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    height: 90,
  },
  timeSlotScrollView: {
    height: 70,
  },
  timeSlotContainer: {
    paddingHorizontal: 10,
    alignItems: 'center',
    paddingRight: 24,
  },
  timeSlotButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
    height: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  timeSlotButtonLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  timeSlotButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#4b5563',
  },
  selectedTimeSlot: {
    backgroundColor: '#800000',
    borderColor: '#800000',
    shadowColor: '#800000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.05 }],
  },
  unavailableTimeSlot: {
    backgroundColor: '#ffe6e6',
    borderColor: '#dc3545',
    borderWidth: 2,
    opacity: 0.8,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  timeSlotTextDark: {
    color: '#f3f4f6',
  },
  selectedTimeSlotText: {
    color: '#fff',
    fontWeight: '800',
  },
  unavailableTimeSlotText: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  unavailableLabel: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 6,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  selectedSlotText: {
    fontSize: 13,
    color: '#059669',
    marginTop: 6,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  datePickerButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerText: {
    fontSize: 15,
    flex: 1,
    marginLeft: 12,
    fontWeight: '600',
  },
  branchSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  branchSelectorLight: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  branchSelectorDark: {
    backgroundColor: '#1f1f1f',
    borderColor: '#374151',
  },
  branchSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  branchTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  branchSelectorLabel: {
    fontSize: 11,
    opacity: 0.65,
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  branchAddress: {
    fontSize: 12,
    marginTop: 3,
    opacity: 0.75,
    fontWeight: '500',
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedBranchItem: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
  },
  selectedBranchItemDark: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1.5,
    borderColor: '#78350f',
  },
  branchItemLeft: {
    marginRight: 16,
  },
  branchItemDetails: {
    flex: 1,
  },
  branchItemName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  selectedBranchText: {
    color: '#800000',
  },
  branchItemAddress: {
    fontSize: 13,
    opacity: 0.75,
    fontWeight: '500',
  },
});

export default TableBooking;


