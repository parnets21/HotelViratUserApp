import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '../context/CartContext';

const MySubscriptionsScreen = () => {
  const navigation = useNavigation();
  const { selectedBranch } = useCart();
  const [loading, setLoading] = useState(true);
  const [subscriptionOrders, setSubscriptionOrders] = useState([]);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      getUserId();
      
      // Set a timeout to stop loading after 5 seconds
      const timeoutId = setTimeout(() => {
        setLoading(false);
      }, 5000);
      
      return () => clearTimeout(timeoutId);
    }, [])
  );

  useEffect(() => {
    if (userId) {
      fetchSubscriptionOrders();
    }
  }, [userId]);

  const getUserId = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedUserId) {
        console.log('Found userId in storage:', storedUserId);
        setUserId(storedUserId);
      } else {
        console.log('No userId found in storage');
        setLoading(false); // Stop loading if no user is logged in
      }
    } catch (error) {
      console.error('Error fetching user ID:', error);
      setLoading(false); // Stop loading on error
    }
  };

  const fetchSubscriptionOrders = async () => {
    if (!userId) {
      console.log('Missing userId, skipping subscription fetch');
      console.log('userId:', userId);
      setLoading(false);
      return;
    }
    
    console.log('Fetching subscriptions for userId:', userId);
    setLoading(true);
    try {
      // Add timeout protection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const url = `http://192.168.1.24:9000/api/v1/hotel/subscription-order/user/${userId}`;
      console.log('API URL:', url);
      
      const response = await fetch(url, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.success) {
        console.log('Found subscriptions:', data.data.length);
        setSubscriptionOrders(data.data);
        setError(null); // Clear any previous errors
      } else {
        console.error('Failed to fetch subscriptions:', data.message);
        setSubscriptionOrders([]);
        setError(data.message || 'Failed to load subscriptions');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Request timed out');
        setError('Request timed out. Please check your connection.');
      } else {
        console.error('Error fetching subscription orders:', error);
        setError('Failed to load subscriptions. Please try again.');
      }
      setSubscriptionOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const pauseSubscription = async (subscriptionId) => {
    Alert.alert(
      'Pause Subscription',
      'Are you sure you want to pause this subscription?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause',
          onPress: async () => {
            try {
              const response = await fetch(`http://192.168.1.24:9000/api/v1/hotel/subscription-order/${subscriptionId}/pause`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  pauseReason: 'User requested pause',
                }),
              });

              const data = await response.json();
              
              if (data.success) {
                Alert.alert('Success', 'Subscription paused successfully!');
                fetchSubscriptionOrders();
              } else {
                Alert.alert('Error', data.message);
              }
            } catch (error) {
              console.error('Error pausing subscription:', error);
              Alert.alert('Error', 'Failed to pause subscription');
            }
          },
        },
      ]
    );
  };

  const resumeSubscription = async (subscriptionId) => {
    try {
      const response = await fetch(`http://192.168.1.24:9000/api/v1/hotel/subscription-order/${subscriptionId}/resume`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', 'Subscription resumed successfully!');
        fetchSubscriptionOrders();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      console.error('Error resuming subscription:', error);
      Alert.alert('Error', 'Failed to resume subscription');
    }
  };

  const cancelSubscription = async (subscriptionId) => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel this subscription? This action cannot be undone.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`http://192.168.1.24:9000/api/v1/hotel/subscription-order/${subscriptionId}/cancel`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  cancellationReason: 'User requested cancellation',
                }),
              });

              const data = await response.json();
              
              if (data.success) {
                Alert.alert('Success', 'Subscription cancelled successfully!');
                fetchSubscriptionOrders();
              } else {
                Alert.alert('Error', data.message);
              }
            } catch (error) {
              console.error('Error cancelling subscription:', error);
              Alert.alert('Error', 'Failed to cancel subscription');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'paused': return '#FF9800';
      case 'cancelled': return '#F44336';
      case 'completed': return '#9E9E9E';
      default: return '#666';
    }
  };

  const getPlanTypeColor = (type) => {
    switch (type) {
      case 'daily': return '#2196F3';
      case 'weekly': return '#9C27B0';
      case 'monthly': return '#FF5722';
      case 'yearly': return '#4CAF50';
      default: return '#666';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDeliveryIcon = (status) => {
    switch (status) {
      case 'scheduled': return 'schedule';
      case 'out_for_delivery': return 'local-shipping';
      case 'delivered': return 'check-circle';
      case 'failed': return 'error';
      case 'rescheduled': return 'update';
      default: return 'schedule';
    }
  };

  const getDeliveryColor = (status) => {
    switch (status) {
      case 'scheduled': return '#FF9800';
      case 'out_for_delivery': return '#2196F3';
      case 'delivered': return '#4CAF50';
      case 'failed': return '#F44336';
      case 'rescheduled': return '#9C27B0';
      default: return '#FF9800';
    }
  };

  const getDeliveryStatusText = (status) => {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'failed': return 'Delivery Failed';
      case 'rescheduled': return 'Rescheduled';
      default: return 'Scheduled';
    }
  };

  const renderSubscriptionCard = (subscription) => (
    <View key={subscription._id} style={styles.subscriptionCard}>
      <View style={styles.subscriptionHeader}>
        <Image 
          source={subscription.productId?.image ? { uri: subscription.productId.image } : require('../assets/lemon.jpg')} 
          style={styles.productImage} 
        />
        <View style={styles.subscriptionInfo}>
          <Text style={styles.productName}>{subscription.productId?.name}</Text>
          <Text style={styles.subscriptionType}>
            {subscription.planType.toUpperCase()} • ₹{subscription.price}
          </Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription.status) }]}>
              <Text style={styles.statusText}>{subscription.status}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.subscriptionDetails}>
        <View style={styles.detailRow}>
          <Icon name="location-on" size={16} color="#666" />
          <Text style={styles.detailText}>{subscription.deliveryAddress}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="schedule" size={16} color="#666" />
          <Text style={styles.detailText}>Days: {subscription.deliveryDays?.join(', ')}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="access-time" size={16} color="#666" />
          <Text style={styles.detailText}>Time: {subscription.deliveryTime}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="payment" size={16} color="#666" />
          <Text style={styles.detailText}>Payment: {subscription.paymentMethod?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        {subscription.status === 'active' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.pauseButton]}
            onPress={() => pauseSubscription(subscription._id)}
          >
            <Icon name="pause" size={16} color="white" />
            <Text style={styles.actionButtonText}>Pause</Text>
          </TouchableOpacity>
        )}
        
        {subscription.status === 'paused' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.resumeButton]}
            onPress={() => resumeSubscription(subscription._id)}
          >
            <Icon name="play-arrow" size={16} color="white" />
            <Text style={styles.actionButtonText}>Resume</Text>
          </TouchableOpacity>
        )}
        
        {subscription.status !== 'cancelled' && subscription.status !== 'completed' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => cancelSubscription(subscription._id)}
          >
            <Icon name="cancel" size={16} color="white" />
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Delivery History */}
      {subscription.deliveryTracking && subscription.deliveryTracking.length > 0 && (
        <View style={styles.deliveryHistory}>
          <Text style={styles.historyTitle}>Delivery Tracking</Text>
          {subscription.deliveryTracking.slice(0, 5).map((delivery, index) => (
            <View key={index} style={styles.deliveryItem}>
              <View style={styles.deliveryIcon}>
                <Icon 
                  name={getDeliveryIcon(delivery.status)} 
                  size={16} 
                  color={getDeliveryColor(delivery.status)} 
                />
              </View>
              <View style={styles.deliveryContent}>
                <View style={styles.deliveryHeader}>
                  <Text style={styles.deliveryStatus}>
                    {getDeliveryStatusText(delivery.status)}
                  </Text>
                  <Text style={styles.deliveryDate}>
                    {formatDate(delivery.scheduledDate)}
                  </Text>
                </View>
                {delivery.actualDeliveryDate && (
                  <Text style={styles.actualDeliveryDate}>
                    Delivered: {formatDate(delivery.actualDeliveryDate)}
                  </Text>
                )}
                {delivery.deliveryPerson && (
                  <Text style={styles.deliveryPerson}>
                    By: {delivery.deliveryPerson.name}
                  </Text>
                )}
                {delivery.deliveryNotes && (
                  <Text style={styles.deliveryNotes}>{delivery.deliveryNotes}</Text>
                )}
                {delivery.rating && (
                  <View style={styles.ratingContainer}>
                    <Text style={styles.ratingText}>Rating: </Text>
                    {[...Array(5)].map((_, i) => (
                      <Icon 
                        key={i} 
                        name="star" 
                        size={12} 
                        color={i < delivery.rating ? "#FFD700" : "#ccc"} 
                      />
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading subscriptions...</Text>
        <Text style={styles.loadingSubtext}>This may take a few moments</Text>
      </View>
    );
  }

  // Check if user is logged in
  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#800000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Subscriptions</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="person-off" size={64} color="#ccc" />
          <Text style={styles.errorTitle}>Please Login</Text>
          <Text style={styles.errorMessage}>You need to be logged in to view your subscriptions.</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.loginButtonText}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state with retry
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#800000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Subscriptions</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color="#ccc" />
          <Text style={styles.errorTitle}>Error Loading</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              fetchSubscriptionOrders();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FFD700" barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#800000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Subscriptions</Text>
        <TouchableOpacity onPress={() => {
          setLoading(true);
          fetchSubscriptionOrders();
        }} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color="#800000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {subscriptionOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="subscription" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Subscriptions Yet</Text>
            <Text style={styles.emptyText}>Subscribe to products to get regular deliveries</Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.browseButtonText}>Browse Products</Text>
            </TouchableOpacity>
          </View>
        ) : (
          subscriptionOrders.map(renderSubscriptionCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFD700',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  refreshButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#800000',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  loadingSubtext: {
    marginTop: 5,
    fontSize: 14,
    color: '#999',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  loginButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  loginButtonText: {
    color: '#800000',
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#800000',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  browseButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  browseButtonText: {
    color: '#800000',
    fontSize: 16,
    fontWeight: '700',
  },
  subscriptionCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
  },
  subscriptionInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  subscriptionType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  statusContainer: {
    alignItems: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  subscriptionDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 5,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  pauseButton: {
    backgroundColor: '#FF9800',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  deliveryHistory: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  historyContent: {
    flex: 1,
  },
  historyAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  historyDate: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    fontStyle: 'italic',
  },
  deliveryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deliveryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deliveryContent: {
    flex: 1,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deliveryStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  deliveryDate: {
    fontSize: 11,
    color: '#666',
  },
  actualDeliveryDate: {
    fontSize: 11,
    color: '#4CAF50',
    marginBottom: 2,
  },
  deliveryPerson: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  deliveryNotes: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 10,
    color: '#666',
    marginRight: 4,
  },
});

export default MySubscriptionsScreen;
