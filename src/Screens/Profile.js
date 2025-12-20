import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  ToastAndroid,
  Platform,
  Alert,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [userData, setUserData] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [helpContact, setHelpContact] = useState(null);
  const [aboutUsData, setAboutUsData] = useState(null);
  const [termsData, setTermsData] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  const [roomBookings, setRoomBookings] = useState([]);
  const [cancellingBooking, setCancellingBooking] = useState(null);

  // Listen for system color scheme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Base URL for API
  const BASE_URL = 'http://192.168.1.24:9000';

  // Fetch user data
  const fetchUserData = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        throw new Error('User ID not found');
      }

      const response = await fetch(`${BASE_URL}/api/v1/hotel/user-auth/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok) {
        // Normalize image path: replace backslashes and ensure correct prefix
        let imagePath = data.image;
        if (imagePath) {
          // Replace backslashes with forward slashes
          imagePath = imagePath.replace(/\\/g, '/');
          // Ensure path starts with /uploads/profile
          if (imagePath.startsWith('uploads/profile/')) {
            imagePath = `${imagePath.split('')[1]}`;
          } else if (!imagePath.startsWith('')) {
            imagePath = `${imagePath.split('/').pop()}`;
          }
          // Construct full URL
          imagePath = `${imagePath}?t=${new Date().getTime()}`;
        }

        const imageUri = imagePath
          ? { uri: imagePath }
          : require("../assets/Profile.jpg");

        console.log('Profile Image URI:', imageUri); // Debug log

        setUserData({
          name: data.name,
          mobile: data.mobile,
          email: data.email || 'Not provided',
          profileImage: imageUri,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showToast('Error fetching user data', 'error');
      console.error('Fetch user data error:', error);
      setUserData({
        name: 'Error',
        mobile: 'N/A',
        email: 'Not provided',
        profileImage: require("../assets/Profile.jpg"),
      });
    }
  };

  // Fetch addresses
  const fetchAddresses = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const response = await fetch(`${BASE_URL}/api/v1/hotel/address/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok) {
        setSavedAddresses(data.map(addr => ({
          id: addr._id,
          type: addr.type,
          address: addr.address,
        })));
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showToast('Error fetching addresses', 'error');
    }
  };

  // Fetch help & support
  const fetchHelpSupport = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/hotel/help-support`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok) {
        setHelpContact({
          mobile: data.mobile,
          email: data.email,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showToast('Error fetching help & support', 'error');
    }
  };

  // Fetch about us
  const fetchAboutUs = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/hotel/about-us`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok) {
        setAboutUsData({
          description: data.description,
          mission: data.mission,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showToast('Error fetching about us', 'error');
    }
  };

  // Fetch terms
  const fetchTerms = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/hotel/terms`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok) {
        setTermsData({
          terms: data.map(term => ({
            id: term._id,
            title: term.title,
            description: term.description,
          })),
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showToast('Error fetching terms', 'error');
    }
  };

  // Fetch room bookings
  const fetchRoomBookings = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;
      
      const response = await fetch(`${BASE_URL}/api/v1/hotel/room-booking?userId=${userId}`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setRoomBookings(data);
      }
    } catch (error) {
      console.error('Error fetching room bookings:', error);
    }
  };

  // Request cancellation (with 20% deduction)
  const requestCancellation = (booking) => {
    const refundAmount = booking.totalPrice * 0.8; // 80% refund
    const deduction = booking.totalPrice * 0.2; // 20% deduction
    
    Alert.alert(
      "Cancel Booking",
      `Are you sure you want to cancel this booking?\n\nCancellation charges: ₹${deduction.toFixed(2)} (20%)\nRefund amount: ₹${refundAmount.toFixed(2)} (80%)\n\nYour cancellation request will be sent to admin for approval.`,
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: () => submitCancellation(booking._id)
        }
      ]
    );
  };

  const submitCancellation = async (bookingId) => {
    setCancellingBooking(bookingId);
    try {
      const response = await fetch(`${BASE_URL}/api/v1/hotel/room-booking/${bookingId}/request-cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        showToast('Cancellation request submitted. Waiting for admin approval.', 'success');
        fetchRoomBookings();
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to submit cancellation request', 'error');
      }
    } catch (error) {
      showToast('Error submitting cancellation request', 'error');
    } finally {
      setCancellingBooking(null);
    }
  };

  // Format date
  const formatBookingDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return '#059669';
      case 'pending': return '#f59e0b';
      case 'cancel-requested': return '#f97316';
      case 'cancelled': return '#dc2626';
      case 'checked-in': return '#3b82f6';
      case 'checked-out': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Fetch all data
  const fetchAllData = async () => {
    setIsFetching(true);
    await Promise.all([
      fetchUserData(),
      fetchAddresses(),
      fetchHelpSupport(),
      fetchAboutUs(),
      fetchTerms(),
      fetchRoomBookings(),
    ]);
    setIsFetching(false);
  };

  // Fetch data on mount and when screen is focused
  useEffect(() => {
    if (isFocused) {
      fetchAllData();
    }
  }, [isFocused]);

  // Show toast message
  const showToast = (message, type = 'error') => {
    if (Platform.OS === "android") {
      ToastAndroid.showWithGravity(
        message,
        ToastAndroid.LONG,
        ToastAndroid.BOTTOM
      );
    } else {
      Alert.alert(type === 'error' ? 'Error' : 'Success', message);
    }
  };

  // Handle logout
  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          onPress: async () => {
            setIsLoading(true);
            try {
              await AsyncStorage.removeItem('userId');
              setTimeout(() => {
                setIsLoading(false);
                logout();
                showToast("Logged out successfully", 'success');
              }, 800);
            } catch (error) {
              setIsLoading(false);
              showToast("Error logging out", 'error');
            }
          },
          style: "destructive",
        },
      ],
      { cancelable: true }
    );
  };

  const menuSections = [
    {
      title: "Account",
      items: [
        {
          id: "orders",
          title: "My Orders",
          icon: "receipt-long",
          onPress: () => navigation.navigate("MyOrders"),
        },
        {
          id: "roomBookings",
          title: "Room Bookings",
          icon: "hotel",
          onPress: () => setExpandedItem(expandedItem === "roomBookings" ? null : "roomBookings"),
        },
        {
          id: "addresses",
          title: "Saved Addresses",
          icon: "location-on",
          onPress: () => setExpandedItem(expandedItem === "addresses" ? null : "addresses"),
        },
      ],
    },
    {
      title: "Support & About",
      items: [
        {
          id: "help",
          title: "Help & Support",
          icon: "help",
          onPress: () => setExpandedItem(expandedItem === "help" ? null : "help"),
        },
        {
          id: "about",
          title: "About Us",
          icon: "info",
          onPress: () => setExpandedItem(expandedItem === "about" ? null : "about"),
        }, 
       {
  id: "privacy",
  title: "Privacy Policy",
  icon: "policy",
  onPress: () => navigation.navigate("PrivacyPolicy"),
}, 
{
  id: "terms",
  title: "Terms & Conditions",
  icon: "description",
  onPress: () => navigation.navigate("TermsCondition"),
},
        /* {
          id: "terms",
          title: "Terms & Policies",
          icon: "description",
          onPress: () => setExpandedItem(expandedItem === "terms" ? null : "terms"),
        }, */
      ],
    },
  ];

  const renderMenuItem = (item) => (
    <View key={item.id}>
      <TouchableOpacity
        style={[styles.menuItem, colorScheme === 'dark' ? styles.menuItemDark : styles.menuItemLight]}
        onPress={item.onPress}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <View style={styles.menuIconContainer}>
            <Icon name={item.icon} size={22} color="#fff" />
          </View>
          <Text style={[styles.menuItemText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{item.title}</Text>
        </View>
        <View style={styles.menuItemRight}>
          <Icon
            name={expandedItem === item.id ? "expand-less" : "chevron-right"}
            size={22}
            color={colorScheme === 'dark' ? "#888" : "#9ca3af"}
          />
        </View>
      </TouchableOpacity>
      
      {item.id === "help" && expandedItem === "help" && helpContact && (
        <View style={[styles.expandedContent, colorScheme === 'dark' ? styles.expandedContentDark : styles.expandedContentLight]}>
          <View style={styles.contactItem}>
            <View style={styles.contactIcon}>
              <Icon name="phone" size={16} color="#fff" />
            </View>
            <Text style={[styles.contactText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{helpContact.mobile}</Text>
          </View>
          <View style={styles.contactItem}>
            <View style={styles.contactIcon}>
              <Icon name="email" size={16} color="#fff" />
            </View>
            <Text style={[styles.contactText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{helpContact.email}</Text>
          </View>
        </View>
      )}
      
      {item.id === "addresses" && expandedItem === "addresses" && (
        <View style={[styles.expandedContent, colorScheme === 'dark' ? styles.expandedContentDark : styles.expandedContentLight]}>
          {savedAddresses.map((address) => (
            <View key={address.id} style={styles.addressItem}>
              <View style={styles.addressHeader}>
                <View style={styles.addressIcon}>
                  <Icon name="location-on" size={16} color="#fff" />
                </View>
                <Text style={[styles.addressType, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{address.type}</Text>
              </View>
              <Text style={[styles.addressText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{address.address}</Text>
            </View>
          ))}
        </View>
      )}

      {item.id === "roomBookings" && expandedItem === "roomBookings" && (
        <View style={[styles.expandedContent, colorScheme === 'dark' ? styles.expandedContentDark : styles.expandedContentLight]}>
          {roomBookings.length > 0 ? (
            roomBookings.map((booking) => (
              <View key={booking._id} style={[styles.bookingCard, colorScheme === 'dark' ? styles.bookingCardDark : styles.bookingCardLight]}>
                <View style={styles.bookingHeader}>
                  <Text style={[styles.bookingRoomName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                    {booking.roomId?.floor} - Room {booking.roomId?.roomNumber || 'N/A'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                    <Text style={styles.statusText}>{booking.status.replace('-', ' ').toUpperCase()}</Text>
                  </View>
                </View>
                
                <Text style={[styles.bookingBranch, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                  {booking.branchId?.name}
                </Text>
                
                <View style={styles.bookingDates}>
                  <View style={styles.dateItem}>
                    <Icon name="login" size={16} color="#800000" />
                    <Text style={[styles.dateText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                      Check-in: {formatBookingDate(booking.checkInDate)} at {booking.checkInTime}
                    </Text>
                  </View>
                  <View style={styles.dateItem}>
                    <Icon name="logout" size={16} color="#800000" />
                    <Text style={[styles.dateText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                      Check-out: {formatBookingDate(booking.checkOutDate)} at {booking.checkOutTime}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.bookingPriceInfo}>
                  <Text style={[styles.bookingPrice, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                    Total: ₹{booking.totalPrice?.toFixed(2)}
                  </Text>
                  <Text style={styles.bookingNights}>
                    ({booking.nights} {booking.nights === 1 ? 'Night' : 'Nights'})
                  </Text>
                </View>
                
                {(booking.status === 'confirmed' || booking.status === 'pending') && (
                  <TouchableOpacity
                    style={styles.cancelBookingBtn}
                    onPress={() => requestCancellation(booking)}
                    disabled={cancellingBooking === booking._id}
                  >
                    {cancellingBooking === booking._id ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <Text style={styles.cancelBookingText}>Request Cancellation</Text>
                    )}
                  </TouchableOpacity>
                )}
                
                {booking.status === 'cancel-requested' && (
                  <Text style={styles.pendingCancelText}>Cancellation pending admin approval</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={[styles.noBookingsText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              No room bookings yet
            </Text>
          )}
        </View>
      )}
      
      {item.id === "about" && expandedItem === "about" && aboutUsData && (
        <View style={[styles.expandedContent, colorScheme === 'dark' ? styles.expandedContentDark : styles.expandedContentLight]}>
          <Text style={[styles.aboutText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{aboutUsData.description}</Text>
          <View style={styles.missionContainer}>
            <View style={styles.missionIcon}>
              <Icon name="favorite" size={16} color="#fff" />
            </View>
            <Text style={[styles.missionText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              <Text style={[styles.missionLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Mission: </Text>
              {aboutUsData.mission}
            </Text>
          </View>
        </View>
      )}
      
      {item.id === "terms" && expandedItem === "terms" && termsData && (
        <View style={[styles.expandedContent, colorScheme === 'dark' ? styles.expandedContentDark : styles.expandedContentLight]}>
          {termsData.terms.map((term) => (
            <View key={term.id} style={styles.termItem}>
              <View style={styles.termHeader}>
                <View style={styles.termIcon}>
                  <Icon name="description" size={16} color="#fff" />
                </View>
                <Text style={[styles.termTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{term.title}</Text>
              </View>
              <Text style={[styles.termText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{term.description}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (isFetching) {
    return (
      <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <StatusBar backgroundColor={colorScheme === 'dark' ? "#1a1a1a" : "#fff"} barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar backgroundColor={colorScheme === 'dark' ? "#1a1a1a" : "#fff"} barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />
      
      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <Text style={[styles.headerTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>My Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {userData && (
          <View style={[styles.profileCard, colorScheme === 'dark' ? styles.profileCardDark : styles.profileCardLight]}>
            <View style={styles.profileHeader}>
              <View style={styles.profileImageContainer}>
                <Image
                  source={userData.profileImage}
                  style={styles.profileImage}
                  onError={(e) => {
                    console.log('Image load error:', e.nativeEvent.error);
                    setUserData(prev => ({
                      ...prev,
                      profileImage: require("../assets/Profile.jpg"),
                    }));
                  }}
                  defaultSource={require("../assets/Profile.jpg")}
                />
              </View>
              <View style={styles.profileInfo}>
                <View style={styles.nameEditContainer}>
                  <Text style={[styles.profileName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{userData.name}</Text>
                  <TouchableOpacity
                    style={styles.editIconContainer}
                    onPress={() => navigation.navigate("EditProfile", { userData })}
                  >
                    <Icon name="edit" size={20} color="#800000" />
                  </TouchableOpacity>
                </View>
                <View style={styles.profileDetail}>
                  <View style={styles.detailIcon}>
                    <Icon name="phone" size={14} color="#fff" />
                  </View>
                  <Text style={[styles.profileDetailText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{userData.mobile}</Text>
                </View>
                <View style={styles.profileDetail}>
                  <View style={styles.detailIcon}>
                    <Icon name="email" size={14} color="#fff" />
                  </View>
                  <Text style={[styles.profileDetailText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{userData.email}</Text>
                </View>
                <View style={styles.profileDetail}>
                </View>
              </View>
            </View>
          </View>
        )}

        {menuSections.map((section, index) => (
          <View key={index} style={[styles.sectionContainer, colorScheme === 'dark' ? styles.sectionContainerDark : styles.sectionContainerLight]}>
            <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{section.title}</Text>
            <View style={[styles.menuContainer, colorScheme === 'dark' ? styles.menuContainerDark : styles.menuContainerLight]}>
              {section.items.map(renderMenuItem)}
            </View>
          </View>
        ))}

        <TouchableOpacity 
          style={[styles.logoutButton, colorScheme === 'dark' ? styles.logoutButtonDark : styles.logoutButtonLight]} 
          onPress={handleLogout}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="logout" size={20} color="#fff" style={styles.logoutIcon} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.versionContainer}>
          {/* <Text style={[styles.versionText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Version 1.0.0</Text> */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: "#f8f9fa",
  },
  containerDark: {
    backgroundColor: "#1a1a1a",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
   /*  elevation: 4, */
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  headerLight: {
    backgroundColor: "#fff",
    borderBottomColor: "#e5e7eb",
  },
  headerDark: {
    backgroundColor: "#2a2a2a",
    borderBottomColor: "#444",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  textLight: {
    color: "#333",
  },
  textDark: {
    color: "#e5e5e5",
  },
  profileCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  /*   elevation: 3, */
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  profileCardLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  profileCardDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  profileImageContainer: {
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "#fff",
  },
  profileInfo: {
    marginLeft: 20,
    flex: 1,
  },
  nameEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    flex: 1,
  },
  editIconContainer: {
    padding: 5,
  },
  profileDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  profileDetailText: {
    fontSize: 14,
  },
  detailIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#800000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  sectionContainer: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  sectionContainerLight: {
    backgroundColor: "#f8f9fa",
  },
  sectionContainerDark: {
    backgroundColor: "#1a1a1a",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  menuContainer: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
   /*  elevation: 3, */
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  menuContainerLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  menuContainerDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  menuItemLight: {
    borderBottomColor: "#e5e7eb",
  },
  menuItemDark: {
    borderBottomColor: "#444",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#800000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  menuItemRight: {
    marginLeft: 10,
  },
  expandedContent: {
    padding: 16,
    borderBottomWidth: 1,
  },
  expandedContentLight: {
    backgroundColor: "#f8f9fa",
    borderBottomColor: "#e5e7eb",
  },
  expandedContentDark: {
    backgroundColor: "#2a2a2a",
    borderBottomColor: "#444",
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  contactIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#800000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  contactText: {
    fontSize: 14,
  },
  addressItem: {
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  addressIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#800000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  addressType: {
    fontSize: 14,
    fontWeight: "600",
  },
  addressText: {
    fontSize: 14,
    marginLeft: 34,
    lineHeight: 20,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  missionContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  missionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#800000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  missionText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  missionLabel: {
    fontWeight: "600",
  },
  termItem: {
    marginBottom: 16,
  },
  termHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  termIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#800000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  termTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  termText: {
    fontSize: 14,
    marginLeft: 34,
    lineHeight: 20,
  },
  logoutButton: {
    flexDirection: "row",
    marginHorizontal: 100,
    marginBottom: 16,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
   /*  elevation: 5, */
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  logoutButtonLight: {
    backgroundColor: "#800000",
  },
  logoutButtonDark: {
    backgroundColor: "#4a0000",
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
  },
  versionContainer: {
    alignItems: "center",
  },
  versionText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingCard: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  bookingCardLight: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  bookingCardDark: {
    backgroundColor: '#333',
    borderColor: '#444',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bookingRoomName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookingBranch: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  bookingDates: {
    marginBottom: 10,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    marginLeft: 8,
  },
  bookingPriceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  bookingPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  bookingNights: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  cancelBookingBtn: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelBookingText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingCancelText: {
    color: '#f97316',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  noBookingsText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    paddingVertical: 20,
  },
});

export default Profile;