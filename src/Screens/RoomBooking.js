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

const API_BASE = "http://192.168.1.24:9000";

// Helper function to get proper image URL
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  // If it's already a full URL (S3 or http), return as is
  if (imagePath.startsWith("http")) return imagePath;
  // For local storage paths, prepend the base URL
  return `${API_BASE}/${imagePath}`;
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
  });
  
  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarFor, setCalendarFor] = useState('checkIn'); // 'checkIn' or 'checkOut'
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Open calendar for date selection
  const openCalendar = (type) => {
    setCalendarFor(type);
    setCalendarMonth(new Date());
    setShowCalendar(true);
  };

  // Select date from calendar
  const selectDate = (day) => {
    const year = calendarMonth.getFullYear();
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    
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

  // Calculate price with GST (Karnataka - 12% total: 6% CGST + 6% SGST for rooms < ₹7500)
  // For rooms >= ₹7500, GST is 18% (9% CGST + 9% SGST)
  const calculatePrice = () => {
    if (!selectedRoom) return { baseAmount: 0, cgst: 0, sgst: 0, totalAmount: 0, nights: 0 };
    
    const nights = calculateNights();
    const baseAmount = selectedRoom.price * nights;
    
    // Karnataka GST rates for hotels
    // Below ₹7500 per night: 12% GST (6% CGST + 6% SGST)
    // ₹7500 and above per night: 18% GST (9% CGST + 9% SGST)
    const gstRate = selectedRoom.price >= 7500 ? 0.09 : 0.06;
    
    const cgst = baseAmount * gstRate;
    const sgst = baseAmount * gstRate;
    const totalAmount = baseAmount + cgst + sgst;
    
    return {
      nights,
      baseAmount,
      cgst,
      sgst,
      gstPercent: gstRate * 100,
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

  // Get user ID and data on mount
  useEffect(() => {
    const getUserData = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
          // Fetch user details from API
          const response = await fetch(`${API_BASE}/api/v1/hotel/user-auth/${storedUserId}`);
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
      const response = await fetch("http://192.168.1.24:9000/api/v1/hotel/branch");
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
        ? `http://192.168.1.24:9000/api/v1/hotel/room?branchId=${selectedBranch}`
        : "http://192.168.1.24:9000/api/v1/hotel/room";
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
    try {
      const bookingsMap = {};
      for (const room of roomsList) {
        const response = await fetch(`${API_BASE}/api/v1/hotel/room-booking/room/${room._id}/active`);
        const booking = await response.json();
        if (booking) {
          bookingsMap[room._id] = booking;
        }
      }
      setRoomBookings(bookingsMap);
    } catch (error) {
      console.error("Error fetching room bookings:", error);
    }
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
    // Reset form
    setBookingForm({
      checkInDate: '',
      checkOutDate: '',
      checkInTime: '12:00',
      checkOutTime: '11:00',
    });
    setShowBookingModal(true);
  };

  // Confirm booking
  const confirmBooking = async () => {
    if (!bookingForm.checkInDate || !bookingForm.checkOutDate) {
      Alert.alert("Error", "Please select check-in and check-out dates");
      return;
    }

    setBookingLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/hotel/room-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: selectedRoom._id,
          branchId: selectedRoom.branchId?._id || selectedRoom.branchId,
          userId: userId,
          userName: userData?.name || 'Guest',
          userPhone: userData?.phone || '',
          userEmail: userData?.email || '',
          checkInDate: bookingForm.checkInDate,
          checkOutDate: bookingForm.checkOutDate,
          checkInTime: bookingForm.checkInTime,
          checkOutTime: bookingForm.checkOutTime,
          totalPrice: calculatePrice().totalAmount,
          nights: calculatePrice().nights,
          baseAmount: calculatePrice().baseAmount,
          cgst: calculatePrice().cgst,
          sgst: calculatePrice().sgst,
        }),
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
    const isBooked = !room.isAvailable || booking;

    return (
      <TouchableOpacity
        style={styles.roomCard}
        onPress={() => {
          setSelectedRoom(room);
          setShowRoomModal(true);
        }}
      >
        <Image
          source={{ uri: room.images && room.images[0] ? getImageUrl(room.images[0]) : "https://via.placeholder.com/300x200" }}
          style={styles.roomImage}
        />
        {isBooked && (
          <View style={styles.bookedBadge}>
            <Text style={styles.bookedBadgeText}>BOOKED</Text>
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
          
          {/* Show booking info - only show details if it's the current user's booking */}
          {booking && (
            <View style={styles.bookingInfoCard}>
              {booking.userId === userId ? (
                <>
                  <Text style={styles.bookingInfoTitle}>Your Booking</Text>
                  <Text style={styles.bookingInfoText}>
                    Check-in: {formatDate(booking.checkInDate)} at {booking.checkInTime}
                  </Text>
                  <Text style={styles.bookingInfoText}>
                    Check-out: {formatDate(booking.checkOutDate)} at {booking.checkOutTime}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.bookingInfoTitle}>Room is Booked</Text>
                  <Text style={styles.bookingInfoText}>
                    Available from: {formatDate(booking.checkOutDate)}
                  </Text>
                </>
              )}
            </View>
          )}

          <View style={styles.roomFooter}>
            <Text style={styles.price}>₹{room.price}</Text>
            <TouchableOpacity
              style={[styles.bookButtonSmall, isBooked && styles.bookButtonDisabled]}
              disabled={isBooked}
              onPress={() => handleBookRoom(room)}
            >
              <Text style={styles.bookButtonSmallText}>
                {isBooked ? "Booked" : "Book"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const RoomDetailModal = () => {
    if (!selectedRoom) return null;

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
                    <Image key={index} source={{ uri: getImageUrl(image) }} style={styles.modalImage} />
                  ))
                ) : (
                  <Image source={{ uri: "https://via.placeholder.com/400x300" }} style={styles.modalImage} />
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

                {/* Show booking info if booked - only show details if it's the current user's booking */}
                {roomBookings[selectedRoom._id] && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Booking Status</Text>
                    <View style={styles.bookingInfoCard}>
                      {roomBookings[selectedRoom._id].userId === userId ? (
                        <>
                          <Text style={styles.bookingInfoTitle}>Your Booking</Text>
                          <Text style={styles.bookingInfoText}>
                            Check-in: {formatDate(roomBookings[selectedRoom._id].checkInDate)} at {roomBookings[selectedRoom._id].checkInTime}
                          </Text>
                          <Text style={styles.bookingInfoText}>
                            Check-out: {formatDate(roomBookings[selectedRoom._id].checkOutDate)} at {roomBookings[selectedRoom._id].checkOutTime}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.bookingInfoTitle}>This room is currently booked</Text>
                          <Text style={styles.bookingInfoText}>
                            Available from: {formatDate(roomBookings[selectedRoom._id].checkOutDate)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.priceSection}>
                  <View>
                    <Text style={styles.priceLabelLarge}>Price</Text>
                    <Text style={styles.priceLarge}>₹{selectedRoom.price}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.bookButton, (!selectedRoom.isAvailable || roomBookings[selectedRoom._id]) && styles.bookButtonDisabled]}
                    disabled={!selectedRoom.isAvailable || roomBookings[selectedRoom._id]}
                    onPress={() => handleBookRoom(selectedRoom)}
                  >
                    <Text style={styles.bookButtonText}>
                      {(!selectedRoom.isAvailable || roomBookings[selectedRoom._id]) ? "Booked" : "Book Now"}
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
                    <View style={styles.guestInfo}>
                      <Icon name="person" size={20} color="#800000" />
                      <Text style={styles.guestName}>{userData?.name || 'Guest'}</Text>
                    </View>
                    {userData?.phone && (
                      <View style={styles.guestInfo}>
                        <Icon name="phone" size={20} color="#800000" />
                        <Text style={styles.guestPhone}>{userData.phone}</Text>
                      </View>
                    )}
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
                      <View style={styles.timeInput}>
                        <Text style={styles.inputLabel}>Time</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="12:00"
                          placeholderTextColor={isDark ? "#666" : "#999"}
                          value={bookingForm.checkInTime}
                          onChangeText={(text) => setBookingForm({...bookingForm, checkInTime: text})}
                        />
                      </View>
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
                      <View style={styles.timeInput}>
                        <Text style={styles.inputLabel}>Time</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="11:00"
                          placeholderTextColor={isDark ? "#666" : "#999"}
                          value={bookingForm.checkOutTime}
                          onChangeText={(text) => setBookingForm({...bookingForm, checkOutTime: text})}
                        />
                      </View>
                    </View>
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
                            
                            <View style={styles.priceRow}>
                              <Text style={styles.priceLabel}>CGST ({priceDetails.gstPercent}%)</Text>
                              <Text style={styles.priceValue}>₹{priceDetails.cgst.toFixed(2)}</Text>
                            </View>
                            
                            <View style={styles.priceRow}>
                              <Text style={styles.priceLabel}>SGST ({priceDetails.gstPercent}%)</Text>
                              <Text style={styles.priceValue}>₹{priceDetails.sgst.toFixed(2)}</Text>
                            </View>
                            
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
              <TouchableOpacity onPress={() => changeMonth(-1)}>
                <Icon name="chevron-left" size={28} color={isDark ? "#fff" : "#000"} />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)}>
                <Icon name="chevron-right" size={28} color={isDark ? "#fff" : "#000"} />
              </TouchableOpacity>
            </View>

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
                  const isDisabled = isPastDate(day);
                  days.push(
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayCell, isDisabled && styles.dayCellDisabled]}
                      onPress={() => !isDisabled && selectDate(day)}
                      disabled={isDisabled}
                    >
                      <Text style={[styles.dayText, isDisabled && styles.dayTextDisabled]}>{day}</Text>
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
  });

export default RoomBooking;
