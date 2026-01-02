import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useCart } from '../context/CartContext';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const MealOfTheDayCard = ({ branchId }) => {
  const [mealOfTheDay, setMealOfTheDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { addToCart, selectedBranch } = useCart();
  const navigation = useNavigation();

  useEffect(() => {
    if (branchId || selectedBranch) {
      fetchTodaysMeal();
    }
  }, [branchId, selectedBranch]);

  const fetchTodaysMeal = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const currentBranchId = branchId || selectedBranch;
      if (!currentBranchId) {
        setError('No branch selected');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://hotelvirat.com/api/v1/hotel/meal-of-the-day/today/${currentBranchId}`
      );
      
      const data = await response.json();
      
      if (data.success) {
        setMealOfTheDay(data.data);
      } else {
        setError(data.message || 'No meal of the day found');
      }
    } catch (error) {
      console.error('Error fetching meal of the day:', error);
      setError('Failed to load meal of the day');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!mealOfTheDay) return;

    const cartItem = {
      id: mealOfTheDay.productId._id,
      name: mealOfTheDay.title,
      price: mealOfTheDay.specialPrice,
      image: mealOfTheDay.image || mealOfTheDay.productId.image,
      branchId: mealOfTheDay.branchId._id,
      categoryId: mealOfTheDay.productId.categoryId,
      stock: mealOfTheDay.availableQuantity,
      isMealOfTheDay: true,
      originalPrice: mealOfTheDay.originalPrice,
      discount: mealOfTheDay.discount
    };

    addToCart(cartItem);
    Alert.alert(
      'Added to Cart!',
      `${mealOfTheDay.title} has been added to your cart`,
      [{ text: 'OK' }]
    );
  };

  const handleBannerClick = () => {
    if (!mealOfTheDay) return;
    
    // Navigate to product page with meal of the day data
    navigation.navigate('Product', {
      product: {
        _id: mealOfTheDay.productId._id,
        id: mealOfTheDay.productId._id,
        name: mealOfTheDay.title,
        price: mealOfTheDay.specialPrice,
        originalPrice: mealOfTheDay.originalPrice,
        image: mealOfTheDay.image || mealOfTheDay.productId.image,
        description: mealOfTheDay.description,
        branchId: mealOfTheDay.branchId._id,
        categoryId: mealOfTheDay.productId.categoryId,
        stock: mealOfTheDay.availableQuantity,
        isMealOfTheDay: true,
        discount: mealOfTheDay.discount,
        tags: mealOfTheDay.tags,
        nutritionalInfo: mealOfTheDay.nutritionalInfo
      }
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    // Don't show loading if no branch is selected yet
    if (!branchId && !selectedBranch) {
      return null;
    }
    
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#800000" />
        <Text style={styles.loadingText}>Loading today's special...</Text>
      </View>
    );
  }

  if (error || !mealOfTheDay) {
    // Don't show error if no branch is selected yet
    if (!branchId && !selectedBranch) {
      return null;
    }
    
    return (
      <View style={styles.errorContainer}>
        <Icon name="restaurant-menu" size={48} color="#ccc" />
        <Text style={styles.errorText}>
          {error || 'No meal of the day available'}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchTodaysMeal}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handleBannerClick}>
      <View style={styles.banner}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Icon name="star" size={20} color="#FFD700" />
            <Text style={styles.title}>Meal of the Day</Text>
            <Icon name="star" size={20} color="#FFD700" />
          </View>
          <Text style={styles.date}>{formatDate(mealOfTheDay.date)}</Text>
        </View>

        <View style={styles.bannerContent}>
          <View style={styles.imageContainer}>
            <Image
              source={{
                uri: mealOfTheDay.image || mealOfTheDay.productId?.image || 'https://via.placeholder.com/300x200?text=No+Image'
              }}
              style={styles.image}
              resizeMode="cover"
              onError={(error) => {
                console.log('Image failed to load:', error);
              }}
            />
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>FEATURED</Text>
            </View>
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{mealOfTheDay.discount}% OFF</Text>
            </View>
          </View>

          <View style={styles.content}>
            <Text style={styles.mealTitle}>{mealOfTheDay.title}</Text>
            <Text style={styles.description} numberOfLines={2}>{mealOfTheDay.description}</Text>

            <View style={styles.priceContainer}>
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₹{mealOfTheDay.originalPrice}</Text>
                <Text style={styles.specialPrice}>₹{mealOfTheDay.specialPrice}</Text>
              </View>
              <Text style={styles.savings}>
                Save ₹{mealOfTheDay.originalPrice - mealOfTheDay.specialPrice}
              </Text>
            </View>

            <View style={styles.clickHint}>
              <Text style={styles.clickText}>Tap to view details</Text>
              <Icon name="arrow-forward" size={16} color="#800000" />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    paddingHorizontal: 15,
  },
  banner: {
    backgroundColor: 'white',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    padding: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    margin: 15,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#800000',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 15,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#800000',
    marginHorizontal: 10,
  },
  date: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 15,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  featuredBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featuredText: {
    color: '#800000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#dc3545',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  description: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 10,
  },
  priceContainer: {
    marginBottom: 15,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 10,
  },
  specialPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
  },
  savings: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  tag: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#495057',
  },
  nutritionContainer: {
    marginBottom: 15,
  },
  nutritionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: 15,
  },
  nutritionText: {
    fontSize: 12,
    color: '#666',
  },
  quantityContainer: {
    marginBottom: 20,
  },
  quantityText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  addToCartButton: {
    backgroundColor: '#800000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addToCartText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  clickHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  clickText: {
    fontSize: 12,
    color: '#800000',
    marginRight: 5,
    fontStyle: 'italic',
  },
});

export default MealOfTheDayCard;
