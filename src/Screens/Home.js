import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Modal,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Appearance,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import { useCart } from "../context/CartContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
// import MealOfTheDayCard from '../components/MealOfTheDayCard';
// import MealOfTheDayPopup from '../components/MealOfTheDayPopup';
import BookTableCard from '../components/BookTableCard';

const { width } = Dimensions.get("window");

// Force clear image cache
const clearImageCache = () => {
  console.log("🧹 Clearing image cache to force fresh image loads");
  // This will help ensure fresh images are loaded
};

const Home = () => {
  const navigation = useNavigation();
  const [showBranchModal, setShowBranchModal] = useState(false);
  const { getBranchCartCount, selectedBranch, setSelectedBranch } = useCart();
  
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [failedImages, setFailedImages] = useState(new Set());
  const [menuItems, setMenuItems] = useState({});
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  // const [showMealPopup, setShowMealPopup] = useState(false);
  const [buttonAnimation] = useState(new Animated.Value(0));
  const [showTooltip, setShowTooltip] = useState({ meal: false, table: false });

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Initialize animation
  useEffect(() => {
    // Animate floating button when app opens
    // Delay animation by 1 second after app loads
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(buttonAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonAnimation, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(buttonAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Fetch user ID from AsyncStorage
  useEffect(() => {
    const getUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
        }
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };
    getUserId();
  }, []);

  // Fetch branches from backend API
  useEffect(() => {
    const fetchBranches = async () => {
      console.log("🌐 Fetching branches from backend...");
      
      try {
        const response = await fetch('https://hotelvirat.com/api/v1/hotel/branch');
        
        if (response.ok) {
          const branchesData = await response.json();
          console.log("✅ Raw API Response:", JSON.stringify(branchesData, null, 2));
          
          // API returns an array of branches
          if (Array.isArray(branchesData) && branchesData.length > 0) {
            const processedBranches = branchesData.map(branch => ({
              id: branch._id,
              name: branch.name,
              address: branch.address,
              image: branch.image,
              contact: branch.contact,
              openingHours: branch.openingHours
            }));
            
            console.log("✅ Processed branches array:", processedBranches);
            setBranches(processedBranches);
            
            // Set selectedBranch to 0 to show the first branch
            if (selectedBranch === null || selectedBranch === undefined) {
              setSelectedBranch(0);
              console.log("✅ selectedBranch set to 0");
            }
          } else {
            console.log("⚠️ No branches found in API response");
            setBranches([{
              id: 'default-branch',
              name: 'Hotel Virat',
              address: 'Main Location'
            }]);
          }
          
        } else {
          console.log("⚠️ Using default branch");
          setBranches([{
            id: 'default-branch',
            name: 'Hotel Virat',
            address: 'Main Location'
          }]);
        }
      } catch (error) {
        console.log("❌ Error fetching branches:", error.message);
        setBranches([{
          id: 'default-branch',
          name: 'Hotel Virat',
          address: 'Main Location'
        }]);
      }
    };
    
    fetchBranches();
  }, []);

  // Fetch categories, menu items, and offers for selected branch - FETCH FROM ADMIN PANEL
  useEffect(() => {
    const fetchData = async () => {
      if (!branches.length) return;
      
      console.log("🍽️ Fetching menu data from admin panel...");
      setLoading(true);
      setError(null);
      
      // Clear image cache to ensure fresh images
      clearImageCache();
      
      try {
        // Fetch categories from admin panel backend
        console.log("📋 Fetching categories from backend...");
        console.log("📋 Categories URL:", 'https://hotelvirat.com/api/v1/hotel/category');
        const categoriesResponse = await fetch('https://hotelvirat.com/api/v1/hotel/category');
        
        console.log("📋 Categories response status:", categoriesResponse.status);
        console.log("📋 Categories response headers:", categoriesResponse.headers);
        
        if (!categoriesResponse.ok) {
          const errorText = await categoriesResponse.text();
          console.log("📋 Categories error response:", errorText);
          throw new Error(`Categories API failed: ${categoriesResponse.status} - ${errorText}`);
        }
        
        const categoriesText = await categoriesResponse.text();
        console.log("📋 Categories raw response:", categoriesText.substring(0, 200) + "...");
        
        let categoriesData;
        try {
          categoriesData = JSON.parse(categoriesText);
        } catch (parseError) {
          console.log("📋 Categories JSON parse error:", parseError);
          console.log("📋 Full response text:", categoriesText);
          throw new Error(`Categories response is not valid JSON: ${parseError.message}`);
        }
        
        console.log("✅ Categories fetched:", categoriesData);
        
        // Test image URL accessibility
        if (categoriesData.length > 0 && categoriesData[0].image) {
          const testImageUrl = `https://hotelvirat.com/${categoriesData[0].image}`;
          console.log("🧪 Testing image URL accessibility:", testImageUrl);
          
          fetch(testImageUrl, { method: 'HEAD' })
            .then(response => {
              console.log("🧪 Image URL test result:", response.status, response.ok ? "✅ Accessible" : "❌ Not accessible");
            })
            .catch(error => {
              console.log("🧪 Image URL test failed:", error.message);
            });
        }
        
        // Fetch products from backend
        console.log("🍽️ Fetching products from backend...");
        console.log("🍽️ Products URL:", 'https://hotelvirat.com/api/v1/hotel/menu');
        const productsResponse = await fetch('https://hotelvirat.com/api/v1/hotel/menu');
        
        console.log("🍽️ Products response status:", productsResponse.status);
        
        if (!productsResponse.ok) {
          const errorText = await productsResponse.text();
          console.log("🍽️ Products error response:", errorText);
          throw new Error(`Products API failed: ${productsResponse.status} - ${errorText}`);
        }
        
        const productsText = await productsResponse.text();
        console.log("🍽️ Products raw response:", productsText.substring(0, 200) + "...");
        
        let productsData;
        try {
          productsData = JSON.parse(productsText);
        } catch (parseError) {
          console.log("🍽️ Products JSON parse error:", parseError);
          console.log("🍽️ Full response text:", productsText);
          throw new Error(`Products response is not valid JSON: ${parseError.message}`);
        }
        
        console.log("✅ Products fetched:", productsData);
        
        // Process categories data
        const processedCategories = categoriesData.map(category => {
          let imageUrl = null;
          if (category.image) {
            // Try different URL formats for better compatibility
            if (category.image.startsWith('http')) {
              // Already a full URL
              imageUrl = category.image;
            } else {
              // Remove leading slash if present to avoid double slashes
              const cleanImagePath = category.image.startsWith('/') ? category.image.substring(1) : category.image;
              
              // Use production server for category images since they're hosted there
              imageUrl = `https://hotelvirat.com/${cleanImagePath}`;
            }
            
            // Debug category image URL construction (only log first category)
            if (categoriesData.indexOf(category) === 0) {
              console.log("🖼️ Category Image URL construction:", {
                categoryName: category.name,
                originalImage: category.image,
                finalImageUrl: imageUrl
              });
            }
          }
          
          return {
            id: category._id || category.id,
            name: category.name,
            image: imageUrl,
            description: category.description || ''
          };
        });
        
        console.log("🔍 Sample category structure:", categoriesData[0]);
        console.log("🔍 Processed categories sample:", processedCategories[0]);
        
        // Group products by category and subcategory
        const groupedMenuItems = {};
        
        // Initialize empty arrays for each category
        processedCategories.forEach(category => {
          groupedMenuItems[category.id] = [];
        });
        
        console.log("🔍 Sample product structure:", productsData[0]);
        
        // Group products by their category
        productsData.forEach(product => {
          // Handle different possible category ID structures
          const categoryId = product.categoryId?._id || 
                           product.categoryId?.id || 
                           product.categoryId || 
                           product.category?._id || 
                           product.category?.id;
          
          // Log only first few product mappings to avoid spam
          if (productsData.indexOf(product) < 5) {
            console.log("🔍 Product category mapping:", {
              productName: product.name,
              categoryId: categoryId,
              rawCategoryId: product.categoryId
            });
          }
          
          if (categoryId && groupedMenuItems[categoryId]) {
            let imageUrl = null;
            if (product.image) {
              // Remove leading slash if present to avoid double slashes
              const cleanImagePath = product.image.startsWith('/') ? product.image.substring(1) : product.image;
              // Use production server for images since they're hosted there
              imageUrl = `https://hotelvirat.com/${cleanImagePath}`;
              
              // Debug image URL construction (only log first few items)
              if (groupedMenuItems[categoryId].length < 3) {
                console.log("🖼️ Image URL construction:", {
                  productName: product.name,
                  originalImage: product.image,
                  cleanImagePath: cleanImagePath,
                  finalImageUrl: imageUrl
                });
              }
            }
            
            const processedProduct = {
              id: product._id || product.id,
              name: product.name || product.itemName,
              price: product.price || product.prices?.Large || Object.values(product.prices || {})[0] || 0,
              description: product.description || '',
              image: imageUrl,
              categoryId: categoryId,
              subcategoryId: product.subcategoryId?._id || product.subcategoryId || product.subcategory?._id || product.subcategory?.id,
              subcategoryName: product.subcategory?.name || product.subcategoryName || '',
              isVeg: product.isVeg !== false, // Default to true if not specified
              isAvailable: product.isAvailable !== false, // Default to true if not specified
              rating: product.rating || 0,
              preparationTime: product.preparationTime || '15-20 mins',
              quantities: product.quantities || ['Regular'],
              prices: product.prices || {}
            };
            
            groupedMenuItems[categoryId].push(processedProduct);
          } else {
            console.log("⚠️ Product without valid category:", {
              productName: product.name,
              categoryId: categoryId,
              availableCategories: Object.keys(groupedMenuItems)
            });
          }
        });
        
        // Sort products within each category by subcategory and name
        Object.keys(groupedMenuItems).forEach(categoryId => {
          groupedMenuItems[categoryId].sort((a, b) => {
            // First sort by subcategory
            if (a.subcategoryName && b.subcategoryName) {
              const subcategoryCompare = a.subcategoryName.localeCompare(b.subcategoryName);
              if (subcategoryCompare !== 0) return subcategoryCompare;
            }
            // Then sort by name
            return a.name.localeCompare(b.name);
          });
        });
        
        console.log("📊 Processed categories:", processedCategories);
        console.log("📊 Grouped menu items:", groupedMenuItems);
        console.log("📊 Menu items count per category:");
        Object.keys(groupedMenuItems).forEach(categoryId => {
          const category = processedCategories.find(cat => cat.id === categoryId);
          console.log(`  - ${category?.name || categoryId}: ${groupedMenuItems[categoryId].length} items`);
        });
        
        setCategories(processedCategories);
        setMenuItems(groupedMenuItems);
        setOffers([]); // No offers for now
        setLoading(false);
        
        console.log("✅ Menu data loaded successfully from admin panel");
        
      } catch (error) {
        console.error("❌ Error fetching menu data:", error);
        setError(`Failed to load menu: ${error.message}`);
        setLoading(false);
        
        // Fallback to default data if admin panel is not available
        console.log("🔄 Falling back to default menu data...");
        const defaultCategories = [
          { id: 'cat1', name: 'South Indian', image: null, description: 'Traditional South Indian dishes' },
          { id: 'cat2', name: 'North Indian', image: null, description: 'Authentic North Indian cuisine' },
          { id: 'cat3', name: 'Chinese', image: null, description: 'Indo-Chinese favorites' },
          { id: 'cat4', name: 'Beverages', image: null, description: 'Refreshing drinks' }
        ];
        
        const defaultMenuItems = {
          'cat1': [
            { id: 'item1', name: 'Masala Dosa', price: 80, description: 'Crispy dosa with potato filling', image: null, categoryId: 'cat1', isVeg: true, isAvailable: true },
            { id: 'item2', name: 'Idli Sambar', price: 60, description: 'Steamed rice cakes with sambar', image: null, categoryId: 'cat1', isVeg: true, isAvailable: true }
          ],
          'cat2': [
            { id: 'item3', name: 'Butter Chicken', price: 220, description: 'Creamy chicken curry', image: null, categoryId: 'cat2', isVeg: false, isAvailable: true },
            { id: 'item4', name: 'Paneer Butter Masala', price: 180, description: 'Rich paneer curry', image: null, categoryId: 'cat2', isVeg: true, isAvailable: true }
          ],
          'cat3': [
            { id: 'item5', name: 'Fried Rice', price: 120, description: 'Vegetable fried rice', image: null, categoryId: 'cat3', isVeg: true, isAvailable: true },
            { id: 'item6', name: 'Manchurian', price: 140, description: 'Spicy vegetable balls', image: null, categoryId: 'cat3', isVeg: true, isAvailable: true }
          ],
          'cat4': [
            { id: 'item7', name: 'Fresh Lime Soda', price: 40, description: 'Refreshing lime drink', image: null, categoryId: 'cat4', isVeg: true, isAvailable: true },
            { id: 'item8', name: 'Filter Coffee', price: 30, description: 'South Indian filter coffee', image: null, categoryId: 'cat4', isVeg: true, isAvailable: true }
          ]
        };
        
        setCategories(defaultCategories);
        setMenuItems(defaultMenuItems);
        setOffers([]);
        setError(null); // Clear error after fallback
        setLoading(false);
      }
    };
    
    fetchData();
  }, [branches, selectedBranch]);

  // Navigate to product screen with selected category
  const handleCategoryPress = (categoryId, index) => {
    const categoryMenuItems = menuItems[categoryId] || [];
    
    navigation.navigate("Product", {
      initialCategory: index,
      categoryId: categoryId,
      categories: categories,
      branchId: branches[selectedBranch]?.id,
      menuItems: categoryMenuItems, // Pass the menu items for this category
      allMenuItems: menuItems // Pass all menu items grouped by category
    });
  };

  // Render offer item (just the image)
  const renderOfferItem = ({ item }) => (
    <TouchableOpacity style={styles.offerCard}>
      <Image source={item.image} style={styles.offerImage} resizeMode="cover" />
    </TouchableOpacity>
  );

  if (loading && !categories.length) {
    return (
      <View style={[styles.loadingContainer, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={[styles.loadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Loading menu data...</Text>
      </View>
    );
  }

  if (error && !categories.length) {
    return (
      <View style={[styles.errorContainer, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <Icon name="error-outline" size={60} color="#FFD700" />
        <Text style={[styles.errorText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, colorScheme === 'dark' ? styles.retryButtonDark : styles.retryButtonLight]}
          onPress={() => {
            setError(null);
            setLoading(true);
            setSelectedBranch(selectedBranch);
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar backgroundColor={colorScheme === 'dark' ? '#1a1a1a' : '#fff'} barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <View style={styles.headerLeft}>
          <Icon name="restaurant-menu" size={24} color="#800000" style={{ marginRight: 8 }} />
          <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Hotel Virat</Text>
        </View>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => navigation.navigate("MyCart")}
        >
          <Icon name="shopping-cart" size={24} color="#fff" />
          {getBranchCartCount(selectedBranch) > 0 && (
            <View style={[styles.cartBadge, colorScheme === 'dark' ? styles.cartBadgeDark : styles.cartBadgeLight]}>
              <Text style={styles.cartBadgeText}>{getBranchCartCount(selectedBranch)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Combined Hotel Banner and Branch Selection */}
        <View style={[styles.combinedBanner, colorScheme === 'dark' ? styles.combinedBannerDark : styles.combinedBannerLight]}>
          {/* Hotel Virat Logo Section */}
          <View style={styles.logoSection}>
            <Image 
              source={require("../assets/new-virat-logo.jpeg")} 
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={styles.logoTextContainer}>
              <Text style={[styles.logoWelcomeText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                Welcome to
              </Text>
              <Text style={[styles.logoHotelName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                Hotel Virat
              </Text>
              <Text style={[styles.logoTagline, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                Authentic Taste, Memorable Experience
              </Text>
            </View>
          </View>

          {/* Branch Selection Section */}
          {branches.length > 0 && (
            <TouchableOpacity 
              style={styles.branchSelectorInBanner} 
              onPress={() => {
                console.log("🔍 Opening branch modal with branches:", branches);
                console.log("🔍 Current selectedBranch:", selectedBranch);
                setShowBranchModal(true);
              }}
            >
              <View style={styles.branchSelectorLeft}>
                <Icon name="location-on" size={20} color="#800000" />
                <View style={styles.branchTextContainer}>
                  <Text style={[styles.branchName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                    {branches.length > 0 && selectedBranch !== null ? branches[selectedBranch]?.name : 'Select Branch'}
                  </Text>
                  <Text style={[styles.branchAddress, colorScheme === 'dark' ? styles.textDark : styles.textLight]} numberOfLines={1}>
                    {branches.length > 0 && selectedBranch !== null ? branches[selectedBranch]?.address : ''}
                  </Text>
                </View>
              </View>
              <Icon name="arrow-drop-down" size={24} color="#800000" />
            </TouchableOpacity>
          )}
        </View>

        {/* Meal of the Day Section - COMMENTED OUT */}
        {/* <MealOfTheDayCard branchId={selectedBranch} /> */}

        {/* Table Booking Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Table Booking</Text>
          <TouchableOpacity 
            style={[styles.tableBookingCard, colorScheme === 'dark' ? styles.tableBookingCardDark : styles.tableBookingCardLight]}
            onPress={() => navigation.navigate('TableBooking', {
              tables: [], // Tables will be fetched in TableBooking component
              branchId: branches[selectedBranch]?.id, // Pass the actual branch ID
              availableCount: 0
            })}
          >
            <View style={styles.tableBookingContent}>
              <View style={styles.tableBookingLeft}>
                <View style={styles.tableBookingIconContainer}>
                  <Icon name="table-restaurant" size={32} color="#800000" />
                </View>
                <View style={styles.tableBookingTextContainer}>
                  <Text style={[styles.tableBookingTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                    Reserve Your Table
                  </Text>
                  <Text style={[styles.tableBookingSubtitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                    Book a table for your perfect dining experience
                  </Text>
                </View>
              </View>
              <View style={styles.tableBookingRight}>
                <View style={styles.tableBookingBadge}>
                  <Text style={styles.tableBookingBadgeText}>BOOK NOW</Text>
                </View>
                <Icon name="arrow-forward" size={20} color="#800000" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Offers Section - Only show if there are offers */}
        {offers.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Special Offers</Text>
            <FlatList
              data={offers}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={renderOfferItem}
              keyExtractor={(item) => (item.id || item._id || 'unknown').toString()}
              contentContainerStyle={styles.offersContainer}
              snapToInterval={width - 30}
              decelerationRate="fast"
            />
          </View>
        )}

        {/* Categories */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Our Menu</Text>
          {categories.length > 0 ? (
            <FlatList
              data={categories}
              keyExtractor={(item) => (item.id || item._id || 'unknown').toString()}
              numColumns={2}
              scrollEnabled={false}
              renderItem={({ item, index }) => {
                const itemCount = menuItems[item.id]?.length || 0;
                return (
                  <TouchableOpacity 
                    style={styles.categoryCard} 
                    onPress={() => handleCategoryPress(item.id, index)}
                  >
                    <Image 
                      source={
                        failedImages.has(item.id) || !item.image 
                          ? require("../assets/lemon.jpg")
                          : { uri: item.image }
                      } 
                      style={styles.categoryImage}
                      onError={(error) => {
                        console.log("❌ Category image failed:", item.name, item.image);
                        console.log("❌ Error details:", error.nativeEvent.error);
                        setFailedImages(prev => new Set([...prev, item.id]));
                      }}
                      onLoad={() => {
                        console.log("✅ Category image loaded:", item.name, item.image);
                      }}
                      defaultSource={require("../assets/lemon.jpg")}
                    />
                    <View style={styles.categoryOverlay}>
                      <Text style={styles.categoryCardText}>{item.name}</Text>
                      {itemCount > 0 && (
                        <Text style={styles.categoryItemCount}>{itemCount} items</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.categoriesContainer}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={[styles.noDataText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No menu categories available</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Branch Selection Modal */}
      <Modal
        visible={showBranchModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBranchModal(false)}
      >
        <View style={[styles.modalOverlay, colorScheme === 'dark' ? styles.modalOverlayDark : styles.modalOverlayLight]}>
          <View style={[styles.modalContainer, colorScheme === 'dark' ? styles.modalContainerDark : styles.modalContainerLight]}>
            <View style={[styles.modalHeader, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
              <Text style={[styles.modalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Select Branch</Text>
              <TouchableOpacity onPress={() => setShowBranchModal(false)}>
                <Icon name="close" size={24} color="#800000" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={branches}
              keyExtractor={(item) => (item.id || item._id || 'unknown').toString()}
              renderItem={({ item, index }) => {
                console.log("🔍 Rendering branch item:", { index, item });
                return (
                  <TouchableOpacity
                    style={[styles.branchItem, selectedBranch === index && (colorScheme === 'dark' ? styles.selectedBranchItemDark : styles.selectedBranchItem)]}
                    onPress={() => {
                      console.log("🔄 Branch selected:", index, item.name);
                      setSelectedBranch(index);
                      setShowBranchModal(false);
                    }}
                  >
                    <View style={styles.branchItemLeft}>
                      <Icon name="location-on" size={20} color={selectedBranch === index ? "#800000" : colorScheme === 'dark' ? "#888" : "#6b7280"} />
                    </View>
                    <View style={styles.branchItemDetails}>
                      <Text style={[styles.branchItemName, selectedBranch === index ? styles.selectedBranchText : (colorScheme === 'dark' ? styles.textDark : styles.textLight)]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.branchItemAddress, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{item.address}</Text>
                    </View>
                    {selectedBranch === index && <Icon name="check" size={20} color="#800000" />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={[styles.branchSeparator, colorScheme === 'dark' ? styles.branchSeparatorDark : styles.branchSeparatorLight]} />}
            />
          </View>
        </View>
      </Modal>

      {/* Meal of the Day Popup Modal - COMMENTED OUT */}
      {/* 
      <MealOfTheDayPopup 
        visible={showMealPopup}
        onClose={() => setShowMealPopup(false)}
        branchId={branches[selectedBranch]?.id}
      />
      */}

      {/* Floating Meal of the Day Button - COMMENTED OUT */}
      {/* 
      <TouchableOpacity 
        style={styles.floatingMealButtonInner}
        onPress={() => setShowMealPopup(true)}
      >
        <Icon name="restaurant-menu" size={24} color="#fff" style={{ marginRight: 10 }} />
        <Text style={styles.floatingMealButtonText}>Meal of the Day</Text>
      </TouchableOpacity>
      */}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  textLight: {
    color: "#333",
  },
  textDark: {
    color: "#e5e5e5",
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  retryButtonLight: {
    backgroundColor: "#800000",
  },
  retryButtonDark: {
    backgroundColor: "#4a0000",
  },
  retryButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: '600',
  },
  noDataContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cartButton: {
    backgroundColor: "#800000",
    padding: 10,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#800000",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  cartBadgeLight: {
    borderColor: "#fff",
  },
  cartBadgeDark: {
    borderColor: "#2a2a2a",
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  branchSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 15,
    marginVertical: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  branchSelectorLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  branchSelectorDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  branchSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  branchTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  branchName: {
    fontSize: 16,
    fontWeight: "600",
  },
  branchAddress: {
    fontSize: 13,
    marginTop: 2,
  },
  // Combined Banner Styles (Logo + Branch Selection)
  combinedBanner: {
    marginHorizontal: 15,
    marginVertical: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  combinedBannerLight: {
    backgroundColor: "#fff",
  },
  combinedBannerDark: {
    backgroundColor: "#2a2a2a",
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 20,
  },
  logoTextContainer: {
    flex: 1,
  },
  logoWelcomeText: {
    fontSize: 16,
    fontWeight: "400",
    marginBottom: 4,
  },
  logoHotelName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#800000",
    marginBottom: 4,
  },
  logoTagline: {
    fontSize: 14,
    fontStyle: "italic",
    opacity: 0.8,
  },
  branchSelectorInBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "rgba(128, 0, 0, 0.05)",
  },
  sectionContainer: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 15,
  },
  offersContainer: {
    paddingLeft: 15,
    paddingBottom: 5,
  },
  offerCard: {
    width: width - 30,
    height: 200,
    borderRadius: 12,
    marginRight: 15,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  offerImage: {
    width: "100%",
    height: "100%",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlayLight: {
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalOverlayDark: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    paddingBottom: 20,
  },
  modalContainerLight: {
    backgroundColor: "#fff",
  },
  modalContainerDark: {
    backgroundColor: "#2a2a2a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  branchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  selectedBranchItem: {
    backgroundColor: "#fff7ed",
  },
  selectedBranchItemDark: {
    backgroundColor: "#3a3a3a",
  },
  branchItemLeft: {
    marginRight: 16,
  },
  branchItemDetails: {
    flex: 1,
  },
  branchItemName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  selectedBranchText: {
    color: "#FFD700",
  },
  branchItemAddress: {
    fontSize: 13,
  },
  branchSeparator: {
    height: 1,
    marginHorizontal: 20,
  },
  branchSeparatorLight: {
    backgroundColor: "#e5e7eb",
  },
  branchSeparatorDark: {
    backgroundColor: "#444",
  },
  categoriesContainer: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  categoryCard: {
    flex: 1,
    margin: 5,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    position: "relative",
  },
  categoryImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  categoryOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    alignItems: "center",
  },
  categoryCardText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFD700",
    textAlign: "center",
  },
  categoryItemCount: {
    fontSize: 12,
    color: "#FFD700",
    textAlign: "center",
    marginTop: 2,
    opacity: 0.8,
  },
  // Table Booking Section Styles
  tableBookingCard: {
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  tableBookingCardLight: {
    backgroundColor: "#fff",
  },
  tableBookingCardDark: {
    backgroundColor: "#2a2a2a",
  },
  tableBookingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tableBookingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  tableBookingIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff7ed",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  tableBookingTextContainer: {
    flex: 1,
  },
  tableBookingTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  tableBookingSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  tableBookingRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  tableBookingBadge: {
    backgroundColor: "#800000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
  },
  tableBookingBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  // Floating Meal of the Day Button - COMMENTED OUT
  /*
  floatingMealButtonInner: {
    backgroundColor: '#FF6B35',
    borderRadius: 35,
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    position: 'absolute',
    bottom: 120, // Moved higher up from bottom to be below temple meals section
    left: 20,
    minWidth: 180, // Made bigger
    maxWidth: 200,
  },
  floatingMealButtonText: {
    color: '#fff',
    fontSize: 16, // Increased font size
    fontWeight: '700',
    textAlign: 'center',
  },
  */
});

export default Home;