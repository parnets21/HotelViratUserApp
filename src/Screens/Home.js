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
import MealOfTheDayCard from '../components/MealOfTheDayCard';
import MealOfTheDayPopup from '../components/MealOfTheDayPopup';

const { width } = Dimensions.get("window");

const Home = () => {
  const navigation = useNavigation();
  const [showBranchModal, setShowBranchModal] = useState(false);
  const { getBranchCartCount, selectedBranch, setSelectedBranch } = useCart();
  
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState({});
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  const [showMealPopup, setShowMealPopup] = useState(false);
  const [buttonAnimation] = useState(new Animated.Value(0));

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Animate floating button when app opens
  useEffect(() => {
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

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('http://192.168.1.24:9000/api/v1/hotel/branch');
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
          setBranches(data.map(branch => ({
            id: branch._id,
            name: branch.name,
            address: branch.address,
          })));
        } else {
          setError('No branches found');
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
        setError('Failed to load branches');
      }
    };
    
    fetchBranches();
  }, []);

  // Fetch categories, menu items, and offers for selected branch
  useEffect(() => {
    const fetchData = async () => {
      if (!branches.length) return;
      
      setLoading(true);
      try {
        // Get branch ID from the branches array
        const branchId = branches[selectedBranch]?.id;
        
        if (!branchId) {
          setLoading(false);
          return;
        }
        
        // Fetch categories for the selected branch
        const categoriesResponse = await fetch(`http://192.168.1.24:9000/api/v1/hotel/category?branchId=${branchId}`);
        const categoriesData = await categoriesResponse.json();
        
        if (Array.isArray(categoriesData) && categoriesData.length > 0) {
          const formattedCategories = categoriesData.map(category => ({
            id: category._id,
            name: category.name,
            image: category.image ? (category.image.startsWith('http') ? category.image : `http://192.168.1.24:9000${category.image.startsWith('/') ? '' : '/'}${category.image}`) : null
          }));
          
          setCategories(formattedCategories);
          
          // Fetch menu items for each category
          const menuItemsObj = {};
          
          for (const category of formattedCategories) {
            const menuResponse = await fetch(`http://192.168.1.24:9000/api/v1/hotel/menu?categoryId=${category.id}&branchId=${branchId}`);
            const menuData = await menuResponse.json();
            
            if (Array.isArray(menuData)) {
              menuItemsObj[category.id] = menuData.map(item => {
                // Get price - check both price field and prices object
                let itemPrice = item.price;
                if (!itemPrice && item.prices && typeof item.prices === 'object') {
                  const priceValues = Object.values(item.prices);
                  itemPrice = priceValues.length > 0 ? priceValues[0] : 0;
                }
                return {
                  id: item._id,
                  name: item.name || item.itemName,
                  price: itemPrice || 0,
                  description: item.description || '',
                  image: item.image ? (item.image.startsWith('http') ? item.image : `http://192.168.1.24:9000${item.image.startsWith('/') ? '' : '/'}${item.image}`) : null,
                  categoryId: item.categoryId
                };
              });
            }
          }
          
          setMenuItems(menuItemsObj);
        } else {
          setCategories([]);
        }
        
        // Fetch active offers/coupons
        const offersResponse = await fetch(`http://192.168.1.24:9000/api/v1/hotel/coupon?isActive=true&branchId=${branchId}`);
        const offersData = await offersResponse.json();

        if (Array.isArray(offersData) && offersData.length > 0) {
          setOffers(offersData.filter(offer => offer.image).map(offer => ({
            id: offer._id,
            image: { uri: offer.image.startsWith('http') ? offer.image : `http://192.168.1.24:9000${offer.image.startsWith('/') ? '' : '/'}${offer.image}` },
          })));
        } else {
          setOffers([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data');
        setOffers([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [branches, selectedBranch]);

  // Navigate to product screen with selected category
  const handleCategoryPress = (categoryId, index) => {
    navigation.navigate("Product", {
      initialCategory: index,
      categoryId: categoryId,
      categories: categories,
      branchId: branches[selectedBranch]?.id
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
        {/* Branch Selection */}
        {branches.length > 0 && (
          <TouchableOpacity style={[styles.branchSelector, colorScheme === 'dark' ? styles.branchSelectorDark : styles.branchSelectorLight]} onPress={() => setShowBranchModal(true)}>
            <View style={styles.branchSelectorLeft}>
              <Icon name="location-on" size={20} color="#800000" />
              <View style={styles.branchTextContainer}>
                <Text style={[styles.branchName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{branches[selectedBranch]?.name || 'Select Branch'}</Text>
                <Text style={[styles.branchAddress, colorScheme === 'dark' ? styles.textDark : styles.textLight]} numberOfLines={1}>
                  {branches[selectedBranch]?.address || ''}
                </Text>
              </View>
            </View>
            <Icon name="arrow-drop-down" size={24} color="#800000" />
          </TouchableOpacity>
        )}

        {/* Meal of the Day Section */}
        <MealOfTheDayCard branchId={selectedBranch} />

        {/* Offers Section - Only show if there are offers */}
        {offers.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Special Offers</Text>
            <FlatList
              data={offers}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={renderOfferItem}
              keyExtractor={(item) => item.id.toString()}
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
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity 
                  style={styles.categoryCard} 
                  onPress={() => handleCategoryPress(item.id, index)}
                >
                  <Image 
                    source={item.image ? { uri: item.image } : require("../assets/lemon.jpg")} 
                    style={styles.categoryImage} 
                  />
                  <View style={styles.categoryOverlay}>
                    <Text style={styles.categoryCardText}>{item.name}</Text>
                  </View>
                </TouchableOpacity>
              )}
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
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[styles.branchItem, selectedBranch === index && (colorScheme === 'dark' ? styles.selectedBranchItemDark : styles.selectedBranchItem)]}
                  onPress={() => {
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
              )}
              ItemSeparatorComponent={() => <View style={[styles.branchSeparator, colorScheme === 'dark' ? styles.branchSeparatorDark : styles.branchSeparatorLight]} />}
            />
          </View>
        </View>
      </Modal>

      {/* Floating Meal of the Day Button */}
      <Animated.View 
        style={[
          styles.floatingMealButton,
          {
            transform: [
              {
                scale: buttonAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ],
            opacity: buttonAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
          },
        ]}
      >
        <TouchableOpacity 
          style={styles.floatingMealButtonInner}
          onPress={() => setShowMealPopup(true)}
        >
          <View style={styles.floatingMealIcon}>
            <Icon name="restaurant-menu" size={24} color="#fff" />
            <Text style={styles.floatingMealText}>Meal of the Day</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>


      {/* Meal of the Day Popup Modal */}
      <MealOfTheDayPopup 
        visible={showMealPopup}
        onClose={() => setShowMealPopup(false)}
        branchId={branches[selectedBranch]?.id}
      />
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
   /*  elevation: 5, */
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
   /*  elevation: 5, */
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
   /*  elevation: 3, */
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
   /*  elevation: 5, */
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
  headerLight: {
    backgroundColor: "#fff",
    borderBottomColor: "#e5e7eb",
  },
  headerDark: {
    backgroundColor: "#2a2a2a",
    borderBottomColor: "#444",
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
  // floatingMealButton: {   
  //   allignitem:"right",
  //   position: 'absolute',
  //   bottom: 100,
  //   left: 20,
  //   backgroundColor: 'red',
  //   borderRadius: 25,
  //   paddingHorizontal: 15,
  //   paddingVertical: 12,

  //   alignItems: 'center',
  //   elevation: 8,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 4 },
  //   shadowOpacity: 0.3,
  //   shadowRadius: 6,
  // },
  // floatingMealIcon: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  // },
  // floatingMealText: {
  //   color: '#fff',
  //   fontSize: 14,
  //   fontWeight: '600',
  //   marginRight: 1,
  // },
   
   
floatingMealButton: {   
  position: 'absolute',
  bottom: 100,
  left: 20,
},
floatingMealButtonInner: {
  backgroundColor: 'red',
  borderRadius: 25,
  paddingHorizontal: 15,
  paddingVertical: 12,
  flexDirection: 'row',
  alignItems: 'center',
  elevation: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 6,
},
floatingMealIcon: {
  flexDirection: 'row',
  alignItems: 'center',
},
floatingMealText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: '700',
  marginLeft: 8,
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
   /*  elevation: 5, */
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
});

export default Home;