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
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '../context/CartContext';

const SubscriptionScreen = () => {
  const navigation = useNavigation();
  const { selectedBranch } = useCart();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [userId, setUserId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [subscriptionForm, setSubscriptionForm] = useState({
    subscriptionType: 'weekly',
    quantity: 1,
    deliveryAddress: '',
    deliveryInstructions: '',
    deliveryDays: ['monday', 'wednesday', 'friday'],
    deliveryTime: '09:00',
    paymentMethod: 'cash',
    autoRenew: true,
  });

  useEffect(() => {
    getUserId();
    fetchBranches();
    
    // Set a timeout to stop loading after 10 seconds
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 10000);
    
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchProducts();
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (userId && selectedBranch) {
      fetchSubscriptions();
    }
  }, [userId, selectedBranch]);

  const getUserId = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedUserId) {
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

  const fetchBranches = async () => {
    try {
      const response = await fetch('https://hotelvirat.com/api/v1/hotel/branch');
      const data = await response.json();
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
      setBranches([]); // Set empty array on error
    }
  };

  const fetchProducts = async () => {
    if (!selectedBranch) {
      console.log('No selected branch, skipping product fetch');
      return;
    }
    
    try {
      const response = await fetch(`https://hotelvirat.com/api/v1/hotel/menu?branchId=${selectedBranch}`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]); // Set empty array on error
    }
  };

  const fetchSubscriptions = async () => {
    if (!userId || !selectedBranch) {
      console.log('Missing userId or selectedBranch, skipping subscription fetch');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`https://hotelvirat.com/api/v1/hotel/subscription/user/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setSubscriptions(data.data);
      } else {
        console.error('Failed to fetch subscriptions:', data.message);
        setSubscriptions([]);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const createSubscription = async () => {
    if (!selectedProduct || !subscriptionForm.deliveryAddress) {
      Alert.alert('Error', 'Please select a product and enter delivery address');
      return;
    }

    try {
      const response = await fetch('https://hotelvirat.com/api/v1/hotel/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          productId: selectedProduct._id,
          branchId: selectedBranch,
          ...subscriptionForm,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', 'Subscription created successfully!');
        setShowCreateModal(false);
        setSelectedProduct(null);
        fetchSubscriptions();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      Alert.alert('Error', 'Failed to create subscription');
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
              const response = await fetch(`https://hotelvirat.com/api/v1/hotel/subscription/${subscriptionId}/pause`, {
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
                fetchSubscriptions();
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
      const response = await fetch(`https://hotelvirat.com/api/v1/hotel/subscription/${subscriptionId}/resume`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', 'Subscription resumed successfully!');
        fetchSubscriptions();
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
              const response = await fetch(`https://hotelvirat.com/api/v1/hotel/subscription/${subscriptionId}/cancel`, {
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
                fetchSubscriptions();
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
      case 'expired': return '#9E9E9E';
      default: return '#666';
    }
  };

  const getSubscriptionTypeColor = (type) => {
    switch (type) {
      case 'weekly': return '#2196F3';
      case 'monthly': return '#9C27B0';
      case 'yearly': return '#FF5722';
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
            {subscription.subscriptionType.toUpperCase()} • Qty: {subscription.quantity}
          </Text>
          <Text style={styles.price}>₹{subscription.totalPrice}</Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription.status) }]}>
            <Text style={styles.statusText}>{subscription.status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.subscriptionDetails}>
        <View style={styles.detailRow}>
          <Icon name="schedule" size={16} color="#666" />
          <Text style={styles.detailText}>Next Delivery: {formatDate(subscription.nextDeliveryDate)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="location-on" size={16} color="#666" />
          <Text style={styles.detailText}>{subscription.deliveryAddress}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="schedule" size={16} color="#666" />
          <Text style={styles.detailText}>Days: {subscription.deliveryDays?.join(', ')}</Text>
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
        
        {subscription.status !== 'cancelled' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => cancelSubscription(subscription._id)}
          >
            <Icon name="cancel" size={16} color="white" />
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCreateModal(false)}>
            <Icon name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Create Subscription</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Product</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productSelector}>
              {products.map(product => (
                <TouchableOpacity
                  key={product._id}
                  style={[
                    styles.productOption,
                    selectedProduct?._id === product._id && styles.selectedProduct
                  ]}
                  onPress={() => setSelectedProduct(product)}
                >
                  <Image 
                    source={product.image ? { uri: product.image } : require('../assets/lemon.jpg')} 
                    style={styles.productOptionImage} 
                  />
                  <Text style={styles.productOptionName}>{product.name}</Text>
                  <Text style={styles.productOptionPrice}>₹{product.price}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Subscription Type</Text>
            <View style={styles.subscriptionTypeSelector}>
              {['weekly', 'monthly', 'yearly'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    subscriptionForm.subscriptionType === type && styles.selectedType
                  ]}
                  onPress={() => setSubscriptionForm({...subscriptionForm, subscriptionType: type})}
                >
                  <Text style={[
                    styles.typeOptionText,
                    subscriptionForm.subscriptionType === type && styles.selectedTypeText
                  ]}>
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Quantity</Text>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setSubscriptionForm({
                  ...subscriptionForm, 
                  quantity: Math.max(1, subscriptionForm.quantity - 1)
                })}
              >
                <Icon name="remove" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{subscriptionForm.quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setSubscriptionForm({
                  ...subscriptionForm, 
                  quantity: subscriptionForm.quantity + 1
                })}
              >
                <Icon name="add" size={20} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Delivery Address</Text>
            <TextInput
              style={styles.textInput}
              value={subscriptionForm.deliveryAddress}
              onChangeText={(text) => setSubscriptionForm({...subscriptionForm, deliveryAddress: text})}
              placeholder="Enter your delivery address"
              multiline
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Delivery Instructions (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={subscriptionForm.deliveryInstructions}
              onChangeText={(text) => setSubscriptionForm({...subscriptionForm, deliveryInstructions: text})}
              placeholder="Any special delivery instructions"
              multiline
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.paymentMethodSelector}>
              {['cash', 'card', 'upi'].map(method => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.paymentOption,
                    subscriptionForm.paymentMethod === method && styles.selectedPayment
                  ]}
                  onPress={() => setSubscriptionForm({...subscriptionForm, paymentMethod: method})}
                >
                  <Text style={[
                    styles.paymentOptionText,
                    subscriptionForm.paymentMethod === method && styles.selectedPaymentText
                  ]}>
                    {method.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.createButton} onPress={createSubscription}>
            <Text style={styles.createButtonText}>Create Subscription</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading subscriptions...</Text>
      </View>
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
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Icon name="add" size={24} color="#800000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {subscriptions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="subscription" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Subscriptions Yet</Text>
            <Text style={styles.emptyText}>Create your first subscription to get regular deliveries</Text>
            <TouchableOpacity 
              style={styles.createFirstButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.createFirstButtonText}>Create Subscription</Text>
            </TouchableOpacity>
          </View>
        ) : (
          subscriptions.map(renderSubscriptionCard)
        )}
      </ScrollView>

      {renderCreateModal()}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#800000',
  },
  addButton: {
    padding: 5,
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
  createFirstButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  createFirstButtonText: {
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
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
  },
  statusContainer: {
    alignItems: 'flex-end',
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFD700',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#800000',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  productSelector: {
    flexDirection: 'row',
  },
  productOption: {
    alignItems: 'center',
    marginRight: 15,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    minWidth: 100,
  },
  selectedProduct: {
    borderColor: '#FFD700',
    backgroundColor: '#fffbf0',
  },
  productOptionImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginBottom: 5,
  },
  productOptionName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 2,
  },
  productOptionPrice: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  subscriptionTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeOption: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    marginHorizontal: 5,
  },
  selectedType: {
    borderColor: '#FFD700',
    backgroundColor: '#fffbf0',
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedTypeText: {
    color: '#800000',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 10,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 50,
  },
  paymentMethodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentOption: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    marginHorizontal: 5,
  },
  selectedPayment: {
    borderColor: '#FFD700',
    backgroundColor: '#fffbf0',
  },
  paymentOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedPaymentText: {
    color: '#800000',
  },
  createButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonText: {
    color: '#800000',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default SubscriptionScreen;
