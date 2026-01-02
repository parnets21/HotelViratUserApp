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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MyTableReservations = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  const [cancellingReservation, setCancellingReservation] = useState(null);

  // Listen for system color scheme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Base URL for API
  const BASE_URL = 'https://hotelvirat.com';

  // Fetch user's table reservations
  const fetchTableReservations = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        throw new Error('User ID not found');
      }

      console.log('Fetching reservations for userId:', userId);

      // Get user data to match by phone number as fallback
      const userResponse = await fetch(`${BASE_URL}/api/v1/hotel/user-auth/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      let userPhone = null;
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userPhone = userData.mobile;
        console.log('User phone for matching:', userPhone);
      }

      // First, let's try to get all reservations to see what's available
      const allReservationsResponse = await fetch(`${BASE_URL}/api/v1/hotel/reservation`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('All reservations API response status:', allReservationsResponse.status);
      const allReservationsData = await allReservationsResponse.json();
      console.log('All reservations count:', allReservationsData.length);
      
      if (allReservationsData.length > 0) {
        console.log('Sample reservation:', allReservationsData[0]);
        console.log('Sample customerId type:', typeof allReservationsData[0].customerId);
        console.log('Sample customerId value:', allReservationsData[0].customerId);
      }

      // Try to filter reservations by customerId or phone number
      let userReservations = [];

      // Method 1: Filter by customerId (if it's a string match)
      userReservations = allReservationsData.filter(reservation => {
        const customerIdMatch = reservation.customerId === userId || 
                              (reservation.customerId && reservation.customerId._id === userId) ||
                              (reservation.customerId && reservation.customerId.toString() === userId);
        
        const phoneMatch = userPhone && reservation.customerPhone === userPhone;
        
        return customerIdMatch || phoneMatch;
      });

      console.log('Filtered user reservations:', userReservations);

      if (userReservations.length > 0) {
        // Sort reservations by creation date (newest first)
        const sortedReservations = userReservations.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        console.log('Sorted reservations:', sortedReservations);
        setReservations(sortedReservations);
      } else {
        console.log('No reservations found for user');
        setReservations([]);
      }

    } catch (error) {
      console.error('Error fetching table reservations:', error);
      Alert.alert('Error', 'Failed to load table reservations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchTableReservations();
  };

  // Fetch data on mount and when screen is focused
  useEffect(() => {
    if (isFocused) {
      setLoading(true);
      fetchTableReservations();
    }
  }, [isFocused]);

  // Cancel reservation
  const cancelReservation = async (reservationId) => {
    Alert.alert(
      "Cancel Reservation",
      "Are you sure you want to cancel this table reservation?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: () => submitCancellation(reservationId)
        }
      ]
    );
  };

  const submitCancellation = async (reservationId) => {
    setCancellingReservation(reservationId);
    try {
      const response = await fetch(`${BASE_URL}/api/v1/hotel/reservation/${reservationId}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        Alert.alert('Success', 'Reservation cancelled successfully');
        fetchTableReservations(); // Refresh the list
      } else {
        const data = await response.json();
        Alert.alert('Error', data.message || 'Failed to cancel reservation');
      }
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      Alert.alert('Error', 'Failed to cancel reservation');
    } finally {
      setCancellingReservation(null);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return '#059669';
      case 'reserved': return '#f59e0b';
      case 'cancelled': return '#dc2626';
      case 'completed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Get status display text
  const getStatusText = (status) => {
    switch (status) {
      case 'reserved': return 'RESERVED';
      case 'confirmed': return 'CONFIRMED';
      case 'cancelled': return 'CANCELLED';
      case 'completed': return 'COMPLETED';
      default: return status.toUpperCase();
    }
  };

  // Render reservation item
  const renderReservationItem = ({ item }) => {
    const canCancel = item.status === 'reserved' || item.status === 'confirmed';

    return (
      <View style={[
        styles.reservationCard, 
        colorScheme === 'dark' ? styles.reservationCardDark : styles.reservationCardLight
      ]}>
        {/* Header */}
        <View style={styles.reservationHeader}>
          <View style={styles.tableInfo}>
            <Icon name="restaurant" size={20} color="#800000" />
            <Text style={[styles.tableName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              Table {item.tableId?.number || 'N/A'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        {/* Branch Info */}
        <View style={styles.branchInfo}>
          <Icon name="location-on" size={16} color="#666" />
          <Text style={[styles.branchText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            {item.tableId?.branchId?.name || item.branchId?.name || 'Branch not available'}
          </Text>
        </View>

        {/* Reservation Details */}
        <View style={styles.reservationDetails}>
          <View style={styles.detailRow}>
            <Icon name="calendar-today" size={16} color="#800000" />
            <Text style={[styles.detailText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              {formatDate(item.reservationDate)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="access-time" size={16} color="#800000" />
            <Text style={[styles.detailText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              {item.timeSlot}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="people" size={16} color="#800000" />
            <Text style={[styles.detailText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              {item.guestCount} {item.guestCount === 1 ? 'Guest' : 'Guests'}
            </Text>
          </View>
        </View>

        {/* Special Notes */}
        {item.notes && (
          <View style={styles.notesSection}>
            <Text style={[styles.notesLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              Special Notes:
            </Text>
            <Text style={[styles.notesText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              {item.notes}
            </Text>
          </View>
        )}

        {/* Actions */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => cancelReservation(item._id)}
            disabled={cancellingReservation === item._id}
          >
            {cancellingReservation === item._id ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <>
                <Icon name="cancel" size={16} color="#dc2626" />
                <Text style={styles.cancelButtonText}>Cancel Reservation</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Booking Date */}
        <Text style={[styles.bookingDate, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
          Booked on {formatDate(item.createdAt)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <StatusBar backgroundColor={colorScheme === 'dark' ? "#1a1a1a" : "#fff"} barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />
        
        {/* Header */}
        <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
            <Icon name="arrow-back" size={24} color="#800000" />
          </TouchableOpacity>
          <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            My Table Reservations
          </Text>
          <View style={styles.headerIcon} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#800000" />
          <Text style={[styles.loadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            Loading reservations...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar backgroundColor={colorScheme === 'dark' ? "#1a1a1a" : "#fff"} barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Icon name="arrow-back" size={24} color="#800000" />
        </TouchableOpacity>
        <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
          My Table Reservations
        </Text>
        <TouchableOpacity onPress={onRefresh} style={styles.headerIcon}>
          <Icon name="refresh" size={24} color="#800000" />
        </TouchableOpacity>
      </View>

      {/* Reservations List */}
      {reservations.length > 0 ? (
        <FlatList
          data={reservations}
          renderItem={renderReservationItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#800000']}
              tintColor="#800000"
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="restaurant" size={80} color="#ccc" />
          <Text style={[styles.emptyTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            No Table Reservations
          </Text>
          <Text style={[styles.emptySubtitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            You haven't made any table reservations yet.
          </Text>
          <TouchableOpacity
            style={styles.bookTableButton}
            onPress={() => {
              // Navigate to Home tab
              navigation.navigate('Tabs', {
                screen: 'Home'
              });
            }}
          >
            <Icon name="restaurant" size={20} color="#fff" />
            <Text style={styles.bookTableButtonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
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
  headerIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  textLight: {
    color: '#333',
  },
  textDark: {
    color: '#e5e5e5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  reservationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  reservationCardLight: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  reservationCardDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#444',
  },
  reservationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tableName: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  branchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  branchText: {
    fontSize: 14,
    marginLeft: 6,
    color: '#666',
  },
  reservationDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    marginLeft: 8,
  },
  notesSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 12,
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  bookingDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  bookTableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#800000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  bookTableButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default MyTableReservations;