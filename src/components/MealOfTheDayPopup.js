import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const MealOfTheDayPopup = ({ visible, onClose, branchId }) => {
  const [mealOfTheDay, setMealOfTheDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    if (visible && branchId) {
      fetchMealOfTheDay();
    }
  }, [visible, branchId]);

  const fetchMealOfTheDay = async () => {
    setLoading(true);
    setError(null);
    
    try {
      
  
      
      const baseUrl = 'https://hotelvirat.com';
      const today = new Date().toISOString().split('T')[0];
      const url = `${baseUrl}/api/v1/hotel/meal-of-the-day?branchId=${branchId}&date=${today}&isActive=true`;
      
      console.log('URL:', url);
      
      const response = await fetch(url, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response:', data);
        
        if (data.success && data.data && data.data.length > 0) {
          setMealOfTheDay(data.data[0]);
          console.log('Meal found:', data.data[0]);
        } else {
          setMealOfTheDay(null);
          console.log('No meals available');
        }
      } else {
        console.log('Server error:', response.status);
        setError('Server error');
      }
      
    } catch (error) {
      console.log('=== CATCH ERROR ===');
      console.log('Error name:', error.name);
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
      
      if (error.name === 'AbortError') {
        setError('Request timed out. Please check your connection.');
      } else if (error.message.includes('Network request failed')) {
        setError('Network request failed. Device cannot reach the server.');
      } else {
        setError(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
      console.log('=== MEAL OF THE DAY DEBUG END ===');
    }
  };

  const handleAddToCart = () => {
    if (!mealOfTheDay) return;
    
    // Navigate to product page with meal of the day data
    navigation.navigate('Product', {
      product: {
        _id: mealOfTheDay.productId._id,
        id: mealOfTheDay.productId._id,
        name: mealOfTheDay.title,
        price: mealOfTheDay.specialPrice,
        originalPrice: mealOfTheDay.originalPrice,
        image: mealOfTheDay.image || mealOfTheDay.productId?.image,
        description: mealOfTheDay.description,
        branchId: branchId,
        stock: mealOfTheDay.availableQuantity,
        isMealOfTheDay: true
      }
    });
    
    // Close the popup after navigation
    onClose();
  };

  const handleViewDetails = () => {
    // TODO: Implement view details functionality
    console.log('View details:', mealOfTheDay);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Meal of the Day</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#25D366" />
                <Text style={styles.loadingText}>Loading today's meal...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Icon name="error-outline" size={60} color="#ff6b6b" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchMealOfTheDay}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : mealOfTheDay ? (
              <View style={styles.mealContainer}>
                {/* Meal Details */}
                <View style={styles.mealDetailsContainer}>
                    {/* Image */}
                    <TouchableOpacity 
                      style={styles.imageContainer}
                      onPress={handleAddToCart}
                    >
                      <Image
                        source={{
                          uri: mealOfTheDay.image || mealOfTheDay.productId?.image || 'https://via.placeholder.com/300x200?text=No+Image'
                        }}
                        style={styles.mealImage}
                        resizeMode="cover"
                      />
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{mealOfTheDay.discount}% OFF</Text>
                      </View>
                      <View style={styles.mealOfTheDayBadge}>
                        <Text style={styles.mealOfTheDayText}>Meal of the Day</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Details */}
                    <View style={styles.mealDetails}>
                      <Text style={styles.mealTitle}>{mealOfTheDay.productId?.name}</Text>
                      <Text style={styles.mealDescription}>{mealOfTheDay.description}</Text>
                      
                      {/* Price */}
                      <View style={styles.priceContainer}>
                        <Text style={styles.specialPrice}>₹{mealOfTheDay.specialPrice}</Text>
                        {mealOfTheDay.originalPrice && mealOfTheDay.originalPrice !== mealOfTheDay.specialPrice && (
                          <Text style={styles.originalPrice}>₹{mealOfTheDay.originalPrice}</Text>
                        )}
                      </View>


                    </View>
                  </View>
              </View>
            ) : (
              <View style={styles.noMealContainer}>
                <Icon name="restaurant-menu" size={60} color="#999" />
                <Text style={styles.noMealText}>No meal of the day available</Text>
                <Text style={styles.noMealSubtext}>
                  Check back tomorrow for a new special meal!
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: width * 0.95,
    maxHeight: height * 0.8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    maxHeight: height * 0.6,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#25D366',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mealContainer: {
    padding: 20,
  },
  mealDetailsContainer: {
    flex: 1,
  },
  mealOfTheDayBadge: {
    position: 'absolute',
    top: 10,
    right: 0,
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  mealOfTheDayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  mealImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mealDetails: {
    paddingBottom: 20,
  },
  mealTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  mealDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 15,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  specialPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#25D366',
  },
  originalPrice: {
    fontSize: 18,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 10,
  },
  availableQuantity: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  viewButtonText: {
    color: '#25D366',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  noMealContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noMealText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  noMealSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
});

export default MealOfTheDayPopup;
