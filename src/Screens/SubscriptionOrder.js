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
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '../context/CartContext';

const SubscriptionOrderScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { product } = route.params || {};
  
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [subscriptionForm, setSubscriptionForm] = useState({
    planType: 'weekly',
    deliveryAddress: '',
    deliveryInstructions: '',
    deliveryDays: ['monday', 'wednesday', 'friday'],
    deliveryTime: '09:00',
    paymentMethod: 'cash',
    totalCycles: null,
  });

  useEffect(() => {
    getUserId();
  }, []);

  const getUserId = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedUserId) {
        setUserId(storedUserId);
      } else {
        Alert.alert('Error', 'Please login to create subscription');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching user ID:', error);
    }
  };

  const createSubscriptionOrder = async () => {
    // Validate required fields with specific messages
    if (!subscriptionForm.deliveryAddress) {
      Alert.alert('Error', 'Please enter delivery address');
      return;
    }

    if (!subscriptionForm.planType) {
      Alert.alert('Error', 'Please select a subscription plan');
      return;
    }

    if (!subscriptionForm.paymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    if (!subscriptionForm.deliveryDays || subscriptionForm.deliveryDays.length === 0) {
      Alert.alert('Error', 'Please select at least one delivery day');
      return;
    }

    if (!subscriptionForm.deliveryTime) {
      Alert.alert('Error', 'Please enter delivery time');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'Please login to create subscription');
      return;
    }

    if (!product.branchId) {
      Alert.alert('Error', 'Product branch information is missing');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://192.168.1.24:9000/api/v1/hotel/subscription-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          productId: product.id || product._id,
          branchId: product.branchId,
          ...subscriptionForm,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', 'Subscription order created successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', data.message || 'Failed to create subscription');
      }
    } catch (error) {
      console.error('Error creating subscription order:', error);
      Alert.alert('Error', 'Failed to create subscription order');
    } finally {
      setLoading(false);
    }
  };

  const getPlanPrice = (planType) => {
    if (!product.subscriptionPlans) return 0;
    const plan = product.subscriptionPlans.find(p => p.type === planType && p.isActive);
    return plan ? plan.price : 0;
  };

  const getPlanDiscount = (planType) => {
    if (!product.subscriptionPlans) return 0;
    const plan = product.subscriptionPlans.find(p => p.type === planType && p.isActive);
    return plan ? plan.discount : 0;
  };

  const calculateDiscountedPrice = (planType) => {
    const basePrice = getPlanPrice(planType);
    const discount = getPlanDiscount(planType);
    return basePrice - (basePrice * discount / 100);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Product not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
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
        <Text style={styles.headerTitle}>Subscribe to {product.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Product Info */}
        <View style={styles.productCard}>
          <Image 
            source={product.image ? { uri: product.image } : require('../assets/lemon.jpg')} 
            style={styles.productImage} 
          />
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productPrice}>Regular Price: ₹{product.price}</Text>
            <Text style={styles.productDescription}>{product.description}</Text>
          </View>
        </View>

        {/* Subscription Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Subscription Plan</Text>
          
          {product.subscriptionPlans?.filter(plan => plan.isActive).map((plan, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.planCard,
                subscriptionForm.planType === plan.type && styles.selectedPlan
              ]}
              onPress={() => setSubscriptionForm({...subscriptionForm, planType: plan.type})}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planType}>{plan.type.toUpperCase()}</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.originalPrice}>₹{plan.price}</Text>
                  <Text style={styles.discountedPrice}>
                    ₹{calculateDiscountedPrice(plan.type).toFixed(2)}
                  </Text>
                </View>
              </View>
              
              {plan.discount > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{plan.discount}% OFF</Text>
                </View>
              )}
              
              {plan.duration && (
                <Text style={styles.durationText}>
                  Duration: {plan.duration} cycles
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Delivery Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Delivery Address *</Text>
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
            <Text style={styles.label}>Delivery Days *</Text>
            <View style={styles.deliveryDaysContainer}>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    subscriptionForm.deliveryDays.includes(day) && styles.selectedDay
                  ]}
                  onPress={() => {
                    const days = subscriptionForm.deliveryDays.includes(day)
                      ? subscriptionForm.deliveryDays.filter(d => d !== day)
                      : [...subscriptionForm.deliveryDays, day];
                    setSubscriptionForm({...subscriptionForm, deliveryDays: days});
                  }}
                >
                  <Text style={[
                    styles.dayButtonText,
                    subscriptionForm.deliveryDays.includes(day) && styles.selectedDayText
                  ]}>
                    {day.charAt(0).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Delivery Time *</Text>
            <TextInput
              style={styles.textInput}
              value={subscriptionForm.deliveryTime}
              onChangeText={(text) => setSubscriptionForm({...subscriptionForm, deliveryTime: text})}
              placeholder="09:00"
            />
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method *</Text>
          <View style={styles.paymentMethodsContainer}>
            {['cash', 'card', 'upi'].map(method => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentMethodButton,
                  subscriptionForm.paymentMethod === method && styles.selectedPaymentMethod
                ]}
                onPress={() => setSubscriptionForm({...subscriptionForm, paymentMethod: method})}
              >
                <Text style={[
                  styles.paymentMethodText,
                  subscriptionForm.paymentMethod === method && styles.selectedPaymentMethodText
                ]}>
                  {method.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Duration</Text>
          <View style={styles.formGroup}>
            <TextInput
              style={styles.textInput}
              value={subscriptionForm.totalCycles || ''}
              onChangeText={(text) => setSubscriptionForm({...subscriptionForm, totalCycles: text ? parseInt(text) : null})}
              placeholder="Leave empty for unlimited"
              keyboardType="numeric"
            />
            <Text style={styles.helpText}>Leave empty for unlimited subscription</Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Subscription Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Plan:</Text>
            <Text style={styles.summaryValue}>{subscriptionForm.planType.toUpperCase()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Price:</Text>
            <Text style={styles.summaryValue}>₹{calculateDiscountedPrice(subscriptionForm.planType).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Days:</Text>
            <Text style={styles.summaryValue}>{subscriptionForm.deliveryDays.map(d => d.charAt(0).toUpperCase()).join(', ')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment:</Text>
            <Text style={styles.summaryValue}>{subscriptionForm.paymentMethod.toUpperCase()}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.createButton, loading && styles.createButtonDisabled]} 
          onPress={createSubscriptionOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#800000" />
          ) : (
            <>
              <Icon name="subscription" size={20} color="#800000" />
              <Text style={styles.createButtonText}>Create Subscription</Text>
            </>
          )}
        </TouchableOpacity>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#800000',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  productDescription: {
    fontSize: 12,
    color: '#999',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  planCard: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  selectedPlan: {
    borderColor: '#FFD700',
    backgroundColor: '#fffbf0',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  planType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
  },
  discountBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  discountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  durationText: {
    fontSize: 12,
    color: '#666',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 50,
  },
  deliveryDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDay: {
    backgroundColor: '#FFD700',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedDayText: {
    color: '#800000',
  },
  paymentMethodsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentMethodButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    marginHorizontal: 5,
  },
  selectedPaymentMethod: {
    borderColor: '#FFD700',
    backgroundColor: '#fffbf0',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedPaymentMethodText: {
    color: '#800000',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  summaryCard: {
    backgroundColor: '#f0f8ff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0f2ff',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  createButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#800000',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default SubscriptionOrderScreen;
