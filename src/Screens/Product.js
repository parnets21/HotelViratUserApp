import { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  Animated,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Appearance,
  Alert,
  Modal,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/MaterialIcons"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { useCart } from "../context/CartContext"
import AsyncStorage from "@react-native-async-storage/async-storage"
import debounce from "lodash.debounce"

const { width } = Dimensions.get("window")
const CARD_WIDTH = width - 32

const Product = ({ route }) => {
  const navigation = useNavigation()
  const { 
    initialCategory = 0, 
    categoryId, 
    categories, 
    branchId, 
    product,
    menuItems: passedMenuItems = [],
    allMenuItems: passedAllMenuItems = {}
  } = route.params

  const { addToCart, removeFromCart, getBranchCartCount, getBranchCartItems, calculateBranchTotal, selectedBranch, cartItems: globalCartItems } =
    useCart()

  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId)
  const [categoryAnimatedValues, setCategoryAnimatedValues] = useState([])
  const [itemAnimatedValues, setItemAnimatedValues] = useState([])
  const [showViewCart, setShowViewCart] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [menuItems, setMenuItems] = useState([])
  const [allMenuItems, setAllMenuItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme())
  const [mealOfTheDayProduct, setMealOfTheDayProduct] = useState(product || null)
  const [imageErrors, setImageErrors] = useState({})
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [selectedItemForSubscription, setSelectedItemForSubscription] = useState(null)
  const [userSubscriptions, setUserSubscriptions] = useState([])
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme)
    })
    return () => subscription.remove()
  }, [])

  // Initialize menu items with passed data from Home screen
  useEffect(() => {
    console.log("🔍 Product screen received data:", {
      passedMenuItems: passedMenuItems.length,
      passedAllMenuItems: Object.keys(passedAllMenuItems).length,
      categoryId,
      categories: categories?.length
    });

    if (passedMenuItems.length > 0) {
      console.log("✅ Using passed menu items:", passedMenuItems.length);
      setMenuItems(passedMenuItems);
      setFilteredItems(passedMenuItems);
      setLoading(false);
    }

    if (Object.keys(passedAllMenuItems).length > 0) {
      console.log("✅ Using passed all menu items");
      // Convert the grouped menu items to a flat array
      const flatMenuItems = Object.values(passedAllMenuItems).flat();
      setAllMenuItems(flatMenuItems);
    }
  }, [passedMenuItems, passedAllMenuItems, categoryId]);

  // Helper function to check if subscription is available
  const hasSubscriptionAvailable = useCallback((item) => {
    const hasSubscription = item.subscriptionEnabled && (
      (item.subscription3Days && item.subscription3Days > 0) ||
      (item.subscription1Week && item.subscription1Week > 0) ||
      (item.subscription1Month && item.subscription1Month > 0)
    );
    
    return hasSubscription;
  }, []);

  // Helper function to check if user has active subscription for a product
  const hasActiveSubscription = (productId) => {
    return userSubscriptions.some(sub => 
      (sub.productId?._id || sub.productId) === productId && 
      (sub.status === 'active' || sub.status === 'paused')
    )
  }

  // Helper function to get user's subscription for a product
  const getUserSubscription = (productId) => {
    return userSubscriptions.find(sub => 
      (sub.productId?._id || sub.productId) === productId && 
      (sub.status === 'active' || sub.status === 'paused')
    )
  }

  // Helper function to calculate discounted price
  const getDiscountedPrice = (item) => {
    if (!hasActiveSubscription(item.id)) {
      return item.price // No subscription, return regular price
    }
    
    // Get user's subscription to determine which plan they have
    const userSubscription = getUserSubscription(item.id);
    if (!userSubscription) {
      return item.price // No subscription found, return regular price
    }
    
    // Return the actual subscription price based on user's plan
    let subscriptionPrice;
    switch (userSubscription.planType) {
      case 'daily':
      case '3days':
        subscriptionPrice = item.subscription3Days > 0 ? item.subscription3Days : item.price;
        return subscriptionPrice;
      case 'weekly':
      case '1week':
        subscriptionPrice = item.subscription1Week > 0 ? item.subscription1Week : item.price;
        return subscriptionPrice;
      case 'monthly':
      case '1month':
        subscriptionPrice = item.subscription1Month > 0 ? item.subscription1Month : item.price;
        return subscriptionPrice;
      default:
        return item.price;
    }
  }

  // Helper function to get price display with subscription info
  const getPriceDisplay = (item) => {
    const hasSubscription = hasActiveSubscription(item.id)
    const regularPrice = item.price
    const discountedPrice = getDiscountedPrice(item)
    const discount = getSubscriptionDiscount(item)
    
    return {
      hasSubscription,
      regularPrice,
      discountedPrice,
      discount,
      savings: regularPrice - discountedPrice
    }
  }

  // Helper function to get subscription discount - simplified to just check if discount exists
  const getSubscriptionDiscount = (item) => {
    // Just return a simple indicator that subscription is available
    // No need to calculate or show specific percentages
    return hasSubscriptionAvailable(item) ? 1 : 0;
  };

  // Define fetchMenuItems function - only fetch if no data was passed from Home
  const fetchMenuItems = useCallback(async () => {
    // Skip API fetch if we already have menu items from Home screen
    if (passedMenuItems.length > 0) {
      console.log("⏭️ Skipping API fetch - using passed menu items");
      return;
    }

    if (!branchId || !selectedCategoryId) return

    setLoading(true)
    try {
      const response = await fetch(
        `https://hotelvirat.com/api/v1/hotel/menu?categoryId=${selectedCategoryId}&branchId=${branchId}`,
      )
      const data = await response.json()

      if (Array.isArray(data)) {
        const formattedItems = data.map((item) => {
          // Get price - check both price field and prices object
          let itemPrice = item.price;
          if (!itemPrice && item.prices && typeof item.prices === 'object') {
            // Get first price from prices object
            const priceValues = Object.values(item.prices);
            itemPrice = priceValues.length > 0 ? priceValues[0] : 0;
          }
          
          // Construct image URL - use production server like admin panel
          let imageUrl = null;
          if (item.image) {
            if (item.image.startsWith('http')) {
              imageUrl = item.image;
            } else {
              // Use production server for images
              const prodBaseUrl = "https://hotelvirat.com";
              let cleanPath = item.image.toString().trim().replace(/\\/g, "/");
              
              if (cleanPath.startsWith("/")) {
                imageUrl = `${prodBaseUrl}${cleanPath}`;
              } else if (cleanPath.startsWith("uploads/")) {
                imageUrl = `${prodBaseUrl}/${cleanPath}`;
              } else {
                // Assume it's just a filename in uploads/menu/
                const filename = cleanPath.split("/").pop();
                imageUrl = `${prodBaseUrl}/uploads/menu/${filename}`;
              }
            }
          }
          
          return {
            id: item._id,
            name: item.name || item.itemName,
            price: itemPrice || 0,
            description: item.description || "",
            image: imageUrl,
            categoryId: typeof item.categoryId === 'object' ? item.categoryId._id : item.categoryId,
            branchId: typeof item.branchId === 'object' ? item.branchId._id : item.branchId,
            stock: item.stock || 0,
            lowStockAlert: item.lowStockAlert || 5,
            isActive: item.isActive !== false,
            subscriptionEnabled: item.subscriptionEnabled || false,
            subscriptionPlans: item.subscriptionPlans || [],
            subscriptionAmount: item.subscriptionAmount || 0,
            subscriptionDiscount: item.subscriptionDiscount || 0,
            subscriptionDuration: item.subscriptionDuration || '3days',
            subscription3Days: item.subscription3Days || 0,
            subscription1Week: item.subscription1Week || 0,
            subscription1Month: item.subscription1Month || 0,
            quantities: item.quantities || [],
            prices: item.prices || {}
          };
        })

        setMenuItems(formattedItems)
        setFilteredItems(formattedItems)

        // Initialize item animations
        const newItemAnimatedValues = Array(formattedItems.length)
          .fill()
          .map(() => new Animated.Value(0))
        setItemAnimatedValues(newItemAnimatedValues)

        // Animate items
        Animated.stagger(100, newItemAnimatedValues.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          })
        )).start()
      } else {
        setMenuItems([])
        setFilteredItems([])
      }
    } catch (error) {
      console.error("Error fetching menu items:", error)
      setError("Failed to load menu items")
    } finally {
      setLoading(false)
    }
  }, [branchId, selectedCategoryId])

  // Refresh menu items when screen comes into focus (to get latest stock info)
  useFocusEffect(
    useCallback(() => {
      fetchMenuItems()
      // Also refresh user subscriptions to show updated subscription status
      if (userId) {
        fetchUserSubscriptions(userId)
      }
    }, [fetchMenuItems, userId, passedMenuItems])
  )

  // Fetch user ID from AsyncStorage
  useEffect(() => {
    const getUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId")
        if (storedUserId) {
          setUserId(storedUserId)
          // Fetch user subscriptions when userId is available
          fetchUserSubscriptions(storedUserId)
        }
      } catch (error) {
        console.error("Error getting user ID:", error)  
      }
    }
    getUserId()
  }, [])

  // Fetch user's active subscriptions
  const fetchUserSubscriptions = async (userId) => {
    if (!userId) return
    
    setLoadingSubscriptions(true)
    try {
      const response = await fetch(
        `https://hotelvirat.com/api/v1/hotel/subscription-order/user/${userId}`,
      )
      const data = await response.json()
      
      if (data.success && data.data) {
        // Filter only active subscriptions
        const activeSubscriptions = data.data.filter(sub => 
          sub.status === 'active' || sub.status === 'paused'
        )
        setUserSubscriptions(activeSubscriptions)
      }
    } catch (error) {
      console.error("Error fetching user subscriptions:", error)
    } finally {
      setLoadingSubscriptions(false)
    }
  }

  // Fetch cart items with prices
  useEffect(() => {
    const fetchCartWithPrices = async () => {
      if (!userId || !branchId) return

      try {
        const response = await fetch(
          `https://hotelvirat.com/api/v1/hotel/cart?userId=${userId}&branchId=${branchId}`,
        )
        const data = await response.json()

        if (data && data.items) {
          setCartItems(
            data.items.map((item) => ({
              id: item.menuItemId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image: item.image,
            })),
          )
        }
      } catch (error) {
        console.error("Error fetching cart with prices:", error)
      }
    }

    fetchCartWithPrices()
  }, [userId, branchId, getBranchCartCount(selectedBranch)])

  // Fetch all menu items by iterating through all categories - only if no data passed
  useEffect(() => {
    const fetchAllMenuItems = async () => {
      // Skip API fetch if we already have all menu items from Home screen
      if (Object.keys(passedAllMenuItems).length > 0) {
        console.log("⏭️ Skipping all menu items API fetch - using passed data");
        return;
      }

      if (!branchId || !categories || categories.length === 0) return

      setLoading(true)
      try {
        let allItems = []
        for (const category of categories) {
          const response = await fetch(
            `https://hotelvirat.com/api/v1/hotel/menu?categoryId=${category.id}&branchId=${branchId}`,
          )
          const data = await response.json()

          if (Array.isArray(data)) {
            const formattedItems = data.map((item) => {
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
                description: item.description || "",
                image: item.image ? (item.image.startsWith('http') ? item.image : (() => {
                  const prodBaseUrl = "https://hotelvirat.com";
                  let cleanPath = item.image.toString().trim().replace(/\\/g, "/");
                  if (cleanPath.startsWith("/")) {
                    return `${prodBaseUrl}${cleanPath}`;
                  } else if (cleanPath.startsWith("uploads/")) {
                    return `${prodBaseUrl}/${cleanPath}`;
                  } else {
                    const filename = cleanPath.split("/").pop();
                    return `${prodBaseUrl}/uploads/menu/${filename}`;
                  }
                })()) : null,
                categoryId: item.categoryId,
                stock: item.stock || 0,
                lowStockAlert: item.lowStockAlert || 5,
                isActive: item.isActive !== false,
                subscriptionEnabled: item.subscriptionEnabled || false,
                subscriptionPlans: item.subscriptionPlans || [],
                subscriptionAmount: item.subscriptionAmount || 0,
                subscriptionDiscount: item.subscriptionDiscount || 0,
                subscriptionDuration: item.subscriptionDuration || '3days',
                subscription3Days: item.subscription3Days || 0,
                subscription1Week: item.subscription1Week || 0,
                subscription1Month: item.subscription1Month || 0
              };
            })
            allItems = [...allItems, ...formattedItems]
          }
        }

        // Remove duplicates by id (in case of overlapping items)
        const uniqueItems = Array.from(new Map(allItems.map((item) => [item.id, item])).values())
        setAllMenuItems(uniqueItems)
        console.log("All menu items fetched:", uniqueItems)
      } catch (error) {
        console.error("Error fetching all menu items:", error)
        setError("Failed to load menu items for search")
      } finally {
        setLoading(false)
      }
    }

    fetchAllMenuItems()
  }, [branchId, categories, passedAllMenuItems])

  // Update filtered items when menuItems change (category change)
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredItems(menuItems)
    } else {
      // Re-apply search filter to new category items
      const filtered = menuItems.filter((item) => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
      setFilteredItems(filtered)
    }
  }, [menuItems, searchQuery])

  // Fetch menu items for the selected category - only if no passed data
  useEffect(() => {
    fetchMenuItems()
  }, [fetchMenuItems, passedMenuItems])

  // Initialize animated values for categories
  useEffect(() => {
    if (categories && categories.length > 0) {
      const newCategoryAnimatedValues = Array(categories.length)
        .fill()
        .map(() => new Animated.Value(1))
      setCategoryAnimatedValues(newCategoryAnimatedValues)
    }
  }, [categories])

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((query) => {
      console.log("Searching with query:", query)
      if (query.trim() === "") {
        setFilteredItems(menuItems)
        const newItemAnimatedValues = Array(menuItems.length)
          .fill()
          .map(() => new Animated.Value(1))
        setItemAnimatedValues(newItemAnimatedValues)
      } else {
        // Search only within the current category's menu items, not all items
        const filtered = menuItems.filter((item) => item.name.toLowerCase().includes(query.toLowerCase().trim()))
        setFilteredItems(filtered)
        console.log("Filtered items:", filtered)
        const newItemAnimatedValues = Array(filtered.length)
          .fill()
          .map(() => new Animated.Value(1))
        setItemAnimatedValues(newItemAnimatedValues)
      }
    }, 300),
    [menuItems], // Only depend on menuItems, not allMenuItems
  )

  // Update filtered items based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredItems(menuItems)
    } else {
      const filtered = menuItems.filter((item) => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
      setFilteredItems(filtered)
    }
  }, [searchQuery, menuItems])

  // Update cart visibility
  useEffect(() => {
    const cartCount = getBranchCartCount(selectedBranch)
    console.log('🛒 Cart visibility check:', { selectedBranch, cartCount, globalCartItems })
    console.log('🛒 Cart items for branch:', globalCartItems[selectedBranch])
    setShowViewCart(cartCount > 0)
  }, [selectedBranch, globalCartItems, getBranchCartCount])

  const handleCategoryPress = (categoryId, index) => {
    if (categoryAnimatedValues[index]) {
      Animated.sequence([
        Animated.timing(categoryAnimatedValues[index], {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(categoryAnimatedValues[index], {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()
    }
    setSelectedCategory(index)
    setSelectedCategoryId(categoryId)
  }

  const handleAddToCart = async (item, index) => {
    if (!userId) {
      console.error("User ID not available")
      return
    }
    
    // Check if user already has an active subscription
    if (hasActiveSubscription(item.id)) {
      await addItemToCart(item, index)
      return
    }
    
    // Check if item has subscription enabled and show modal for choice
    const hasSubscription = hasSubscriptionAvailable(item);
    
    if (hasSubscription) {
      setSelectedItemForSubscription({ item, index })
      setShowSubscriptionModal(true)
      return
    }

    // Proceed with normal add to cart
    await addItemToCart(item, index)
  }

  const addItemToCart = async (item, index) => {
    if (itemAnimatedValues[index]) {
      Animated.sequence([
        Animated.timing(itemAnimatedValues[index], {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(itemAnimatedValues[index], {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()
    }

    try {
      // Get the correct price (discounted if user has subscription)
      const priceInfo = getPriceDisplay(item)
      const finalPrice = priceInfo.hasSubscription ? priceInfo.discountedPrice : priceInfo.regularPrice
      
      // Create item with correct price for cart context
      const cartItem = {
        ...item,
        price: finalPrice,
        originalPrice: priceInfo.regularPrice,
        isDiscounted: priceInfo.hasSubscription,
        discount: priceInfo.discount,
        savings: priceInfo.savings
      }

      // Update local cart state using branch index for CartContext
      console.log('🛒 Adding to cart:', { selectedBranch, cartItem, quantity: 1 })
      addToCart(selectedBranch, cartItem, 1)
      
      // Log cart count after adding
      setTimeout(() => {
        const newCount = getBranchCartCount(selectedBranch)
        console.log('🛒 Cart count after adding:', newCount)
      }, 100)

      // Immediately update local cartItems state
      setCartItems((prevItems) => {
        const existingItem = prevItems.find((i) => i.id === item.id)
        if (existingItem) {
          return prevItems.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1, price: finalPrice } : i))
        } else {
          return [...prevItems, { ...cartItem, quantity: 1 }]
        }
      })

      // Sync with server using actual branchId (MongoDB ObjectId)
      console.log('Adding to cart with price:', { 
        userId, 
        branchId, 
        menuItemId: item.id, 
        itemName: item.name,
        price: finalPrice,
        originalPrice: priceInfo.regularPrice,
        isDiscounted: priceInfo.hasSubscription
      })
      
      const response = await fetch("https://hotelvirat.com/api/v1/hotel/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          branchId: branchId,
          menuItemId: item.id,
          quantity: 1,
          price: finalPrice, // Send the correct price (discounted or regular)
        }),
      })
      
      const responseData = await response.json()
      console.log('Cart add response:', responseData)
      
      if (!response.ok) {
        console.error("Failed to add item to cart:", responseData)
      }
    } catch (error) {
      console.error("Error adding item to cart:", error)
    }
  }

  const handleRemoveFromCart = async (item, index) => {
    if (!userId) {
      console.error("User ID not available")
      return
    }

    if (itemAnimatedValues[index]) {
      Animated.sequence([
        Animated.timing(itemAnimatedValues[index], {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(itemAnimatedValues[index], {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()
    }

    try {
      removeFromCart(selectedBranch, item.id, 1)
      setCartItems((prevItems) => {
        return prevItems
          .map((i) => {
            if (i.id === item.id) {
              const newQuantity = i.quantity - 1
              return newQuantity > 0 ? { ...i, quantity: newQuantity } : null
            }
            return i
          })
          .filter(Boolean)
      })

      const quantity = getItemQuantity(item.id) - 1
      if (quantity <= 0) {
        await fetch(
          `https://hotelvirat.com/api/v1/hotel/cart/remove?userId=${userId}&branchId=${branchId}&menuItemId=${item.id}`,
          {
            method: "DELETE",
          },
        )
      } else {
        await fetch("https://hotelvirat.com/api/v1/hotel/cart/update", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: userId,
            branchId: branchId,
            menuItemId: item.id,
            quantity: quantity,
          }),
        })
      }
    } catch (error) {
      console.error("Error removing item from cart:", error)
    }
  }

  const getItemQuantity = (itemId) => {
    const cartItems = getBranchCartItems(selectedBranch)
    const item = cartItems.find((item) => item.id.toString() === itemId.toString())
    return item ? item.quantity : 0
  }

  const renderCartControl = (item, index) => {
    const quantity = getItemQuantity(item.id)

    return (
      <View style={styles.cartControlContainer}>
        {quantity > 0 ? (
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={[styles.quantityButton, styles.minusButton]} 
              onPress={() => handleRemoveFromCart(item, index)}
            >
              <Icon name="remove" size={18} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.quantityDisplay}>
              <Text style={styles.quantityText}>
                {quantity}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.quantityButton, styles.plusButton]} 
              onPress={() => handleAddToCart(item, index)}
            >
              <Icon name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={[
              styles.addButton,
              hasSubscriptionAvailable(item) && !hasActiveSubscription(item.id) && styles.subscriptionAddButton,
              hasActiveSubscription(item.id) && styles.subscribedAddButton
            ]} 
            onPress={() => handleAddToCart(item, index)}
          >
            <Icon name="add-shopping-cart" size={18} color="#fff" />
            <Text style={styles.addButtonText}>
              {hasActiveSubscription(item.id) 
                ? "ADD" 
                : hasSubscriptionAvailable(item) 
                  ? "ADD / SUB" 
                  : "ADD"
              }
            </Text>
          </TouchableOpacity>
        )}
        
        {/* No separate subscribe button - subscription option appears in modal when clicking ADD */}
      </View>
    )
  }

  const renderFoodItem = ({ item, index }) => {
    return (
      <Animated.View style={[
        styles.foodCard, 
        { transform: [{ scale: itemAnimatedValues[index] || 1 }] },
        colorScheme === 'dark' ? styles.foodCardDark : styles.foodCardLight
      ]}>
        <View style={styles.foodItemContent}>
          <View style={styles.foodImageContainer}>
            <Image
              source={
                imageErrors[item.id] || !item.image 
                  ? require("../assets/lemon.jpg") 
                  : { uri: item.image }
              }
              style={styles.foodImage}
              onError={(error) => {
                setImageErrors(prev => ({ ...prev, [item.id]: true }));
              }}
              onLoad={() => {
                setImageErrors(prev => ({ ...prev, [item.id]: false }));
              }}
            />
            {/* Subscription Badge - only show for items with subscription available but not subscribed */}
            {hasSubscriptionAvailable(item) && !hasActiveSubscription(item.id) && (
              <View style={styles.subscriptionBadge}>
                <Icon name="autorenew" size={12} color="#FFD700" />
                <Text style={styles.subscriptionBadgeText}>SUB</Text>
              </View>
            )}
          </View>
          
          <View style={styles.foodDetails}>
            <View style={styles.foodNameContainer}>
              <Text style={[styles.foodName, colorScheme === 'dark' ? styles.textDark : styles.textLight]} numberOfLines={2}>
                {item.name}
              </Text>
              {/* Subscription Icon next to name for available subscriptions */}
              {hasSubscriptionAvailable(item) && !hasActiveSubscription(item.id) && (
                <Icon name="autorenew" size={16} color="#800000" style={styles.subscriptionIcon} />
              )}
              {/* Small green dot for subscribed items */}
              {hasActiveSubscription(item.id) && (
                <View style={styles.subscribedDot} />
              )}
            </View>
            <Text style={[styles.foodDescription, colorScheme === 'dark' ? styles.descriptionDark : styles.descriptionLight]} numberOfLines={3}>
              {item.description}
            </Text>
            <View style={styles.priceAndCartContainer}>
              <View style={styles.priceSection}>
                {(() => {
                  const priceInfo = getPriceDisplay(item);
                  
                  if (priceInfo.hasSubscription) {
                    // User has subscription - show discounted price without percentage
                    return (
                      <>
                        <Text style={[styles.discountedPrice, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                          ₹{priceInfo.discountedPrice.toFixed(2)}
                        </Text>
                        <Text style={styles.subscriberSavingsText}>
                          Subscriber Price
                        </Text>
                      </>
                    );
                  } else {
                    // No subscription - show regular price
                    return (
                      <>
                        <Text style={[styles.foodPrice, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                          ₹{priceInfo.regularPrice.toFixed(2)}
                        </Text>
                        {/* Subscription discount text below price */}
                        {hasSubscriptionAvailable(item) && (
                          <Text style={styles.subscriptionDiscountText}>
                            Subscribe for Special Price
                          </Text>
                        )}
                      </>
                    );
                  }
                })()}
              </View>
              {renderCartControl(item, index)}
            </View>
          </View>
        </View>
      </Animated.View>
    )
  }

  const toggleSearch = () => {
    setIsSearchActive(!isSearchActive)
    setSearchQuery("")
  }

  if (loading && !menuItems.length) {
    return (
      <View style={[styles.loadingContainer, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={[styles.loadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Loading menu items...</Text>
      </View>
    )
  }

  if (error && !menuItems.length) {
    return (
      <View style={[styles.errorContainer, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <Icon name="error-outline" size={60} color="#FFD700" />
        <Text style={[styles.errorText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, colorScheme === 'dark' ? styles.retryButtonDark : styles.retryButtonLight]}
          onPress={() => {
            setError(null)
            setLoading(true)
            setSelectedCategoryId(selectedCategoryId)
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar backgroundColor={colorScheme === 'dark' ? '#1a1a1a' : '#fff'} barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#800000" />
        </TouchableOpacity>
        {isSearchActive ? (
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, colorScheme === 'dark' ? styles.searchInputDark : styles.searchInputLight]}
              placeholder="Search menu items..."
              placeholderTextColor={colorScheme === 'dark' ? '#888' : '#999'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={() => setSearchQuery("")}>
                {/* <Icon name="close" size={20} color="#800000" /> */}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={[styles.headerTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{categories[selectedCategory]?.name || "Menu"}</Text>
        )}
        <TouchableOpacity style={styles.headerRight} onPress={toggleSearch}>
          <Icon name={isSearchActive ? "close" : "search"} size={24} color="#800000" />
        </TouchableOpacity>
      </View>

      {/* Meal of the Day Product Section */}
      {mealOfTheDayProduct && (
        <View style={styles.mealOfTheDaySection}>
          <View style={styles.mealOfTheDayHeader}>
            <View style={styles.mealOfTheDayTitleContainer}>
              <Icon name="star" size={20} color="#FFD700" />
              <Text style={styles.mealOfTheDayTitle}>Meal of the Day</Text>
              <Icon name="star" size={20} color="#FFD700" />
            </View>
          </View>
          
          <View style={styles.mealOfTheDayCard}>
            <Image
              source={{
                uri: mealOfTheDayProduct.image || 'https://via.placeholder.com/300x200'
              }}
              style={styles.mealOfTheDayImage}
              resizeMode="cover"
            />
            <View style={styles.mealOfTheDayContent}>
              <Text style={styles.mealOfTheDayProductTitle}>{mealOfTheDayProduct.name}</Text>
              <Text style={styles.mealOfTheDayDescription} numberOfLines={3}>
                {mealOfTheDayProduct.description}
              </Text>
              
              <View style={styles.mealOfTheDayPriceContainer}>
                <View style={styles.mealOfTheDayPriceRow}>
                  <Text style={styles.mealOfTheDayOriginalPrice}>₹{mealOfTheDayProduct.originalPrice}</Text>
                  <Text style={styles.mealOfTheDaySpecialPrice}>₹{mealOfTheDayProduct.price}</Text>
                </View>
                <Text style={styles.mealOfTheDaySavings}>
                  Save ₹{mealOfTheDayProduct.originalPrice - mealOfTheDayProduct.price}
                </Text>
              </View>

              {mealOfTheDayProduct.tags && mealOfTheDayProduct.tags.length > 0 && (
                <View style={styles.mealOfTheDayTags}>
                  {mealOfTheDayProduct.tags.map((tag, index) => (
                    <View key={index} style={styles.mealOfTheDayTag}>
                      <Text style={styles.mealOfTheDayTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity 
                style={styles.mealOfTheDayAddButton}
                onPress={() => {
                  addToCart(mealOfTheDayProduct);
                  Alert.alert('Added to Cart!', `${mealOfTheDayProduct.name} has been added to your cart`);
                }}
              >
                <Icon name="shopping-cart" size={20} color="white" />
                <Text style={styles.mealOfTheDayAddButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Hide category tabs when coming from specific category selection from Home screen */}
      {!route.params?.categoryId && categories && categories.length > 1 && (
        <View style={[styles.categoryWrapper, colorScheme === 'dark' ? styles.categoryWrapperDark : styles.categoryWrapperLight]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryContainer}
            style={styles.categoryScroll}
          >
            {categories?.map((category, index) => (
              <Animated.View key={category.id} style={{ transform: [{ scale: categoryAnimatedValues[index] || 1 }] }}>
                <TouchableOpacity
                  onPress={() => handleCategoryPress(category.id, index)}
                  style={[styles.categoryButton, selectedCategory === index && (colorScheme === 'dark' ? styles.selectedCategoryDark : styles.selectedCategory)]}
                >
                  <Text style={[styles.categoryText, selectedCategory === index && styles.selectedCategoryText]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderFoodItem}
        contentContainerStyle={styles.menuContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          searchQuery.trim() !== "" && filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No items found</Text>
            </View>
          ) : menuItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No menu items available in this category</Text>
            </View>
          ) : null
        }
      />

      {showViewCart && (
        <TouchableOpacity style={[styles.viewCartButton, colorScheme === 'dark' ? styles.viewCartButtonDark : styles.viewCartButtonLight]} onPress={() => navigation.navigate("MyCart")}>
          <View style={styles.viewCartContent}>
            <View style={styles.viewCartLeft}>
              <Text style={styles.viewCartCount}>{getBranchCartCount(selectedBranch)} ITEMS</Text>
              <Text style={styles.viewCartTotal}>₹{calculateBranchTotal(selectedBranch).toFixed(2)}</Text>
            </View>
            <View style={styles.viewCartRight}>
              <Text style={styles.viewCartText}>VIEW CART</Text>
              <Icon name="arrow-forward" size={20} color="#FFD700" />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Subscription Choice Modal */}
      <Modal
        visible={showSubscriptionModal && selectedItemForSubscription !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSubscriptionModal(false)
          setSelectedItemForSubscription(null)
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.subscriptionModalContainer, colorScheme === 'dark' ? styles.modalDark : styles.modalLight]}>
            {selectedItemForSubscription && selectedItemForSubscription.item && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                    Choose Your Option
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setShowSubscriptionModal(false)
                      setSelectedItemForSubscription(null)
                    }}
                    style={styles.closeButton}
                  >
                    <Icon name="close" size={24} color="#800000" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalContent}>
                  <View style={styles.itemInfo}>
                    <Image
                      source={
                        selectedItemForSubscription?.item?.image 
                          ? { uri: selectedItemForSubscription.item.image }
                          : require("../assets/lemon.jpg")
                      }
                      style={styles.modalItemImage}
                    />
                    <View style={styles.itemDetails}>
                      <Text style={[styles.modalItemName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                        {selectedItemForSubscription?.item?.name || ''}
                      </Text>
                      <Text style={[styles.modalItemPrice, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                        ₹{(selectedItemForSubscription?.item?.price || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.optionsContainer}>
                    {/* Buy Normally Option */}
                    <TouchableOpacity
                      style={[styles.optionButton, styles.normalBuyButton]}
                      onPress={async () => {
                        setShowSubscriptionModal(false)
                        if (selectedItemForSubscription?.item && selectedItemForSubscription?.index !== undefined) {
                          await addItemToCart(selectedItemForSubscription.item, selectedItemForSubscription.index)
                        }
                        setSelectedItemForSubscription(null)
                      }}
                    >
                      <View style={styles.optionContent}>
                        <Icon name="shopping-cart" size={24} color="#fff" />
                        <View style={styles.optionText}>
                          <Text style={styles.optionTitle}>Buy Now</Text>
                          <Text style={styles.optionSubtitle}>
                            Pay ₹{(selectedItemForSubscription?.item?.price || 0).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Subscribe First Option */}
                    <TouchableOpacity
                      style={[styles.optionButton, styles.subscribeFirstButton]}
                      onPress={() => {
                        setShowSubscriptionModal(false)
                        if (selectedItemForSubscription?.item) {
                          navigation.navigate('SubscriptionOrder', { product: selectedItemForSubscription.item })
                        }
                        setSelectedItemForSubscription(null)
                      }}
                    >
                      <View style={styles.optionContent}>
                        <Icon name="autorenew" size={24} color="#800000" />
                        <View style={styles.optionText}>
                          <Text style={styles.subscribeOptionTitle}>Subscribe First</Text>
                          <Text style={styles.subscribeOptionSubtitle}>
                            Choose from multiple plans
                          </Text>
                          <Text style={styles.subscribeOptionBenefit}>
                            Then get special pricing on future orders!
                          </Text>
                        </View>
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsText}>
                            SPECIAL PRICE
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.modalNote, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                    💡 Subscribe once and enjoy special pricing on all future orders of this item!
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

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
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  textLight: {
    color: "#1f2937",
  },
  textDark: {
    color: "#e5e5e5",
  },
  descriptionLight: {
    color: "#6b7280",
  },
  descriptionDark: {
    color: "#888",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
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
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    elevation: 2,
  },
  headerLight: {
    backgroundColor: "#fff",
    borderBottomColor: "#e5e7eb",
  },
  headerDark: {
    backgroundColor: "#2a2a2a",
    borderBottomColor: "#444",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerRight: {
    padding: 8,
  },
  searchContainer: {
    flex: 1,
    position: "relative",
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  searchInputLight: {
    backgroundColor: "#f3f4f6",
    color: "#1f2937",
  },
  searchInputDark: {
    backgroundColor: "#3a3a3a",
    color: "#e5e5e5",
  },
  clearButton: {
    position: "absolute",
    right: 10,
    top: 10,
    padding: 4,
  },
  categoryWrapper: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    elevation: 1,
  },
  categoryWrapperLight: {
    backgroundColor: "#fff",
    borderBottomColor: "#f0f0f0",
  },
  categoryWrapperDark: {
    backgroundColor: "#2a2a2a",
    borderBottomColor: "#444",
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: "center",
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    marginRight: 12,
    borderWidth: 1,
  },
  categoryButtonLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  categoryButtonDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  selectedCategory: {
    backgroundColor: "#800000",
    borderColor: "#800000",
  },
  selectedCategoryDark: {
    backgroundColor: "#4a0000",
    borderColor: "#4a0000",
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFD700",
  },
  selectedCategoryText: {
    color: "#FFD700",
    fontWeight: "700",
  },
  menuContainer: {
    padding: 8,
    paddingBottom: 80,
  },
  foodCard: {
    marginHorizontal: 8,
    marginVertical: 6,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 120, // Reduced height since UI is now simpler
  },
  foodCardLight: {
    backgroundColor: "#fff",
  },
  foodCardDark: {
    backgroundColor: "#2a2a2a",
  },
  foodItemContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  foodImageContainer: {
    width: 120,
    height: 120,
    marginRight: 16,
    position: 'relative',
  },
  foodImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    resizeMode: "cover",
  },
  subscriptionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#800000', // Changed to maroon
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    minWidth: 45,
    justifyContent: 'center',
  },
  subscriptionBadgeText: {
    color: '#FFD700', // Gold text on maroon background
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 2,
    textAlign: 'center',
  },
  subscribedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#28a745', // Green for subscribed
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    minWidth: 70,
    justifyContent: 'center',
  },
  subscribedBadgeText: {
    color: '#FFD700', // Gold text on green background
    fontSize: 8,
    fontWeight: '700',
    marginLeft: 2,
    textAlign: 'center',
  },
  foodDetails: {
    flex: 1,
    justifyContent: "space-between",
    minHeight: 100, // Reduced minimum height
  },
  foodNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  foodName: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
    flex: 1,
  },
  subscriptionIcon: {
    marginLeft: 6,
  },
  subscribedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28a745',
    marginLeft: 6,
    marginTop: 6,
  },
  foodDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 12,
    flex: 1,
  },
  priceAndCartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end", // Changed to flex-end to align button to bottom
    marginTop: 8, // Added margin to give more space
  },
  priceSection: {
    flex: 1,
    marginRight: 8, // Added margin to separate from button
  },
  foodPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#800000",
  },
  subscriptionDiscountText: {
    fontSize: 11,
    color: "#28a745",
    fontWeight: "600",
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  originalPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountedPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#28a745", // Green for discounted price
  },
  subscriberSavingsText: {
    fontSize: 11,
    color: "#28a745",
    fontWeight: "600",
    marginTop: 2,
  },
  // Cart Control Styles
  cartControlContainer: {
    alignItems: "flex-end",
    justifyContent: "flex-end", // Ensure button stays at bottom
    minHeight: 40, // Minimum height for button area
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 25,
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  minusButton: {
    backgroundColor: "#ff6b6b",
  },
  plusButton: {
    backgroundColor: "#51cf66",
  },
  quantityDisplay: {
    minWidth: 45,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  addButton: {
    backgroundColor: "#800000",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#800000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  addButtonText: {
    color: "#FFD700", // Keep gold text
    fontWeight: "700",
    fontSize: 14,
  },
  subscriptionAddButton: {
    backgroundColor: "#800000", // Changed from yellow to maroon
    borderWidth: 2,
    borderColor: "#FFD700", // Gold border for subscription items
  },
  subscribedAddButton: {
    backgroundColor: "#28a745", // Green for subscribed users
    borderWidth: 2,
    borderColor: "#FFD700", // Gold border
  },
  subscribeButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  subscribeButtonText: {
    color: "#800000",
    fontWeight: "600",
    fontSize: 11,
    textAlign: 'center',
  },
  viewCartButton: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 14,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  viewCartButtonLight: {
    backgroundColor: "#800000",
  },
  viewCartButtonDark: {
    backgroundColor: "#4a0000",
  },
  viewCartContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewCartLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewCartCount: {
    color: "#FFD700",
    fontWeight: "600",
    fontSize: 14,
    marginRight: 10,
  },
  viewCartTotal: {
    color: "#FFD700",
    fontWeight: "700",
    fontSize: 16,
  },
  viewCartRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewCartText: {
    color: "#FFD700",
    fontWeight: "700",
    fontSize: 16,
    marginRight: 5,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
  },
  // Meal of the Day Styles
  mealOfTheDaySection: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  mealOfTheDayHeader: {
    alignItems: 'center',
    marginBottom: 15,
  },
  mealOfTheDayTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealOfTheDayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#800000',
    marginHorizontal: 10,
  },
  mealOfTheDayCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mealOfTheDayImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginRight: 15,
  },
  mealOfTheDayContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mealOfTheDayProductTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  mealOfTheDayDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 10,
  },
  mealOfTheDayPriceContainer: {
    marginBottom: 10,
  },
  mealOfTheDayPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  mealOfTheDayOriginalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  mealOfTheDaySpecialPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
  },
  mealOfTheDaySavings: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
  },
  mealOfTheDayTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  mealOfTheDayTag: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  mealOfTheDayTagText: {
    fontSize: 10,
    color: '#495057',
  },
  mealOfTheDayAddButton: {
    backgroundColor: '#800000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  mealOfTheDayAddButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  // Subscription Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  subscriptionModalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalLight: {
    backgroundColor: '#fff',
  },
  modalDark: {
    backgroundColor: '#2a2a2a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    alignItems: 'center',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    width: '100%',
  },
  modalItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalItemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#800000',
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  optionButton: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  normalBuyButton: {
    backgroundColor: '#800000',
  },
  subscribeFirstButton: {
    backgroundColor: '#FFD700',
    borderWidth: 2,
    borderColor: '#800000',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#FFD700',
  },
  subscribeOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#800000',
    marginBottom: 4,
  },
  subscribeOptionSubtitle: {
    fontSize: 14,
    color: '#800000',
    marginBottom: 2,
  },
  subscribeOptionBenefit: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
  },
  savingsBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalNote: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
  },
})

export default Product
