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
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SubscriptionOrderScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { product } = route.params || {};
  
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [subscriptionForm, setSubscriptionForm] = useState({
    duration: product?.subscriptionDuration || '3days',
    paymentMethod: 'cash',
  });

  useEffect(() => {
    getUserId();
    
    // Debug log the product data
    console.log('🔍 SubscriptionOrder product data:', {
      name: product?.name,
      subscription3Days: product?.subscription3Days,
      subscription1Week: product?.subscription1Week,
      subscription1Month: product?.subscription1Month,
      subscriptionAmount: product?.subscriptionAmount
    });
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
    // Validate required fields
    if (!subscriptionForm.duration) {
      Alert.alert('Error', 'Please select a subscription duration');
      return;
    }

    if (!subscriptionForm.paymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'Please login to create subscription');
      return;
    }

    const selectedPlanPrice = getSelectedPlanPrice();
    if (!selectedPlanPrice || selectedPlanPrice <= 0) {
      Alert.alert('Error', 'Invalid subscription plan selected');
      return;
    }

    setLoading(true);
    try {
      // Map new plan types to old backend plan types
      const planTypeMapping = {
        '3days': 'daily',
        '1week': 'weekly', 
        '1month': 'monthly'
      };
      
      const requestData = {
        userId,
        productId: product.id || product._id,
        branchId: product.branchId?._id || product.branchId,
        planType: planTypeMapping[subscriptionForm.duration] || subscriptionForm.duration,
        deliveryAddress: 'Default Address', // TODO: Get from user profile
        paymentMethod: subscriptionForm.paymentMethod,
      };
      
      console.log('🚀 Sending subscription order request:', requestData);
      
      const response = await fetch('https://hotelvirat.com/api/v1/hotel/subscription-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      console.log('📥 Subscription order response:', data);
      
      if (data.success) {
        Alert.alert('Success', 'Subscription created successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        console.error('❌ Subscription order failed:', data);
        Alert.alert('Error', data.message || 'Failed to create subscription');
      }
    } catch (error) {
      console.error('Error creating subscription order:', error);
      Alert.alert('Error', 'Failed to create subscription order');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedPlanPrice = () => {
    const price = (() => {
      switch (subscriptionForm.duration) {
        case '3days': return product.subscription3Days || 0;
        case '1week': return product.subscription1Week || 0;
        case '1month': return product.subscription1Month || 0;
        default: return 0;
      }
    })();
    
    console.log('🔍 Selected plan price:', {
      duration: subscriptionForm.duration,
      price: price,
      product: {
        subscription3Days: product.subscription3Days,
        subscription1Week: product.subscription1Week,
        subscription1Month: product.subscription1Month
      }
    });
    
    return price;
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
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>
          
          {/* 3 Days Plan */}
          {product.subscription3Days > 0 && (
            <TouchableOpacity
              style={[
                styles.planCard,
                subscriptionForm.duration === '3days' && styles.selectedPlan
              ]}
              onPress={() => setSubscriptionForm({...subscriptionForm, duration: '3days'})}
            >
              <View style={styles.planContent}>
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>3 Days Plan</Text>
                  <Text style={styles.planPrice}>₹{product.subscription3Days}</Text>
                  <Text style={styles.planBenefit}>Special subscriber pricing for 3 days</Text>
                </View>
                <View style={[
                  styles.radioButton,
                  subscriptionForm.duration === '3days' && styles.selectedRadio
                ]}>
                  {subscriptionForm.duration === '3days' && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* 1 Week Plan */}
          {product.subscription1Week > 0 && (
            <TouchableOpacity
              style={[
                styles.planCard,
                subscriptionForm.duration === '1week' && styles.selectedPlan
              ]}
              onPress={() => setSubscriptionForm({...subscriptionForm, duration: '1week'})}
            >
              <View style={styles.planContent}>
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>1 Week Plan</Text>
                  <Text style={styles.planPrice}>₹{product.subscription1Week}</Text>
                  <Text style={styles.planBenefit}>Special subscriber pricing for 1 week</Text>
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>POPULAR</Text>
                  </View>
                </View>
                <View style={[
                  styles.radioButton,
                  subscriptionForm.duration === '1week' && styles.selectedRadio
                ]}>
                  {subscriptionForm.duration === '1week' && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* 1 Month Plan */}
          {product.subscription1Month > 0 && (
            <TouchableOpacity
              style={[
                styles.planCard,
                subscriptionForm.duration === '1month' && styles.selectedPlan
              ]}
              onPress={() => setSubscriptionForm({...subscriptionForm, duration: '1month'})}
            >
              <View style={styles.planContent}>
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>1 Month Plan</Text>
                  <Text style={styles.planPrice}>₹{product.subscription1Month}</Text>
                  <Text style={styles.planBenefit}>Special subscriber pricing for 1 month</Text>
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>BEST VALUE</Text>
                  </View>
                </View>
                <View style={[
                  styles.radioButton,
                  subscriptionForm.duration === '1month' && styles.selectedRadio
                ]}>
                  {subscriptionForm.duration === '1month' && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          {[
            { value: 'cash', label: 'Cash on Delivery', icon: 'money' },
            { value: 'card', label: 'Credit/Debit Card', icon: 'credit-card' },
            { value: 'upi', label: 'UPI Payment', icon: 'payment' }
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.paymentCard,
                subscriptionForm.paymentMethod === option.value && styles.selectedPayment
              ]}
              onPress={() => setSubscriptionForm({...subscriptionForm, paymentMethod: option.value})}
            >
              <Icon name={option.icon} size={24} color="#800000" />
              <Text style={[
                styles.paymentLabel,
                subscriptionForm.paymentMethod === option.value && styles.selectedPaymentText
              ]}>
                {option.label}
              </Text>
              <View style={[
                styles.radioButton,
                subscriptionForm.paymentMethod === option.value && styles.selectedRadio
              ]}>
                {subscriptionForm.paymentMethod === option.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Subscribe Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.subscribeButton, loading && styles.disabledButton]}
          onPress={createSubscriptionOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="autorenew" size={20} color="#fff" />
              <Text style={styles.subscribeButtonText}>
                Subscribe for ₹{getSelectedPlanPrice()}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFD700',
    elevation: 2,
  },
  backButton: {
    padding: 8,
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
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    elevation: 2,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    color: '#800000',
    fontWeight: '600',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    elevation: 2,
  },
  selectedPlan: {
    borderColor: '#800000',
    backgroundColor: '#fff8f0',
  },
  planContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#800000',
    marginBottom: 4,
  },
  planBenefit: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    marginBottom: 8,
  },
  popularBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  popularText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bestValueBadge: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  bestValueText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subscriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionLabel: {
    fontSize: 14,
    color: '#666',
  },
  subscriptionAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#800000',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  benefitCard: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  benefitText: {
    fontSize: 14,
    color: '#28a745',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  durationCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  selectedDuration: {
    borderColor: '#800000',
    backgroundColor: '#fff8f0',
  },
  durationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  durationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedDurationText: {
    color: '#800000',
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  selectedPayment: {
    borderColor: '#800000',
    backgroundColor: '#fff8f0',
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginLeft: 12,
  },
  selectedPaymentText: {
    color: '#800000',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRadio: {
    borderColor: '#800000',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#800000',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    elevation: 4,
  },
  subscribeButton: {
    backgroundColor: '#800000',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#800000',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#800000',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SubscriptionOrderScreen;