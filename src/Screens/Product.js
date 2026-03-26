import { useState, useEffect, useCallback, useMemo } from "react"
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
import { API_BASE_URL, IMAGE_BASE_URL } from "../config/api"

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


  // Helper function to trim numbers from item names
  const trimNumbersFromName = (name) => {
    if (!name) return name;
    
    // Remove numbers from the beginning (e.g., "123 Masala Dosa" -> "Masala Dosa")
    // Remove numbers from the end (e.g., "Masala Dosa 123" -> "Masala Dosa")
    // Also handles formats like "123. Masala Dosa" or "Masala Dosa - 123"
    return name
      .replace(/^\d+[\s\.\-:]*/, '') // Remove leading numbers with optional separators
      .replace(/[\s\.\-:]*\d+$/, '') // Remove trailing numbers with optional separators
      .trim();
  };

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

    // Clear image cache to ensure fresh images
    console.log("🧹 Clearing image cache to force fresh image loads");

    if (passedMenuItems.length > 0) {
      console.log("✅ Using passed menu items:", passedMenuItems.length);
      
      // Pre-process subscription data to avoid repeated calculations
      const processedItems = passedMenuItems.map(item => ({
        ...item,
        name: trimNumbersFromName(item.name), // Trim numbers from item name
        _hasSubscription: hasSubscriptionAvailable(item),
        _subscriptionLogged: false
      }));
      
      // Log subscription summary
      const subscriptionCount = processedItems.filter(item => item._hasSubscription).length;
      console.log(`📊 Subscription Summary: ${subscriptionCount}/${processedItems.length} items have valid subscriptions`);
      
      setMenuItems(processedItems);
      setFilteredItems(processedItems);
      setLoading(false);
    } else {
      // If no passed items, just show empty state
      console.log("⚠️ No passed items available");
      setMenuItems([]);
      setFilteredItems([]);
      setLoading(false);
    }

    if (Object.keys(passedAllMenuItems).length > 0) {
      console.log("✅ Using passed all menu items");
      // Convert the grouped menu items to a flat array
      const flatMenuItems = Object.values(passedAllMenuItems).flat();
      
      // Pre-process subscription data for all items
      const processedAllItems = flatMenuItems.map(item => ({
        ...item,
        name: trimNumbersFromName(item.name), // Trim numbers from item name
        _hasSubscription: hasSubscriptionAvailable(item),
        _subscriptionLogged: false
      }));
      
      // Log subscription summary for all items
      const allSubscriptionCount = processedAllItems.filter(item => item._hasSubscription).length;
      console.log(`📊 All Items Subscription Summary: ${allSubscriptionCount}/${processedAllItems.length} items have valid subscriptions`);
      
      setAllMenuItems(processedAllItems);
    }
  }, [passedMenuItems, passedAllMenuItems, categoryId, hasSubscriptionAvailable]);

  // Helper function to validate image URL
  const validateImageUrl = async (url) => {
    if (!url) return false;
    
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        timeout: 5000 // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.log(`❌ Image URL validation failed for ${url}:`, error.message);
      return false;
    }
  };

  // Enhanced image component with fallback logic
  const EnhancedImage = ({ item, style, onError, onLoad, onLoadStart }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [hasError, setHasError] = useState(false);
    
    // Generate multiple possible image URLs
    const getImageUrls = (originalImage) => {
      if (!originalImage) return [];
      
      if (originalImage.startsWith('http')) {
        return [originalImage];
      }
      
      let cleanPath = originalImage.toString().trim().replace(/\\/g, "/");
      
      // Generate multiple URL patterns to try
      const urls = [];
      
      // Pattern 1: Direct path as stored
      if (cleanPath.startsWith("uploads/")) {
        urls.push(`https://hotelvirat.com/${cleanPath}`);
      } else if (cleanPath.startsWith("/uploads/")) {
        urls.push(`https://hotelvirat.com${cleanPath}`);
      } else {
        // Pattern 2: Assume it's in uploads/menu/
        const filename = cleanPath.split("/").pop();
        urls.push(`https://hotelvirat.com/uploads/menu/${filename}`);
      }
      
      // Pattern 3: URL encode spaces and special characters
      urls.forEach(url => {
        const encodedUrl = url.replace(/ /g, '%20');
        if (encodedUrl !== url) {
          urls.push(encodedUrl);
        }
      });
      
      // Pattern 4: Production fallback
      if (cleanPath.startsWith("uploads/")) {
        urls.push(`https://hotelvirat.com/${cleanPath}`);
      } else if (cleanPath.startsWith("/uploads/")) {
        urls.push(`https://hotelvirat.com${cleanPath}`);
      } else {
        const filename = cleanPath.split("/").pop();
        urls.push(`https://hotelvirat.com/uploads/menu/${filename}`);
      }
      
      return [...new Set(urls)]; // Remove duplicates
    };
    
    const imageUrls = getImageUrls(item.image);
    const currentUrl = imageUrls[currentImageIndex];
    
    const handleImageError = (error) => {
      console.log(`❌ Image failed for "${item.name}" (attempt ${currentImageIndex + 1}/${imageUrls.length}):`, {
        url: currentUrl,
        error: error.nativeEvent?.error || 'Unknown error'
      });
      
      // Try next URL if available
      if (currentImageIndex < imageUrls.length - 1) {
        setCurrentImageIndex(prev => prev + 1);
      } else {
        // All URLs failed, use fallback
        setHasError(true);
        if (onError) onError(error);
      }
    };
    
    const handleImageLoad = () => {
      console.log(`✅ Image loaded for "${item.name}":`, currentUrl);
      setHasError(false);
      if (onLoad) onLoad();
    };
    
    const handleImageLoadStart = () => {
      console.log(`🔄 Loading image for "${item.name}":`, currentUrl);
      if (onLoadStart) onLoadStart();
    };
    
    if (hasError || !currentUrl) {
      // No image available - don't show anything
      return null;
    }
    
    return (
      <Image
        source={{ uri: currentUrl }}
        style={style}
        onError={handleImageError}
        onLoad={handleImageLoad}
        onLoadStart={handleImageLoadStart}
      />
    );
  };

  // Helper function to get fallback image URLs
  const getImageWithFallback = (originalImage) => {
    if (!originalImage) return null;
    
    if (originalImage.startsWith('http')) {
      return originalImage;
    }
    
    // Handle relative paths
    let cleanPath = originalImage.toString().trim().replace(/\\/g, "/");
    
    // Ensure path starts with /
    if (!cleanPath.startsWith("/")) {
      if (cleanPath.startsWith("uploads/")) {
        cleanPath = "/" + cleanPath;
      } else {
        // Assume it's just a filename, put it in uploads/menu/
        const filename = cleanPath.split("/").pop();
        cleanPath = `/uploads/menu/${filename}`;
      }
    }
    
    // Try multiple URL patterns
    const possibleUrls = [
      `https://hotelvirat.com${cleanPath}`, // Local server
      `https://hotelvirat.com${cleanPath}`, // Production server
    ];
    
    return possibleUrls[0]; // Return first URL for now, we'll validate in the Image component
  };

  // Network connectivity test
  const testNetworkConnectivity = async () => {
    try {
      console.log('🔍 Testing network connectivity...');
      
      // Test API connectivity
      const apiResponse = await fetch(`${API_BASE_URL}/menu`, { 
        method: 'HEAD',
        timeout: 5000 
      });
      console.log(`✅ API connectivity: ${apiResponse.status}`);
      
      // Test image server connectivity
      const imageResponse = await fetch('https://hotelvirat.com/uploads/menu/', { 
        method: 'HEAD',
        timeout: 5000 
      });
      console.log(`✅ Image server connectivity: ${imageResponse.status}`);
      
      return true;
    } catch (error) {
      console.log(`❌ Network connectivity test failed:`, error.message);
      return false;
    }
  };

  // Run connectivity test on component mount
  useEffect(() => {
    testNetworkConnectivity();
  }, []);

  // Helper function to check if subscription is available - optimized with memoization
  const hasSubscriptionAvailable = useCallback((item) => {
    // Check multiple possible field names for subscription enabled
    const isSubscriptionEnabled = !!(
      item.subscriptionEnabled || 
      item.hasSubscription || 
      item.subscription || 
      item.isSubscriptionEnabled
    );
    
    // If subscription is enabled, we consider it available regardless of specific pricing
    // The pricing can be calculated dynamically or use default values
    if (isSubscriptionEnabled) {
      // Only log for items that actually have subscription enabled (reduce console spam)
      if (!item._subscriptionLogged) {
        console.log(`🔍 Subscription available for "${item.name}":`, {
          isSubscriptionEnabled,
          regularPrice: item.price,
          subscription3Days: item.subscription3Days || 0,
          subscription1Week: item.subscription1Week || 0,
          subscription1Month: item.subscription1Month || 0,
        });
        item._subscriptionLogged = true; // Mark as logged to prevent repeated logs
      }
      return true;
    }
    
    return false;
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
    
    // Calculate discounted price based on percentage discount
    let discountPercentage = 0;
    switch (userSubscription.planType) {
      case 'daily':
      case '3days':
        discountPercentage = item.subscription3DaysDiscount || 0;
        break;
      case 'weekly':
      case '1week':
        discountPercentage = item.subscription1WeekDiscount || 0;
        break;
      case 'monthly':
      case '1month':
        discountPercentage = item.subscription1MonthDiscount || 0;
        break;
      default:
        return item.price;
    }
    
    // Calculate discounted price: original price - (original price * discount percentage / 100)
    const discountedPrice = item.price * (1 - discountPercentage / 100);
    return Math.round(discountedPrice);
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
    // Use pre-calculated subscription availability instead of calling function
    return item._hasSubscription ? 1 : 0;
  };

  // Define fetchMenuItems function - ALWAYS fetch fresh data to check for subscription fields
  const fetchMenuItems = useCallback(async () => {
    if (!branchId || !selectedCategoryId) return

    setLoading(true)
    try {
      // Use high limit to get ALL items (backend has pagination with limit=100 default)
      const apiUrl = `${API_BASE_URL}/menu?categoryId=${selectedCategoryId}&branchId=${branchId}&limit=10000`;
      console.log("🌐 Fetching fresh menu items from API:", apiUrl);
      
      const response = await fetch(apiUrl)
      const data = await response.json()
      
      console.log("📥 Fresh API Response received:", {
        status: response.status,
        success: data.success,
        itemCount: data.data ? data.data.length : 0,
        firstItemName: data.data && data.data.length > 0 ? (data.data[0].name || data.data[0].itemName) : 'No items'
      });

      // Extract the actual menu items array from the response
      const menuItemsArray = data.data || [];

      // Debug: Log sample items with their images
      if (menuItemsArray.length > 0) {
        console.log("🖼️ Sample items from API:");
        menuItemsArray.slice(0, 3).forEach((item, index) => {
          console.log(`Item ${index + 1}: "${item.name}" → Image: ${item.image}`);
        });
      }

      // Debug: Log the RAW API response to see exactly what we're getting
      if (menuItemsArray.length > 0) {
        console.log("🔍 RAW API RESPONSE - First item:", JSON.stringify(menuItemsArray[0], null, 2));
        
        // Check what fields exist in the first item
        console.log("🔍 ALL FIELDS in first item:", Object.keys(menuItemsArray[0]));
      }

      if (menuItemsArray.length > 0) {
        const formattedItems = menuItemsArray.map((item) => {
          // Get price - check both price field and prices object
          let itemPrice = item.price;
          if (!itemPrice && item.prices && typeof item.prices === 'object') {
            // Get first price from prices object
            const priceValues = Object.values(item.prices);
            itemPrice = priceValues.length > 0 ? priceValues[0] : 0;
          }
          
          // Ensure price is a clean number
          itemPrice = parseFloat(itemPrice) || 0;
          
          const processedItem = {
            id: item._id,
            name: trimNumbersFromName(item.name || item.itemName),
            price: itemPrice || 0,
            description: item.description || "",
            image: item.image,
            categoryId: typeof item.categoryId === 'object' ? item.categoryId._id : item.categoryId,
            branchId: typeof item.branchId === 'object' ? item.branchId._id : item.branchId,
            stock: item.stock || 0,
            lowStockAlert: item.lowStockAlert || 5,
            isActive: item.isActive !== false,
            // Handle different subscription enabled field names
            subscriptionEnabled: item.subscriptionEnabled || item.hasSubscription || item.subscription || item.isSubscriptionEnabled || false,
            subscriptionPlans: item.subscriptionPlans || item.subscriptionPlan || item.plans || [],
            subscriptionAmount: item.subscriptionAmount || 0,
            subscriptionDiscount: item.subscriptionDiscount || 0,
            subscriptionDuration: item.subscriptionDuration || '3days',
            // New percentage-based subscription fields
            subscription3DaysDiscount: item.subscription3DaysDiscount || 0,
            subscription1WeekDiscount: item.subscription1WeekDiscount || 0,
            subscription1MonthDiscount: item.subscription1MonthDiscount || 0,
            subscription3DaysPrice: item.subscription3DaysPrice || 0,
            subscription1WeekPrice: item.subscription1WeekPrice || 0,
            subscription1MonthPrice: item.subscription1MonthPrice || 0,
            // Keep old fields for backward compatibility
            subscription3Days: item.subscription3Days || 0,
            subscription1Week: item.subscription1Week || 0,
            subscription1Month: item.subscription1Month || 0,
            quantities: item.quantities || [],
            prices: item.prices || {}
          };
          
          // Pre-calculate subscription availability to avoid repeated calls
          processedItem._hasSubscription = hasSubscriptionAvailable(processedItem);
          processedItem._subscriptionLogged = false;
          
          return processedItem;
        })

        // Log subscription summary
        const subscriptionCount = formattedItems.filter(item => item._hasSubscription).length;
        console.log(`📊 API Fetch Subscription Summary: ${subscriptionCount}/${formattedItems.length} items have valid subscriptions`);

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
        `${API_BASE_URL}/subscription-order/user/${userId}`,
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
          `${API_BASE_URL}/cart?userId=${userId}&branchId=${branchId}`,
        )
        const data = await response.json()

        if (data && data.items) {
          setCartItems(
            data.items.map((item) => ({
              id: item.menuItemId,
              name: trimNumbersFromName(item.name),
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
            `${API_BASE_URL}/menu?categoryId=${category.id}&branchId=${branchId}&limit=10000`,
          )
          const data = await response.json()

          // Extract menu items from response (backend returns {success, data, pagination})
          const menuItemsArray = data.data || [];

          if (menuItemsArray.length > 0) {
            const formattedItems = menuItemsArray.map((item) => {
              // Get price - check both price field and prices object
              let itemPrice = item.price;
              if (!itemPrice && item.prices && typeof item.prices === 'object') {
                const priceValues = Object.values(item.prices);
                itemPrice = priceValues.length > 0 ? priceValues[0] : 0;
              }
              
              // Ensure price is a clean number
              itemPrice = parseFloat(itemPrice) || 0;
              const processedItem = {
                id: item._id,
                name: trimNumbersFromName(item.name || item.itemName),
                price: itemPrice || 0,
                description: item.description || "",
                image: item.image,
                categoryId: item.categoryId,
                stock: item.stock || 0,
                lowStockAlert: item.lowStockAlert || 5,
                isActive: item.isActive !== false,
                subscriptionEnabled: item.subscriptionEnabled || false,
                subscriptionPlans: item.subscriptionPlans || [],
                subscriptionAmount: item.subscriptionAmount || 0,
                subscriptionDiscount: item.subscriptionDiscount || 0,
                subscriptionDuration: item.subscriptionDuration || '3days',
                // New percentage-based subscription fields
                subscription3DaysDiscount: item.subscription3DaysDiscount || 0,
                subscription1WeekDiscount: item.subscription1WeekDiscount || 0,
                subscription1MonthDiscount: item.subscription1MonthDiscount || 0,
                subscription3DaysPrice: item.subscription3DaysPrice || 0,
                subscription1WeekPrice: item.subscription1WeekPrice || 0,
                subscription1MonthPrice: item.subscription1MonthPrice || 0,
                // Keep old fields for backward compatibility
                subscription3Days: item.subscription3Days || 0,
                subscription1Week: item.subscription1Week || 0,
                subscription1Month: item.subscription1Month || 0
              };
              
              // Pre-calculate subscription availability
              processedItem._hasSubscription = hasSubscriptionAvailable(processedItem);
              processedItem._subscriptionLogged = false;
              
              return processedItem;
            })
            allItems = [...allItems, ...formattedItems]
          }
        }

        // Remove duplicates by id (in case of overlapping items)
        const uniqueItems = Array.from(new Map(allItems.map((item) => [item.id, item])).values())
        
        // Log subscription summary for all items
        const allSubscriptionCount = uniqueItems.filter(item => item._hasSubscription).length;
        console.log(`📊 All Menu Items Subscription Summary: ${allSubscriptionCount}/${uniqueItems.length} items have valid subscriptions`);
        
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
    // Only fetch from API if no passed menu items
    if (passedMenuItems.length === 0) {
      setLoading(true)
      fetchMenuItems()
    }
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
      } else {
        // Search within menu items (already filtered by category)
        const filtered = menuItems.filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase().trim())
        )
        setFilteredItems(filtered)
        console.log("Filtered items:", filtered.length)
      }
    }, 300),
    [menuItems],
  )

  // Add loading state for search/filter operations
  const [isSearching, setIsSearching] = useState(false)

  // Update filtered items based on search query
  useEffect(() => {
    if (searchQuery.trim() !== "") {
      setIsSearching(true)
      // Simulate search delay for UX
      const timer = setTimeout(() => {
        const filtered = menuItems.filter((item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
        )
        setFilteredItems(filtered)
        setIsSearching(false)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setFilteredItems(menuItems)
      setIsSearching(false)
    }
  }, [searchQuery, menuItems])

  // Ensure itemAnimatedValues matches filteredItems length
  useEffect(() => {
    if (filteredItems.length !== itemAnimatedValues.length) {
      const newAnimatedValues = Array(filteredItems.length)
        .fill()
        .map((_, i) => itemAnimatedValues[i] || new Animated.Value(0))
      setItemAnimatedValues(newAnimatedValues)
    }
  }, [filteredItems.length])

  // Debug: Log when filteredItems changes
  useEffect(() => {
    console.log("📋 filteredItems updated:", {
      count: filteredItems.length,
      searchQuery: searchQuery,
      firstItem: filteredItems[0]?.name || 'none'
    });
  }, [filteredItems, searchQuery]);

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
    console.log(`🛒 handleAddToCart called for "${item.name}"`);
    
    if (!userId) {
      console.error("🛒 User ID not available")
      return
    }
    
    // Debug: Log what's happening in handleAddToCart
    console.log(`🛒 handleAddToCart called for "${item.name}":`, {
      hasActiveSubscription: hasActiveSubscription(item.id),
      hasSubscriptionAvailable: item._hasSubscription,
      subscriptionEnabled: item.subscriptionEnabled,
      subscription3DaysDiscount: item.subscription3DaysDiscount,
      subscription1WeekDiscount: item.subscription1WeekDiscount,
      subscription1MonthDiscount: item.subscription1MonthDiscount,
    });
    
    // Check if user already has an active subscription
    if (hasActiveSubscription(item.id)) {
      console.log("🛒 User has active subscription, adding directly to cart");
      await addItemToCart(item, index)
      return
    }
    
    // Check if item has subscription enabled and show modal for choice
    const hasSubscription = item._hasSubscription;
    
    console.log(`🛒 Subscription check result for "${item.name}": ${hasSubscription}`);
    
    if (hasSubscription) {
      console.log("🛒 Showing subscription modal");
      console.log("🛒 Setting selectedItemForSubscription:", { item: item.name, index });
      setSelectedItemForSubscription({ item, index })
      setShowSubscriptionModal(true)
      console.log("🛒 Modal state should now be true");
      return
    }

    // Proceed with normal add to cart
    console.log("🛒 No subscription, adding directly to cart");
    await addItemToCart(item, index)
  }

  const addItemToCart = async (item, index) => {
    // Check current quantity before adding
    const currentQuantity = getItemQuantity(item.id);
    if (currentQuantity >= 10) {
      Alert.alert(
        "Maximum Quantity Reached",
        "You can only add up to 10 items of the same product.",
        [{ text: "OK" }]
      );
      return;
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
        savings: priceInfo.savings,
        categoryId: selectedCategoryId, // Add category information
        categoryName: categories?.find(cat => cat.id === selectedCategoryId)?.name || 'Unknown'
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
      
      const response = await fetch(`${API_BASE_URL}/cart/add`, {
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
          `${API_BASE_URL}/cart/remove?userId=${userId}&branchId=${branchId}&menuItemId=${item.id}`,
          {
            method: "DELETE",
          },
        )
      } else {
        await fetch(`${API_BASE_URL}/cart/update`, {
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
              style={[
                styles.quantityButton, 
                styles.plusButton,
                quantity >= 10 && styles.disabledButton
              ]} 
              onPress={() => quantity < 10 ? handleAddToCart(item, index) : null}
              disabled={quantity >= 10}
            >
              <Icon name="add" size={18} color={quantity >= 10 ? "#ccc" : "#fff"} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={[
              styles.addButton,
              item._hasSubscription && !hasActiveSubscription(item.id) && styles.subscriptionAddButton,
              hasActiveSubscription(item.id) && styles.subscribedAddButton
            ]} 
            onPress={() => handleAddToCart(item, index)}
          >
            <Icon name="add-shopping-cart" size={18} color="#fff" />
            <Text style={styles.addButtonText}>
              {hasActiveSubscription(item.id) 
                ? "ADD" 
                : item._hasSubscription 
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
    // Use pre-calculated subscription data instead of calling function repeatedly
    const hasSubscription = item._hasSubscription;
    const hasActiveSubscriptionForItem = hasActiveSubscription(item.id);

    // Get animation value with fallback to 1 (no animation) if index is out of bounds
    const animatedValue = itemAnimatedValues[index] || new Animated.Value(1);

    return (
      <Animated.View style={[
        styles.foodCard,
        { transform: [{ scale: animatedValue }] },
        colorScheme === 'dark' ? styles.foodCardDark : styles.foodCardLight
      ]}>
        <View style={styles.foodItemContent}>
          <View style={styles.foodImageContainer}>
            <EnhancedImage
              item={item}
              style={styles.foodImage}
              onError={(error) => {
                setImageErrors(prev => ({ ...prev, [item.id]: true }));
              }}
              onLoad={() => {
                setImageErrors(prev => ({ ...prev, [item.id]: false }));
              }}
            />
            {/* Subscription Badge - only show for items with subscription available but not subscribed */}
            {hasSubscription && !hasActiveSubscriptionForItem && (
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
              {hasSubscription && !hasActiveSubscriptionForItem && (
                <Icon name="autorenew" size={16} color="#800000" style={styles.subscriptionIcon} />
              )}
              {/* Small green dot for subscribed items */}
              {hasActiveSubscriptionForItem && (
                <View style={styles.subscribedDot} />
              )}
            </View>
            <Text style={[styles.foodDescription, colorScheme === 'dark' ? styles.descriptionDark : styles.descriptionLight]} numberOfLines={3}>
              {item.description}
            </Text>
            <View style={styles.priceAndCartContainer}>
              <View style={styles.priceSection}>
                <Text style={[styles.foodPrice, colorScheme === 'dark' ? styles.textDark : styles.textLight]} numberOfLines={1} ellipsizeMode="tail">
                  ₹{parseFloat(item.price || 0).toFixed(2)}
                </Text>
                {hasSubscription && (
                  <Text style={styles.subscriptionDiscountText} numberOfLines={1}>
                    Subscribe for Special Price
                  </Text>
                )}
              </View>
              {renderCartControl(item, index)}
            </View>
          </View>
        </View>
      </Animated.View>
    )
  }



  // Toggle search function
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

      {/* Category tabs with images */}
      {categories && categories.length > 1 && (
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
                  {category.image && (
                    <Image
                      source={{ uri: category.image }}
                      style={styles.categoryImage}
                      onError={(e) => {
                        console.log("❌ Category image failed to load:", category.name, category.image);
                      }}
                    />
                  )}
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
        keyExtractor={(item) => item.id? item.id.toString() : Math.random().toString()}
        renderItem={renderFoodItem}
        contentContainerStyle={styles.menuContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          isSearching ? (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="small" color="#FFD700" />
              <Text style={[styles.searchLoadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Searching...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          searchQuery.trim() !== "" && !isSearching ? (
            <View style={styles.emptyState}>
              <Icon name="search-off" size={60} color="#800000" />
              <Text style={[styles.emptyStateText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No items found for "{searchQuery}"</Text>
            </View>
          ) : menuItems.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Icon name="restaurant-menu" size={60} color="#800000" />
              <Text style={[styles.emptyStateText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No menu items available</Text>
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
                    What would you like to do?
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
                            Pay ₹{(selectedItemForSubscription?.item?.price || 0).toFixed(2)} - No subscription
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Buy + Subscribe Option */}
                    <TouchableOpacity
                      style={[styles.optionButton, styles.buyAndSubscribeButton]}
                      onPress={async () => {
                        setShowSubscriptionModal(false)
                        if (selectedItemForSubscription?.item) {
                          console.log("🔄 Buy + Subscribe: Going to subscription screen with auto-order flag");
                          
                          // Transform the product data to include both old and new subscription fields
                          const transformedProduct = {
                            ...selectedItemForSubscription.item,
                            // Ensure branchId is properly set
                            branchId: selectedItemForSubscription.item.branchId || branchId || '507f1f77bcf86cd799439011',
                            // Pass through test item flag
                            isTestItem: selectedItemForSubscription.item.isTestItem || false,
                            // Map new percentage fields to old fixed price fields for backward compatibility
                            subscription3Days: selectedItemForSubscription.item.subscription3DaysPrice || 0,
                            subscription1Week: selectedItemForSubscription.item.subscription1WeekPrice || 0,
                            subscription1Month: selectedItemForSubscription.item.subscription1MonthPrice || 0,
                            // Keep the new fields as well
                            subscription3DaysDiscount: selectedItemForSubscription.item.subscription3DaysDiscount || 0,
                            subscription1WeekDiscount: selectedItemForSubscription.item.subscription1WeekDiscount || 0,
                            subscription1MonthDiscount: selectedItemForSubscription.item.subscription1MonthDiscount || 0,
                            subscription3DaysPrice: selectedItemForSubscription.item.subscription3DaysPrice || 0,
                            subscription1WeekPrice: selectedItemForSubscription.item.subscription1WeekPrice || 0,
                            subscription1MonthPrice: selectedItemForSubscription.item.subscription1MonthPrice || 0,
                          };
                          
                          console.log("🔄 Transformed product for SubscriptionOrder:", {
                            name: transformedProduct.name,
                            branchId: transformedProduct.branchId,
                            isTestItem: transformedProduct.isTestItem,
                          });
                          
                          navigation.navigate('SubscriptionOrder', { 
                            product: transformedProduct,
                            shouldAutoOrderItem: true, // Flag to indicate item should be auto-ordered after subscription
                            itemIndex: selectedItemForSubscription.index
                          })
                        }
                        setSelectedItemForSubscription(null)
                      }}
                    >
                      <View style={styles.optionContent}>
                        <Icon name="add-shopping-cart" size={24} color="#800000" />
                        <View style={styles.optionText}>
                          <Text style={styles.buyAndSubscribeOptionTitle}>Buy + Subscribe</Text>
                          <Text style={styles.buyAndSubscribeOptionSubtitle}>
                            Order this item (₹{(selectedItemForSubscription?.item?.price || 0).toFixed(2)}) + Subscribe for future discounts
                          </Text>
                          <Text style={styles.buyAndSubscribeOptionBenefit}>
                            💡 Get this item delivered + save on future orders!
                          </Text>
                        </View>
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsText}>
                            SAVE UP TO {Math.max(
                              selectedItemForSubscription?.item?.subscription3DaysDiscount || 0,
                              selectedItemForSubscription?.item?.subscription1WeekDiscount || 0,
                              selectedItemForSubscription?.item?.subscription1MonthDiscount || 0
                            )}%
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Subscribe Only Option */}
                    <TouchableOpacity
                      style={[styles.optionButton, styles.subscribeOnlyButton]}
                      onPress={() => {
                        setShowSubscriptionModal(false)
                        if (selectedItemForSubscription?.item) {
                          console.log("🔄 Original item before transformation:", selectedItemForSubscription.item);
                          
                          // Transform the product data to include both old and new subscription fields
                          const transformedProduct = {
                            ...selectedItemForSubscription.item,
                            // Ensure branchId is properly set
                            branchId: selectedItemForSubscription.item.branchId || branchId || '507f1f77bcf86cd799439011',
                            // Pass through test item flag
                            isTestItem: selectedItemForSubscription.item.isTestItem || false,
                            // Map new percentage fields to old fixed price fields for backward compatibility
                            subscription3Days: selectedItemForSubscription.item.subscription3DaysPrice || 0,
                            subscription1Week: selectedItemForSubscription.item.subscription1WeekPrice || 0,
                            subscription1Month: selectedItemForSubscription.item.subscription1MonthPrice || 0,
                            // Keep the new fields as well
                            subscription3DaysDiscount: selectedItemForSubscription.item.subscription3DaysDiscount || 0,
                            subscription1WeekDiscount: selectedItemForSubscription.item.subscription1WeekDiscount || 0,
                            subscription1MonthDiscount: selectedItemForSubscription.item.subscription1MonthDiscount || 0,
                            subscription3DaysPrice: selectedItemForSubscription.item.subscription3DaysPrice || 0,
                            subscription1WeekPrice: selectedItemForSubscription.item.subscription1WeekPrice || 0,
                            subscription1MonthPrice: selectedItemForSubscription.item.subscription1MonthPrice || 0,
                          };
                          
                          console.log("🔄 Transformed product for SubscriptionOrder:", {
                            name: transformedProduct.name,
                            branchId: transformedProduct.branchId,
                            isTestItem: transformedProduct.isTestItem,
                            subscription3Days: transformedProduct.subscription3Days,
                            subscription1Week: transformedProduct.subscription1Week,
                            subscription1Month: transformedProduct.subscription1Month,
                            subscription3DaysPrice: transformedProduct.subscription3DaysPrice,
                            subscription1WeekPrice: transformedProduct.subscription1WeekPrice,
                            subscription1MonthPrice: transformedProduct.subscription1MonthPrice,
                          });
                          
                          navigation.navigate('SubscriptionOrder', { product: transformedProduct })
                        }
                        setSelectedItemForSubscription(null)
                      }}
                    >
                      <View style={styles.optionContent}>
                        <Icon name="autorenew" size={24} color="#FFD700" />
                        <View style={styles.optionText}>
                          <Text style={styles.subscribeOnlyOptionTitle}>Subscribe Only</Text>
                          <Text style={styles.subscribeOnlyOptionSubtitle}>
                            Just subscribe for future discounts (no item added to cart)
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.modalNote, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                    💡 You can buy the item now, subscribe for future discounts, or do both!
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
  categoryImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
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
    minHeight: 120,
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
    width: 85,
    height: 85,
    marginRight: 12,
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
    minHeight: 100,
    minWidth: 0,
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
    alignItems: "center", // Changed from "flex-end" to "center" for better vertical alignment
    marginTop: 8,
    width: "100%", // Ensure it takes full width
  },
  priceSection: {
    flex: 1,
    marginRight: 8, // Reduced from 12 to give more space to cart controls
    minWidth: 80, // Reduced from 100 to give more space to cart controls
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  foodPrice: {
    fontSize: 16, // Reduced from 18 to 16
    fontWeight: "800",
    color: "#800000",
    textAlign: 'left',
    includeFontPadding: false,
    textAlignVertical: 'center',
    flexShrink: 0, // Prevent text from shrinking
    minWidth: 80, // Ensure minimum width for price display
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
    flexWrap: 'nowrap',
    textAlign: 'left',
  },
  subscriberSavingsText: {
    fontSize: 11,
    color: "#28a745",
    fontWeight: "600",
    marginTop: 2,
  },
  // Cart Control Styles
  cartControlContainer: {
    alignItems: "center", // Changed from "flex-end" to "center"
    justifyContent: "center",
    minHeight: 40,
    minWidth: 100,
    flexShrink: 0, // Prevent shrinking
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
    width: "auto", // Auto width based on content
    alignSelf: "flex-end", // Align to the right
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
  disabledButton: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  quantityDisplay: {
    minWidth: 30,
    paddingHorizontal: 8,
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
    paddingVertical: 8, // Reduced from 12 to 8
    paddingHorizontal: 12, // Reduced from 12 to 8
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4, // Reduced from 8 to 4
    shadowColor: "#800000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
    width: "auto", // Auto width based on content
    alignSelf: "flex-end", // Align to the right
  },
  addButtonText: {
    color: "#FFD700",
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
    textAlign: "center",
    marginTop: 10,
  },
  searchLoadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#888",
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
  buyAndSubscribeButton: {
    backgroundColor: '#28a745', // Green for buy + subscribe
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  subscribeOnlyButton: {
    backgroundColor: '#FFD700', // Gold for subscribe only
    borderWidth: 2,
    borderColor: '#800000',
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
  buyAndSubscribeOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  buyAndSubscribeOptionSubtitle: {
    fontSize: 14,
    color: '#FFD700',
    marginBottom: 2,
  },
  buyAndSubscribeOptionBenefit: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  subscribeOnlyOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#800000',
    marginBottom: 4,
  },
  subscribeOnlyOptionSubtitle: {
    fontSize: 14,
    color: '#800000',
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
  subscriptionPlans: {
    marginTop: 8,
    marginBottom: 8,
  },
  planOption: {
    fontSize: 11,
    color: '#28a745',
    marginBottom: 4,
    lineHeight: 16,
  },
})

export default Product
