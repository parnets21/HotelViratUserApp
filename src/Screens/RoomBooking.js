import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Appearance,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

const API_BASE = "https://hotelvirat.com/api/v1/hotel";

// Helper function to get proper image URL
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  // If it's already a full URL, return as is
  if (imagePath.startsWith("http")) return imagePath;
  
  // Try production server first for room images since they might be hosted there
  const prodBaseUrl = "https://hotelvirat.com";
  
  // Clean up the path - remove leading slash if present
  let cleanPath = imagePath.replace(/\\/g, '/'); // Convert backslashes to forward slashes
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.substring(1);
  }
  
  return `${prodBaseUrl}/${cleanPath}`;
};

const RoomBooking = () => {
  const navigation = useNavigation();
  const [rooms, setRooms] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [roomBookings, setRoomBookings] = useState({});
  
  // Booking form state
  const [bookingForm, setBookingForm] = useState({
    checkInDate: '',
    checkOutDate: '',
    checkInTime: '12:00',
    checkOutTime: '11:00',
    gstOption: 'withGST', // 'withoutGST', 'withGST', 'withIGST'
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    guestGstNumber: '',
  });
  
  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarFor, setCalendarFor] = useState('checkIn'); // 'checkIn' or 'checkOut'
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [monthlyBookings, setMonthlyBookings] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  
  // Time slot state
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [timeSlotFor, setTimeSlotFor] = useState('checkIn'); // 'checkIn' or 'checkOut'
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [bookedTimeSlots, setBookedTimeSlots] = useState({});

  // Generate time slots (24-hour format)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
      const displayTime = hour === 0 ? '12:00 AM' : 
                         hour < 12 ? `${hour}:00 AM` : 
                         hour === 12 ? '12:00 PM' : 
                         `${hour - 12}:00 PM`;
      slots.push({ value: timeStr, display: displayTime });
    }
    return slots;
  };

  // Fetch booked time slots for a specific room and date
  const fetchBookedTimeSlots = async (roomId, date) => {
    try {
      console.log('🔍 Mobile App - Fetching booked slots for room:', roomId, 'date:', date)
      const response = await fetch(`${API_BASE}/room-booking/slots/${roomId}?date=${date}`);
      const data = await response.json();
      console.log('✅ Mobile App - Booked slots response:', data)
      return data.bookedSlots || [];
    } catch (error) {
      console.error('❌ Mobile App - Error fetching booked time slots:', error);
      return [];
    }
  };

  // Fetch booking data for entire month
  const fetchMonthlyBookings = async (roomId, year, month) => {
    if (!roomId) return;
    
    setCalendarLoading(true);
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const bookingsMap = {};
      
      // Fetch booking data for each day of the month
      const promises = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        promises.push(
          fetchBookedTimeSlots(roomId, dateStr).then(bookedSlots => ({
            date: dateStr,
            bookedSlots,
            isFullyBooked: bookedSlots.length >= 24,
            hasBookings: bookedSlots.length > 0
          }))
        );
      }
      
      const results = await Promise.all(promises);
      results.forEach(result => {
        bookingsMap[result.date] = result;
      });
      
      setMonthlyBookings(bookingsMap);
    } catch (error) {
      console.error('Error fetching monthly bookings:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Check if a time slot is available
  const isTimeSlotAvailable = (roomId, date, time) => {
    const key = `${roomId}-${date}`;
    const bookedSlots = bookedTimeSlots[key] || [];
    return !bookedSlots.includes(time);
  };

  // Open time slot selector
  const openTimeSlotSelector = async (type) => {
    if (!selectedRoom) return;
    
    const date = type === 'checkIn' ? bookingForm.checkInDate : bookingForm.checkOutDate;
    if (!date) {
      Alert.alert('Error', `Please select ${type === 'checkIn' ? 'check-in' : 'check-out'} date first`);
      return;
    }

    setTimeSlotFor(type);
    
    // Fetch booked slots for this room and date
    const bookedSlots = await fetchBookedTimeSlots(selectedRoom._id, date);
    const key = `${selectedRoom._id}-${date}`;
    setBookedTimeSlots(prev => ({ ...prev, [key]: bookedSlots }));
    
    setShowTimeSlotModal(true);
  };

  // Select time slot
  const selectTimeSlot = (timeValue) => {
    if (timeSlotFor === 'checkIn') {
      setBookingForm({ ...bookingForm, checkInTime: timeValue });
    } else {
      setBookingForm({ ...bookingForm, checkOutTime: timeValue });
    }
    setShowTimeSlotModal(false);
  };

  // Open calendar for date selection
  const openCalendar = (type) => {
    setCalendarFor(type);
    const currentMonth = new Date();
    setCalendarMonth(currentMonth);
    setShowCalendar(true);
    
    // Fetch booking data for the current month if room is selected
    if (selectedRoom) {
      fetchMonthlyBookings(selectedRoom._id, currentMonth.getFullYear(), currentMonth.getMonth());
    }
  };

  // Select date from calendar
  const selectDate = (day) => {
    const year = calendarMonth.getFullYear();
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    
    // Check if date is fully booked
    if (isFullyBooked(day)) {
      Alert.alert(
        "Date Unavailable", 
        "This date is fully booked. Please select a different date or check available time slots.",
        [{ text: "OK" }]
      );
      return;
    }
    
    if (calendarFor === 'checkIn') {
      setBookingForm({ ...bookingForm, checkInDate: dateStr });
    } else {
      setBookingForm({ ...bookingForm, checkOutDate: dateStr });
    }
    setShowCalendar(false);
  };

  // Get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDay };
  };

  // Navigate calendar month
  const changeMonth = (direction) => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCalendarMonth(newMonth);
    
    // Fetch booking data for the new month
    if (selectedRoom) {
      fetchMonthlyBookings(selectedRoom._id, newMonth.getFullYear(), newMonth.getMonth());
    }
  };

  // Calculate number of nights
  const calculateNights = () => {
    if (!bookingForm.checkInDate || !bookingForm.checkOutDate) return 0;
    const checkIn = new Date(bookingForm.checkInDate);
    const checkOut = new Date(bookingForm.checkOutDate);
    const diffTime = checkOut - checkIn;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Calculate price with different GST options
  const calculatePrice = () => {
    if (!selectedRoom) return { baseAmount: 0, cgst: 0, sgst: 0, igst: 0, totalAmount: 0, nights: 0, gstAmount: 0 };
    
    const nights = calculateNights();
    const baseAmount = selectedRoom.price * nights;
    
    let cgst = 0, sgst = 0, igst = 0, gstAmount = 0;
    
    if (bookingForm.gstOption === 'withoutGST') {
      // No GST
      cgst = sgst = igst = gstAmount = 0;
    } else if (bookingForm.gstOption === 'withGST') {
      // Within State: CGST + SGST
      // Below ₹7500 per night: 12% GST (6% CGST + 6% SGST)
      // ₹7500 and above per night: 18% GST (9% CGST + 9% SGST)
      const gstRate = selectedRoom.price >= 7500 ? 0.09 : 0.06;
      cgst = baseAmount * gstRate;
      sgst = baseAmount * gstRate;
      gstAmount = cgst + sgst;
    } else if (bookingForm.gstOption === 'withIGST') {
      // Out of State: IGST
      const gstRate = selectedRoom.price >= 7500 ? 0.18 : 0.12;
      igst = baseAmount * gstRate;
      gstAmount = igst;
    }
    
    const totalAmount = baseAmount + gstAmount;
    
    return {
      nights,
      baseAmount,
      cgst,
      sgst,
      igst,
      gstAmount,
      gstPercent: selectedRoom.price >= 7500 ? (bookingForm.gstOption === 'withIGST' ? 18 : 9) : (bookingForm.gstOption === 'withIGST' ? 12 : 6),
      totalAmount,
    };
  };

  // Check if date is in past
  const isPastDate = (day) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return checkDate < today;
  };

  // Check if date has any bookings for the selected room
  const hasBookingsOnDate = (day) => {
    if (!selectedRoom) return false;
    const year = calendarMonth.getFullYear();
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    const bookingData = monthlyBookings[dateStr];
    return bookingData?.hasBookings || false;
  };

  // Check if date is fully booked (all 24 hours booked)
  const isFullyBooked = (day) => {
    if (!selectedRoom) return false;
    const year = calendarMonth.getFullYear();
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    const bookingData = monthlyBookings[dateStr];
    return bookingData?.isFullyBooked || false;
  };

  // Check if date is selectable (not in past and not fully booked)
  const isDateSelectable = (day) => {
    const isPast = isPastDate(day);
    const fullyBooked = isFullyBooked(day);
    return !isPast && !fullyBooked;
  };

  // Get user ID and data on mount
  useEffect(() => {
    const getUserData = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
          // Fetch user details from API
          const response = await fetch(`${API_BASE}/user-auth/${storedUserId}`);
          const data = await response.json();
          if (response.ok) {
            setUserData({
              _id: storedUserId,
              name: data.name,
              phone: data.mobile,
              email: data.email,
            });
          }
        }
      } catch (error) {
        console.error('Error getting user data:', error);
      }
    };
    getUserData();
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    fetchBranches();
    fetchRooms();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await fetch(`${API_BASE}/branch`);
      const data = await response.json();
      console.log("Branches fetched:", data);
      if (Array.isArray(data)) {
        setBranches(data);
      } else {
        console.error("Branches data is not an array:", data);
        setBranches([]);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      setBranches([]);
    }
  };

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const url = selectedBranch
        ? `${API_BASE}/room?branchId=${selectedBranch}`
        : `${API_BASE}/room`;
      console.log("Fetching rooms from:", url);
      const response = await fetch(url);
      const data = await response.json();
      console.log("Rooms fetched:", data);
      if (Array.isArray(data)) {
        setRooms(data);
        // Fetch bookings for each room
        fetchRoomBookings(data);
      } else {
        console.error("Rooms data is not an array:", data);
        setRooms([]);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomBookings = async (roomsList) => {
    // With time slot system, we don't need to fetch active bookings for room cards
    // Room availability is now determined by individual time slots when booking
    // This prevents rooms from showing as "occupied" when they have some bookings
    // but are still available for other time slots
    setRoomBookings({});
  };

  useEffect(() => {
    fetchRooms();
  }, [selectedBranch]);

  const isDark = colorScheme === "dark";
  const styles = getStyles(isDark);

  const getAmenityIcon = (amenity) => {
    const icons = {
      ac: "ac-unit",
      tv: "tv",
      wifi: "wifi",
      geyser: "hot-tub",
      minibar: "local-bar",
      balcony: "balcony",
    };
    return icons[amenity] || "check-circle";
  };

  // Get room display name (Floor - Room Number)
  const getRoomDisplayName = (room) => {
    if (room.roomNumber) {
      return `${room.floor} - Room ${room.roomNumber}`;
    }
    return room.floor;
  };

  // Handle booking
  const handleBookRoom = (room) => {
    if (!userId) {
      Alert.alert("Login Required", "Please login to book a room", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => navigation.navigate("Login") }
      ]);
      return;
    }
    setSelectedRoom(room);
    setShowRoomModal(false);
    // Reset form with user data pre-filled
    setBookingForm({
      checkInDate: '',
      checkOutDate: '',
      checkInTime: '12:00',
      checkOutTime: '11:00',
      gstOption: 'withGST',
      guestName: userData?.name || '',
      guestPhone: userData?.phone || '',
      guestEmail: userData?.email || '',
      guestGstNumber: '',
    });
    setShowBookingModal(true);
  };

  // Confirm booking
  const confirmBooking = async () => {
    // Form validation
    if (!bookingForm.checkInDate || !bookingForm.checkOutDate) {
      Alert.alert("Error", "Please select check-in and check-out dates");
      return;
    }

    if (!bookingForm.guestName.trim()) {
      Alert.alert("Error", "Please enter guest name");
      return;
    }

    if (!bookingForm.guestPhone.trim()) {
      Alert.alert("Error", "Please enter phone number");
      return;
    }

    // Validate phone number (basic validation)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(bookingForm.guestPhone.replace(/\D/g, ''))) {
      Alert.alert("Error", "Please enter a valid 10-digit phone number");
      return;
    }

    // Validate email if provided
    if (bookingForm.guestEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(bookingForm.guestEmail.trim())) {
        Alert.alert("Error", "Please enter a valid email address");
        return;
      }
    }

    // Validate GST number if provided
    if (bookingForm.guestGstNumber.trim()) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(bookingForm.guestGstNumber.trim())) {
        Alert.alert("Error", "Please enter a valid GST number (15 characters: 22AAAAA0000A1Z5)");
        return;
      }
    }

    // Validate dates
    const checkInDate = new Date(bookingForm.checkInDate);
    const checkOutDate = new Date(bookingForm.checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      Alert.alert("Error", "Check-in date cannot be in the past");
      return;
    }

    if (checkOutDate <= checkInDate) {
      Alert.alert("Error", "Check-out date must be after check-in date");
      return;
    }

    setBookingLoading(true);
    try {
      const priceDetails = calculatePrice();
      
      const bookingData = {
        roomId: selectedRoom._id,
        branchId: selectedRoom.branchId?._id || selectedRoom.branchId,
        userId: userId,
        userName: bookingForm.guestName.trim(),
        userPhone: bookingForm.guestPhone.trim(),
        userEmail: bookingForm.guestEmail.trim() || '',
        guestGstNumber: bookingForm.guestGstNumber.trim() || '',
        checkInDate: bookingForm.checkInDate,
        checkOutDate: bookingForm.checkOutDate,
        checkInTime: bookingForm.checkInTime,
        checkOutTime: bookingForm.checkOutTime,
        gstOption: bookingForm.gstOption,
        nights: priceDetails.nights,
        baseAmount: priceDetails.baseAmount,
        cgst: priceDetails.cgst,
        sgst: priceDetails.sgst,
        igst: priceDetails.igst,
        gstAmount: priceDetails.gstAmount,
        totalPrice: priceDetails.totalAmount,
      };

      console.log('Booking data:', bookingData);

      const response = await fetch(`${API_BASE}/room-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      const data = await response.json();

      if (response.ok) {
        setBookingLoading(false);
        setShowBookingModal(false);
        Alert.alert("Success", `Booking confirmed for ${getRoomDisplayName(selectedRoom)}!`);
        fetchRooms(); // Refresh rooms
      } else {
        setBookingLoading(false);
        Alert.alert("Error", data.message || "Booking failed. Please try again.");
      }
    } catch (error) {
      setBookingLoading(false);
      console.error('Booking error:', error);
      Alert.alert("Error", "Booking failed. Please try again.");
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const RoomCard = ({ room }) => {
    const booking = roomBookings[room._id];
    // Room is available if it's marked as available in the system
    // Individual time slots will be checked during booking
    const isAvailable = room.isAvailable;
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    return (
      <TouchableOpacity
        style={styles.roomCard}
        onPress={() => {
          setSelectedRoom(room);
          setShowRoomModal(true);
        }}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: room.images && room.images[0] ? getImageUrl(room.images[0]) : "https://via.placeholder.com/300x200" }}
            style={styles.roomImage}
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
            onError={(e) => {
              console.log('❌ Room image failed (production server):', room.images[0]);
              // Try production server as fallback
              const fallbackUrl = room.images[0]?.startsWith('http') 
                ? room.images[0] 
                : `https://hotelvirat.com/${room.images[0]?.replace(/^\//, '')}`;
              
              console.log('🔄 Trying production server:', fallbackUrl);
              
              // Only try fallback once by checking current URL
              const currentUrl = e.target._source?.uri || '';
              if (currentUrl.includes('hotelvirat.com')) {
                // Currently trying production, switch to fallback
                e.target.setNativeProps({
                  source: { uri: fallbackUrl }
                });
              } else {
                console.log('❌ Both servers failed for room image');
                setImageLoading(false);
                setImageError(true);
              }
            }}
          />
          {imageLoading && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color="#800000" />
            </View>
          )}
          {imageError && (
            <View style={styles.imageErrorOverlay}>
              <Icon name="broken-image" size={40} color={isDark ? "#666" : "#ccc"} />
              <Text style={styles.imageErrorText}>Image not available</Text>
            </View>
          )}
        </View>
        {!isAvailable && (
          <View style={styles.bookedBadge}>
            <Text style={styles.bookedBadgeText}>UNAVAILABLE</Text>
          </View>
        )}
        <View style={styles.roomInfo}>
          <Text style={styles.roomName}>{getRoomDisplayName(room)}</Text>
          <Text style={styles.branchName}>{room.branchId?.name}</Text>
          <Text style={styles.roomType}>{room.roomType}</Text>
          <View style={styles.amenitiesContainer}>
            {Object.entries(room.amenities || {}).map(
              ([key, value]) =>
                value && (
                  <View key={key} style={styles.amenityBadge}>
                    <Icon name={getAmenityIcon(key)} size={14} color="#800000" />
                    <Text style={styles.amenityText}>{key.toUpperCase()}</Text>
                  </View>
                )
            )}
          </View>
          
          {/* With time slot system, rooms are available for booking at different times */}
          {/* Individual booking details are not shown on room cards */}

          <View style={styles.roomFooter}>
            <Text style={styles.price}>₹{room.price}</Text>
            <TouchableOpacity
              style={[styles.bookButtonSmall, !isAvailable && styles.bookButtonDisabled]}
              disabled={!isAvailable}
              onPress={() => handleBookRoom(room)}
            >
              <Text style={styles.bookButtonSmallText}>
                {!isAvailable ? "Unavailable" : "Book"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const RoomDetailModal = () => {
    if (!selectedRoom) return null;
    const [modalImageLoading, setModalImageLoading] = useState({});
    const [modalImageErrors, setModalImageErrors] = useState({});

    const handleImageLoadStart = (index) => {
      setModalImageLoading(prev => ({ ...prev, [index]: true }));
    };

    const handleImageLoadEnd = (index) => {
      setModalImageLoading(prev => ({ ...prev, [index]: false }));
    };

    const handleImageError = (index) => {
      setModalImageLoading(prev => ({ ...prev, [index]: false }));
      setModalImageErrors(prev => ({ ...prev, [index]: true }));
    };

    return (
      <Modal visible={showRoomModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowRoomModal(false)}>
              <Icon name="close" size={24} color={isDark ? "#fff" : "#000"} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Image Gallery */}
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                {selectedRoom.images && selectedRoom.images.length > 0 ? (
                  selectedRoom.images.map((image, index) => (
                    <View key={index} style={styles.modalImageContainer}>
                      <Image 
                        source={{ uri: getImageUrl(image) }} 
                        style={styles.modalImage}
                        onLoadStart={() => handleImageLoadStart(index)}
                        onLoadEnd={() => handleImageLoadEnd(index)}
                        onError={(e) => {
                          console.log('❌ Modal room image failed (production server):', image);
                          // Try production server as fallback
                          const fallbackUrl = image?.startsWith('http') 
                            ? image 
                            : `https://hotelvirat.com/${image?.replace(/^\//, '')}`;
                          
                          console.log('🔄 Trying production server:', fallbackUrl);
                          
                          // Only try fallback once
                          if (e.target._source.uri.includes('hotelvirat.com')) {
                            e.target.setNativeProps({
                              source: { uri: fallbackUrl }
                            });
                          } else {
                            console.log('❌ Both servers failed for modal room image');
                            handleImageError(index);
                          }
                        }}
                      />
                      {modalImageLoading[index] && (
                        <View style={styles.modalImageLoadingOverlay}>
                          <ActivityIndicator size="large" color="#800000" />
                        </View>
                      )}
                      {modalImageErrors[index] && (
                        <View style={styles.modalImageErrorOverlay}>
                          <Icon name="broken-image" size={60} color={isDark ? "#666" : "#ccc"} />
                          <Text style={styles.modalImageErrorText}>Image not available</Text>
                        </View>
                      )}
                    </View>
                  ))
                ) : (
                  <View style={styles.modalImageContainer}>
                    <Image source={{ uri: "https://via.placeholder.com/400x300" }} style={styles.modalImage} />
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalBody}>
                <Text style={styles.modalTitle}>{getRoomDisplayName(selectedRoom)}</Text>
                <Text style={styles.modalBranch}>{selectedRoom.branchId?.name}</Text>
                <Text style={styles.roomTypeLabel}>{selectedRoom.roomType}</Text>

                {selectedRoom.description ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>{selectedRoom.description}</Text>
                  </View>
                ) : null}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Amenities</Text>
                  <View style={styles.amenitiesGrid}>
                    {Object.entries(selectedRoom.amenities || {}).map(([key, value]) =>
                      value ? (
                        <View key={key} style={styles.amenityItem}>
                          <Icon name={getAmenityIcon(key)} size={20} color="#800000" />
                          <Text style={styles.amenityLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                        </View>
                      ) : null
                    )}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Room Details</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Floor:</Text>
                    <Text style={styles.detailValue}>{selectedRoom.floor}</Text>
                  </View>
                  {selectedRoom.roomNumber && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Room Number:</Text>
                      <Text style={styles.detailValue}>{selectedRoom.roomNumber}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Capacity:</Text>
                    <Text style={styles.detailValue}>
                      {selectedRoom.capacity?.adults || 2} Adults, {selectedRoom.capacity?.children || 0} Children
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <Text style={[styles.detailValue, { color: selectedRoom.isAvailable ? "#059669" : "#dc2626" }]}>
                      {selectedRoom.isAvailable ? "Available" : "Not Available"}
                    </Text>
                  </View>
                </View>

                {/* With time slot system, rooms can be booked for different time periods */}
                {/* Specific booking conflicts will be shown during the booking process */}

                <View style={styles.priceSection}>
                  <View>
                    <Text style={styles.priceLabelLarge}>Price</Text>
                    <Text style={styles.priceLarge}>₹{selectedRoom.price}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.bookButton, !selectedRoom.isAvailable && styles.bookButtonDisabled]}
                    disabled={!selectedRoom.isAvailable}
                    onPress={() => handleBookRoom(selectedRoom)}
                  >
                    <Text style={styles.bookButtonText}>
                      {!selectedRoom.isAvailable ? "Unavailable" : "Book Now"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#1a1a1a" : "#fff"} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Room Booking</Text>
      </View>

      {/* Branch Filter */}
      {branches.length > 0 ? (
        <View style={styles.branchFilterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.branchFilterContent}
          >
            <TouchableOpacity
              style={[styles.branchChip, !selectedBranch && styles.branchChipActive]}
              onPress={() => setSelectedBranch(null)}
            >
              <Text style={[styles.branchChipText, !selectedBranch && styles.branchChipTextActive]}>All</Text>
            </TouchableOpacity>
            {branches.map((branch) => (
              <TouchableOpacity
                key={branch._id}
                style={[styles.branchChip, selectedBranch === branch._id && styles.branchChipActive]}
                onPress={() => setSelectedBranch(branch._id)}
              >
                <Text style={[styles.branchChipText, selectedBranch === branch._id && styles.branchChipTextActive]}>
                  {branch.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.branchFilterContainer}>
          <Text style={[styles.branchChipText, { paddingHorizontal: 20 }]}>
            {loading ? "Loading branches..." : "No branches available"}
          </Text>
        </View>
      )}

      {/* Rooms List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#800000" />
        </View>
      ) : rooms.length > 0 ? (
        <FlatList
          data={rooms}
          renderItem={({ item }) => <RoomCard room={item} />}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="hotel" size={64} color={isDark ? "#666" : "#ccc"} />
          <Text style={styles.emptyText}>No rooms available</Text>
        </View>
      )}

      <RoomDetailModal />

      {/* Booking Form Modal */}
      <Modal visible={showBookingModal} animationType="slide" transparent={true}>
        <View style={styles.bookingModalOverlay}>
          <View style={styles.bookingModalContent}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowBookingModal(false)}>
              <Icon name="close" size={24} color={isDark ? "#fff" : "#000"} />
            </TouchableOpacity>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.bookingModalTitle}>Book Room</Text>
              
              {selectedRoom && (
                <>
                  <View style={styles.bookingSummary}>
                    <Text style={styles.bookingRoomName}>{getRoomDisplayName(selectedRoom)}</Text>
                    <Text style={styles.bookingBranch}>{selectedRoom.branchId?.name}</Text>
                    <Text style={styles.bookingType}>{selectedRoom.roomType}</Text>
                    <Text style={styles.bookingPrice}>₹{selectedRoom.price}</Text>
                  </View>

                  {/* Guest Info */}
                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Guest Details</Text>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Name *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter guest name"
                        placeholderTextColor={isDark ? "#666" : "#999"}
                        value={bookingForm.guestName || userData?.name || ''}
                        onChangeText={(text) => setBookingForm({...bookingForm, guestName: text})}
                      />
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Phone *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter phone number"
                        placeholderTextColor={isDark ? "#666" : "#999"}
                        value={bookingForm.guestPhone || userData?.phone || ''}
                        onChangeText={(text) => setBookingForm({...bookingForm, guestPhone: text})}
                        keyboardType="phone-pad"
                      />
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Email (Optional)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter email address"
                        placeholderTextColor={isDark ? "#666" : "#999"}
                        value={bookingForm.guestEmail || userData?.email || ''}
                        onChangeText={(text) => setBookingForm({...bookingForm, guestEmail: text})}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>GST Number (Optional)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter GST number (e.g., 22AAAAA0000A1Z5)"
                        placeholderTextColor={isDark ? "#666" : "#999"}
                        value={bookingForm.guestGstNumber}
                        onChangeText={(text) => setBookingForm({...bookingForm, guestGstNumber: text.toUpperCase()})}
                        autoCapitalize="characters"
                        maxLength={15}
                      />
                    </View>
                  </View>

                  {/* Check-in Date */}
                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Check-in</Text>
                    <View style={styles.dateTimeRow}>
                      <TouchableOpacity style={styles.dateInput} onPress={() => openCalendar('checkIn')}>
                        <Text style={styles.inputLabel}>Date *</Text>
                        <View style={styles.datePickerBtn}>
                          <Icon name="calendar-today" size={20} color="#800000" />
                          <Text style={[styles.datePickerText, !bookingForm.checkInDate && styles.placeholderText]}>
                            {bookingForm.checkInDate ? formatDate(bookingForm.checkInDate) : 'Select Date'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.timeInput} onPress={() => openTimeSlotSelector('checkIn')}>
                        <Text style={styles.inputLabel}>Time *</Text>
                        <View style={styles.timePickerBtn}>
                          <Icon name="access-time" size={20} color="#800000" />
                          <Text style={[styles.timePickerText, !bookingForm.checkInTime && styles.placeholderText]}>
                            {bookingForm.checkInTime || 'Select Time'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Check-out Date */}
                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Check-out</Text>
                    <View style={styles.dateTimeRow}>
                      <TouchableOpacity style={styles.dateInput} onPress={() => openCalendar('checkOut')}>
                        <Text style={styles.inputLabel}>Date *</Text>
                        <View style={styles.datePickerBtn}>
                          <Icon name="calendar-today" size={20} color="#800000" />
                          <Text style={[styles.datePickerText, !bookingForm.checkOutDate && styles.placeholderText]}>
                            {bookingForm.checkOutDate ? formatDate(bookingForm.checkOutDate) : 'Select Date'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.timeInput} onPress={() => openTimeSlotSelector('checkOut')}>
                        <Text style={styles.inputLabel}>Time *</Text>
                        <View style={styles.timePickerBtn}>
                          <Icon name="access-time" size={20} color="#800000" />
                          <Text style={[styles.timePickerText, !bookingForm.checkOutTime && styles.placeholderText]}>
                            {bookingForm.checkOutTime || 'Select Time'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* GST Options */}
                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>GST Option</Text>
                    
                    <TouchableOpacity 
                      style={[styles.gstOption, bookingForm.gstOption === 'withoutGST' && styles.gstOptionSelected]}
                      onPress={() => setBookingForm({...bookingForm, gstOption: 'withoutGST'})}
                    >
                      <View style={styles.radioButton}>
                        {bookingForm.gstOption === 'withoutGST' && <View style={styles.radioButtonSelected} />}
                      </View>
                      <View style={styles.gstOptionContent}>
                        <Text style={[styles.gstOptionTitle, isDark ? styles.textDark : styles.textLight]}>Without GST</Text>
                        <Text style={styles.gstOptionSubtitle}>Basic price only</Text>
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.gstOption, bookingForm.gstOption === 'withGST' && styles.gstOptionSelected]}
                      onPress={() => setBookingForm({...bookingForm, gstOption: 'withGST'})}
                    >
                      <View style={styles.radioButton}>
                        {bookingForm.gstOption === 'withGST' && <View style={styles.radioButtonSelected} />}
                      </View>
                      <View style={styles.gstOptionContent}>
                        <Text style={[styles.gstOptionTitle, isDark ? styles.textDark : styles.textLight]}>With GST (Within State)</Text>
                        <Text style={styles.gstOptionSubtitle}>
                          CGST {selectedRoom?.price >= 7500 ? '9%' : '6%'} + SGST {selectedRoom?.price >= 7500 ? '9%' : '6%'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.gstOption, bookingForm.gstOption === 'withIGST' && styles.gstOptionSelected]}
                      onPress={() => setBookingForm({...bookingForm, gstOption: 'withIGST'})}
                    >
                      <View style={styles.radioButton}>
                        {bookingForm.gstOption === 'withIGST' && <View style={styles.radioButtonSelected} />}
                      </View>
                      <View style={styles.gstOptionContent}>
                        <Text style={[styles.gstOptionTitle, isDark ? styles.textDark : styles.textLight]}>With IGST (Out of State)</Text>
                        <Text style={styles.gstOptionSubtitle}>
                          IGST {selectedRoom?.price >= 7500 ? '18%' : '12%'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Price Breakdown */}
                  {bookingForm.checkInDate && bookingForm.checkOutDate && (
                    <View style={styles.priceBreakdown}>
                      <Text style={styles.priceBreakdownTitle}>Price Details</Text>
                      
                      {(() => {
                        const priceDetails = calculatePrice();
                        return (
                          <>
                            <View style={styles.priceRow}>
                              <Text style={styles.priceLabel}>
                                Room Charge ({priceDetails.nights} {priceDetails.nights === 1 ? 'Night' : 'Nights'} × ₹{selectedRoom.price})
                              </Text>
                              <Text style={styles.priceValue}>₹{priceDetails.baseAmount.toFixed(2)}</Text>
                            </View>
                            
                            {bookingForm.gstOption === 'withGST' && (
                              <>
                                <View style={styles.priceRow}>
                                  <Text style={styles.priceLabel}>CGST ({priceDetails.gstPercent}%)</Text>
                                  <Text style={styles.priceValue}>₹{priceDetails.cgst.toFixed(2)}</Text>
                                </View>
                                
                                <View style={styles.priceRow}>
                                  <Text style={styles.priceLabel}>SGST ({priceDetails.gstPercent}%)</Text>
                                  <Text style={styles.priceValue}>₹{priceDetails.sgst.toFixed(2)}</Text>
                                </View>
                              </>
                            )}
                            
                            {bookingForm.gstOption === 'withIGST' && (
                              <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>IGST ({priceDetails.gstPercent}%)</Text>
                                <Text style={styles.priceValue}>₹{priceDetails.igst.toFixed(2)}</Text>
                              </View>
                            )}
                            
                            {bookingForm.gstOption !== 'withoutGST' && (
                              <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Total GST</Text>
                                <Text style={styles.priceValue}>₹{priceDetails.gstAmount.toFixed(2)}</Text>
                              </View>
                            )}
                            
                            <View style={styles.priceDivider} />
                            
                            <View style={styles.priceRow}>
                              <Text style={styles.totalLabel}>Total Amount</Text>
                              <Text style={styles.totalValue}>₹{priceDetails.totalAmount.toFixed(2)}</Text>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  )}

                  <View style={styles.bookingActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setShowBookingModal(false)}
                      disabled={bookingLoading}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={confirmBooking}
                      disabled={bookingLoading}
                    >
                      {bookingLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.confirmButtonText}>Confirm</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} animationType="fade" transparent={true}>
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)} disabled={calendarLoading}>
                <Icon name="chevron-left" size={28} color={isDark ? "#fff" : "#000"} />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)} disabled={calendarLoading}>
                <Icon name="chevron-right" size={28} color={isDark ? "#fff" : "#000"} />
              </TouchableOpacity>
            </View>

            {/* Calendar Legend */}
            <View style={styles.calendarLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.legendText}>Partial</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#dc2626' }]} />
                <Text style={styles.legendText}>Full</Text>
              </View>
            </View>

            {/* Info Message */}
            <View style={styles.calendarInfo}>
              <Text style={styles.calendarInfoText}>
                🟢 Available for booking • 🟡 Some time slots booked • 🔴 Fully booked
              </Text>
            </View>

            {/* Loading Indicator */}
            {calendarLoading && (
              <View style={styles.calendarLoadingContainer}>
                <ActivityIndicator size="small" color="#800000" />
                <Text style={styles.calendarLoadingText}>Loading availability...</Text>
              </View>
            )}

            <View style={styles.weekDays}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <Text key={day} style={styles.weekDay}>{day}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {(() => {
                const { daysInMonth, firstDay } = getDaysInMonth(calendarMonth);
                const days = [];
                
                // Empty cells for days before first day of month
                for (let i = 0; i < firstDay; i++) {
                  days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
                }
                
                // Days of the month
                for (let day = 1; day <= daysInMonth; day++) {
                  const isPast = isPastDate(day);
                  const hasBookings = hasBookingsOnDate(day);
                  const fullyBooked = isFullyBooked(day);
                  const isSelectable = isDateSelectable(day);
                  const isAvailable = isSelectable && !hasBookings;
                  
                  days.push(
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayCell, 
                        !isSelectable && styles.dayCellDisabled,
                        fullyBooked && styles.dayCellFullyBooked
                      ]}
                      onPress={() => isSelectable && selectDate(day)}
                      disabled={!isSelectable}
                    >
                      <Text style={[
                        styles.dayText, 
                        !isSelectable && styles.dayTextDisabled,
                        fullyBooked && styles.dayTextFullyBooked
                      ]}>
                        {day}
                      </Text>
                      {isAvailable && (
                        <View style={styles.availableIndicator} />
                      )}
                      {hasBookings && !fullyBooked && (
                        <View style={styles.partialBookingIndicator} />
                      )}
                      {fullyBooked && !isPast && (
                        <View style={styles.fullBookingIndicator} />
                      )}
                    </TouchableOpacity>
                  );
                }
                
                return days;
              })()}
            </View>

            <TouchableOpacity style={styles.calendarCloseBtn} onPress={() => setShowCalendar(false)}>
              <Text style={styles.calendarCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Slot Selection Modal */}
      <Modal visible={showTimeSlotModal} animationType="fade" transparent={true}>
        <View style={styles.timeSlotOverlay}>
          <View style={styles.timeSlotContainer}>
            <View style={styles.timeSlotHeader}>
              <Text style={styles.timeSlotTitle}>
                Select {timeSlotFor === 'checkIn' ? 'Check-in' : 'Check-out'} Time
              </Text>
              <TouchableOpacity onPress={() => setShowTimeSlotModal(false)}>
                <Icon name="close" size={24} color={isDark ? "#fff" : "#000"} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.timeSlotList} showsVerticalScrollIndicator={false}>
              {generateTimeSlots().map((slot) => {
                const date = timeSlotFor === 'checkIn' ? bookingForm.checkInDate : bookingForm.checkOutDate;
                const isAvailable = selectedRoom ? isTimeSlotAvailable(selectedRoom._id, date, slot.value) : true;
                
                return (
                  <TouchableOpacity
                    key={slot.value}
                    style={[
                      styles.timeSlotItem,
                      !isAvailable && styles.timeSlotItemDisabled,
                      (timeSlotFor === 'checkIn' ? bookingForm.checkInTime : bookingForm.checkOutTime) === slot.value && styles.timeSlotItemSelected
                    ]}
                    onPress={() => isAvailable && selectTimeSlot(slot.value)}
                    disabled={!isAvailable}
                  >
                    <Text style={[
                      styles.timeSlotText,
                      !isAvailable && styles.timeSlotTextDisabled,
                      (timeSlotFor === 'checkIn' ? bookingForm.checkInTime : bookingForm.checkOutTime) === slot.value && styles.timeSlotTextSelected
                    ]}>
                      {slot.display}
                    </Text>
                    {!isAvailable && (
                      <View style={styles.bookedIndicator}>
                        <Text style={styles.bookedIndicatorText}>Booked</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.timeSlotCloseBtn} onPress={() => setShowTimeSlotModal(false)}>
              <Text style={styles.timeSlotCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const getStyles = (isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#1a1a1a" : "#f8f9fa",
    },
    header: {
      padding: 20,
      backgroundColor: isDark ? "#2a2a2a" : "#fff",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#444" : "#e5e7eb",
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
    },
    branchFilterContainer: {
      backgroundColor: isDark ? "#2a2a2a" : "#fff",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#444" : "#e5e7eb",
    },
    branchFilterContent: {
      paddingHorizontal: 15,
      alignItems: "center",
    },
    branchChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      marginRight: 10,
    },
    branchChipActive: {
      backgroundColor: "#800000",
    },
    branchChipText: {
      color: isDark ? "#fff" : "#000",
      fontSize: 14,
    },
    branchChipTextActive: {
      color: "#fff",
      fontWeight: "600",
    },
    listContainer: {
      padding: 15,
    },
    roomCard: {
      backgroundColor: isDark ? "#2a2a2a" : "#fff",
      borderRadius: 12,
      marginBottom: 15,
      overflow: "hidden",
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    roomImage: {
      width: "100%",
      height: 200,
      backgroundColor: isDark ? "#333" : "#f3f4f6",
    },
    imageContainer: {
      position: "relative",
      width: "100%",
      height: 200,
    },
    imageLoadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      justifyContent: "center",
      alignItems: "center",
    },
    imageErrorOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      justifyContent: "center",
      alignItems: "center",
    },
    imageErrorText: {
      fontSize: 12,
      color: isDark ? "#666" : "#999",
      marginTop: 8,
      textAlign: "center",
    },
    roomInfo: {
      padding: 15,
    },
    roomName: {
      fontSize: 18,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
      marginBottom: 5,
    },
    branchName: {
      fontSize: 14,
      color: isDark ? "#aaa" : "#666",
      marginBottom: 10,
    },
    amenitiesContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: 10,
    },
    amenityBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
      marginBottom: 5,
    },
    amenityText: {
      fontSize: 11,
      color: "#800000",
      marginLeft: 4,
      fontWeight: "600",
    },
    roomFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
    },
    priceLabel: {
      fontSize: 12,
      color: isDark ? "#aaa" : "#666",
    },
    price: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#800000",
    },
    availabilityContainer: {
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    availabilityText: {
      fontSize: 12,
      color: isDark ? "#fff" : "#000",
      fontWeight: "600",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? "#666" : "#999",
      marginTop: 10,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: isDark ? "#2a2a2a" : "#fff",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "90%",
    },
    closeButton: {
      position: "absolute",
      top: 15,
      right: 15,
      zIndex: 10,
      backgroundColor: isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)",
      borderRadius: 20,
      padding: 5,
    },
    modalImage: {
      width: width,
      height: 300,
      backgroundColor: isDark ? "#333" : "#f3f4f6",
    },
    modalImageContainer: {
      position: "relative",
      width: width,
      height: 300,
    },
    modalImageLoadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      justifyContent: "center",
      alignItems: "center",
    },
    modalImageErrorOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      justifyContent: "center",
      alignItems: "center",
    },
    modalImageErrorText: {
      fontSize: 14,
      color: isDark ? "#666" : "#999",
      marginTop: 12,
      textAlign: "center",
    },
    modalBody: {
      padding: 20,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
      marginBottom: 5,
    },
    modalBranch: {
      fontSize: 16,
      color: isDark ? "#aaa" : "#666",
      marginBottom: 20,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: isDark ? "#fff" : "#000",
      marginBottom: 10,
    },
    description: {
      fontSize: 14,
      color: isDark ? "#ccc" : "#666",
      lineHeight: 20,
    },
    amenitiesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    amenityItem: {
      flexDirection: "row",
      alignItems: "center",
      width: "50%",
      marginBottom: 10,
    },
    amenityLabel: {
      fontSize: 14,
      color: isDark ? "#fff" : "#000",
      marginLeft: 8,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    detailLabel: {
      fontSize: 14,
      color: isDark ? "#aaa" : "#666",
    },
    detailValue: {
      fontSize: 14,
      fontWeight: "600",
      color: isDark ? "#fff" : "#000",
    },
    priceSection: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#444" : "#e5e7eb",
    },
    priceLabelLarge: {
      fontSize: 14,
      color: isDark ? "#aaa" : "#666",
      marginBottom: 5,
    },
    priceLarge: {
      fontSize: 28,
      fontWeight: "bold",
      color: "#800000",
    },
    bookButton: {
      backgroundColor: "#800000",
      paddingHorizontal: 30,
      paddingVertical: 12,
      borderRadius: 8,
    },
    bookButtonDisabled: {
      backgroundColor: isDark ? "#555" : "#ccc",
    },
    bookButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    roomType: {
      fontSize: 13,
      color: "#800000",
      marginBottom: 8,
      fontWeight: "500",
    },
    roomTypeLabel: {
      fontSize: 14,
      color: "#800000",
      marginBottom: 15,
      fontWeight: "500",
    },
    bookButtonSmall: {
      backgroundColor: "#800000",
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 6,
    },
    bookButtonSmallText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
    bookingModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    bookingModalContent: {
      backgroundColor: isDark ? "#2a2a2a" : "#fff",
      borderRadius: 16,
      padding: 24,
      width: "100%",
      maxWidth: 350,
    },
    bookingModalTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
      textAlign: "center",
      marginBottom: 20,
    },
    bookingSummary: {
      backgroundColor: isDark ? "#333" : "#f8f9fa",
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    bookingRoomName: {
      fontSize: 18,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
      marginBottom: 4,
    },
    bookingBranch: {
      fontSize: 14,
      color: isDark ? "#aaa" : "#666",
      marginBottom: 4,
    },
    bookingType: {
      fontSize: 13,
      color: "#800000",
      fontWeight: "500",
    },
    bookingDivider: {
      height: 1,
      backgroundColor: isDark ? "#444" : "#e5e7eb",
      marginVertical: 12,
    },
    bookingPriceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    bookingPriceLabel: {
      fontSize: 14,
      color: isDark ? "#aaa" : "#666",
    },
    bookingPrice: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#800000",
    },
    bookingActions: {
      flexDirection: "row",
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? "#555" : "#ddd",
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: 16,
      color: isDark ? "#fff" : "#000",
      fontWeight: "600",
    },
    confirmButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      backgroundColor: "#800000",
      alignItems: "center",
    },
    confirmButtonText: {
      fontSize: 16,
      color: "#fff",
      fontWeight: "600",
    },
    bookedBadge: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: "#dc2626",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
    },
    bookedBadgeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "bold",
    },
    bookingInfoCard: {
      backgroundColor: isDark ? "#333" : "#fef3c7",
      borderRadius: 8,
      padding: 12,
      marginTop: 10,
      borderLeftWidth: 3,
      borderLeftColor: "#f59e0b",
    },
    bookingInfoTitle: {
      fontSize: 14,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
      marginBottom: 4,
    },
    bookingInfoText: {
      fontSize: 12,
      color: isDark ? "#ccc" : "#666",
      marginTop: 2,
    },
    modalCloseBtn: {
      position: "absolute",
      top: 15,
      right: 15,
      zIndex: 10,
      padding: 5,
    },
    formSection: {
      marginBottom: 20,
    },
    formSectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#fff" : "#000",
      marginBottom: 10,
    },
    guestInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    guestName: {
      fontSize: 16,
      color: isDark ? "#fff" : "#000",
      marginLeft: 10,
      fontWeight: "500",
    },
    guestPhone: {
      fontSize: 14,
      color: isDark ? "#aaa" : "#666",
      marginLeft: 10,
    },
    dateTimeRow: {
      flexDirection: "row",
      gap: 12,
    },
    dateInput: {
      flex: 2,
    },
    timeInput: {
      flex: 1,
    },
    inputLabel: {
      fontSize: 12,
      color: isDark ? "#aaa" : "#666",
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      color: isDark ? "#fff" : "#000",
      borderWidth: 1,
      borderColor: isDark ? "#444" : "#e5e7eb",
    },
    datePickerBtn: {
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDark ? "#444" : "#e5e7eb",
    },
    datePickerText: {
      fontSize: 14,
      color: isDark ? "#fff" : "#000",
      marginLeft: 10,
    },
    placeholderText: {
      color: isDark ? "#666" : "#999",
    },
    calendarOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    calendarContainer: {
      backgroundColor: isDark ? "#2a2a2a" : "#fff",
      borderRadius: 16,
      padding: 20,
      width: "100%",
      maxWidth: 350,
    },
    calendarHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    calendarTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
    },
    weekDays: {
      flexDirection: "row",
      marginBottom: 10,
    },
    weekDay: {
      flex: 1,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "600",
      color: isDark ? "#aaa" : "#666",
    },
    daysGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    dayCell: {
      width: "14.28%",
      aspectRatio: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    dayCellDisabled: {
      opacity: 0.3,
    },
    dayText: {
      fontSize: 16,
      color: isDark ? "#fff" : "#000",
    },
    dayTextDisabled: {
      color: isDark ? "#555" : "#ccc",
    },
    calendarCloseBtn: {
      marginTop: 20,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? "#555" : "#ddd",
      alignItems: "center",
    },
    calendarCloseBtnText: {
      fontSize: 16,
      color: isDark ? "#fff" : "#000",
      fontWeight: "600",
    },
    priceBreakdown: {
      backgroundColor: isDark ? "#333" : "#f0fdf4",
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? "#444" : "#bbf7d0",
    },
    priceBreakdownTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
      marginBottom: 12,
    },
    priceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    priceLabel: {
      fontSize: 14,
      color: isDark ? "#aaa" : "#666",
    },
    priceValue: {
      fontSize: 14,
      color: isDark ? "#fff" : "#000",
    },
    priceDivider: {
      height: 1,
      backgroundColor: isDark ? "#444" : "#d1d5db",
      marginVertical: 10,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
    },
    totalValue: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#059669",
    },
    // GST Options Styles
    gstOption: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#333" : "#f8f9fa",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: isDark ? "#444" : "#e5e7eb",
    },
    gstOptionSelected: {
      borderColor: "#800000",
      backgroundColor: isDark ? "#4a1a1a" : "#fef2f2",
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: isDark ? "#666" : "#d1d5db",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    radioButtonSelected: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#800000",
    },
    gstOptionContent: {
      flex: 1,
    },
    gstOptionTitle: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 4,
    },
    gstOptionSubtitle: {
      fontSize: 12,
      color: isDark ? "#aaa" : "#666",
    },
    // Input Group Styles
    inputGroup: {
      marginBottom: 16,
    },
    // Text Color Styles
    textDark: {
      color: "#fff",
    },
    textLight: {
      color: "#000",
    },
    // Time Picker Styles
    timePickerBtn: {
      backgroundColor: isDark ? "#333" : "#f3f4f6",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDark ? "#444" : "#e5e7eb",
    },
    timePickerText: {
      fontSize: 14,
      color: isDark ? "#fff" : "#000",
      marginLeft: 10,
    },
    // Time Slot Modal Styles
    timeSlotOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    timeSlotContainer: {
      backgroundColor: isDark ? "#2a2a2a" : "#fff",
      borderRadius: 16,
      padding: 20,
      width: "100%",
      maxWidth: 350,
      maxHeight: "80%",
    },
    timeSlotHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    timeSlotTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#000",
    },
    timeSlotList: {
      maxHeight: 400,
    },
    timeSlotItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: isDark ? "#333" : "#f8f9fa",
      borderWidth: 1,
      borderColor: isDark ? "#444" : "#e5e7eb",
    },
    timeSlotItemSelected: {
      backgroundColor: "#800000",
      borderColor: "#800000",
    },
    timeSlotItemDisabled: {
      backgroundColor: isDark ? "#1a1a1a" : "#f3f4f6",
      opacity: 0.5,
    },
    timeSlotText: {
      fontSize: 16,
      color: isDark ? "#fff" : "#000",
    },
    timeSlotTextSelected: {
      color: "#fff",
      fontWeight: "600",
    },
    timeSlotTextDisabled: {
      color: isDark ? "#555" : "#999",
    },
    bookedIndicator: {
      backgroundColor: "#dc2626",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    bookedIndicatorText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "600",
    },
    timeSlotCloseBtn: {
      marginTop: 20,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? "#555" : "#ddd",
      alignItems: "center",
    },
    timeSlotCloseBtnText: {
      fontSize: 16,
      color: isDark ? "#fff" : "#000",
      fontWeight: "600",
    },
    // Calendar Booking Indicators
    dayCellFullyBooked: {
      backgroundColor: "#dc2626",
    },
    dayTextFullyBooked: {
      color: "#fff",
    },
    availableIndicator: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#22c55e",
    },
    partialBookingIndicator: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#f59e0b",
    },
    fullBookingIndicator: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#fff",
    },
    // Calendar Legend Styles
    calendarLegend: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#444" : "#e5e7eb",
      marginBottom: 10,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
      color: isDark ? "#fff" : "#000",
    },
    // Calendar Loading Styles
    calendarLoadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      gap: 8,
    },
    calendarLoadingText: {
      fontSize: 12,
      color: isDark ? "#aaa" : "#666",
    },
    // Calendar Info Styles
    calendarInfo: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: isDark ? "#333" : "#f8f9fa",
      borderRadius: 6,
      marginBottom: 10,
    },
    calendarInfoText: {
      fontSize: 11,
      color: isDark ? "#aaa" : "#666",
      textAlign: "center",
    },
  });

export default RoomBooking;
