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
  const { initialCategory = 0, categoryId, categories, branchId, product } = route.params

  const { addToCart, removeFromCart, getBranchCartCount, getBranchCartItems, calculateBranchTotal, selectedBranch } =
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

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme)
    })
    return () => subscription.remove()
  }, [])

  // Define fetchMenuItems function
  const fetchMenuItems = useCallback(async () => {
    if (!branchId || !selectedCategoryId) return

    setLoading(true)
    try {
      const response = await fetch(
        `http://192.168.1.24:9000/api/v1/hotel/menu?categoryId=${selectedCategoryId}&branchId=${branchId}`,
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
          return {
            id: item._id,
            name: item.name || item.itemName,
            price: itemPrice || 0,
            description: item.description || "",
            image: item.image ? (item.image.startsWith('http') ? item.image : `http://192.168.1.24:9000${item.image.startsWith('/') ? '' : '/'}${item.image}`) : null,
            categoryId: typeof item.categoryId === 'object' ? item.categoryId._id : item.categoryId,
            branchId: typeof item.branchId === 'object' ? item.branchId._id : item.branchId,
            stock: item.stock || 0,
            lowStockAlert: item.lowStockAlert || 5,
            isActive: item.isActive !== false,
            subscriptionEnabled: item.subscriptionEnabled || false,
            subscriptionPlans: item.subscriptionPlans || [],
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
    }, [fetchMenuItems])
  )

  // Fetch user ID from AsyncStorage
  useEffect(() => {
    const getUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId")
        if (storedUserId) {
          setUserId(storedUserId)
        }
      } catch (error) {
        console.error("Error getting user ID:", error)  
      }
    }
    getUserId()
  }, [])

  // Fetch cart items with prices
  useEffect(() => {
    const fetchCartWithPrices = async () => {
      if (!userId || !branchId) return

      try {
        const response = await fetch(
          `http://192.168.1.24:9000/api/v1/hotel/cart?userId=${userId}&branchId=${branchId}`,
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

  // Fetch all menu items by iterating through all categories
  useEffect(() => {
    const fetchAllMenuItems = async () => {
      if (!branchId || !categories || categories.length === 0) return

      setLoading(true)
      try {
        let allItems = []
        for (const category of categories) {
          const response = await fetch(
            `http://192.168.1.24:9000/api/v1/hotel/menu?categoryId=${category.id}&branchId=${branchId}`,
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
                image: item.image ? (item.image.startsWith('http') ? item.image : `http://192.168.1.24:9000${item.image.startsWith('/') ? '' : '/'}${item.image}`) : null,
                categoryId: item.categoryId,
                stock: item.stock || 0,
                lowStockAlert: item.lowStockAlert || 5,
                isActive: item.isActive !== false
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
  }, [branchId, categories])

  // Fetch menu items for the selected category
  useEffect(() => {
    fetchMenuItems()
  }, [fetchMenuItems])

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
        const filtered = allMenuItems.filter((item) => item.name.toLowerCase().includes(query.toLowerCase().trim()))
        setFilteredItems(filtered)
        console.log("Filtered items:", filtered)
        const newItemAnimatedValues = Array(filtered.length)
          .fill()
          .map(() => new Animated.Value(1))
        setItemAnimatedValues(newItemAnimatedValues)
      }
    }, 300),
    [menuItems, allMenuItems],
  )

  // Update filtered items based on search query
  useEffect(() => {
    debouncedSearch(searchQuery)
  }, [searchQuery, debouncedSearch])

  // Update cart visibility
  useEffect(() => {
    const cartCount = getBranchCartCount(selectedBranch)
    setShowViewCart(cartCount > 0)
  }, [selectedBranch, getBranchCartCount])

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

    // Check stock availability
    if (item.stock <= 0) {
      alert("This item is currently out of stock")
      return
    }

    // Check if adding this item would exceed available stock
    const existingCartItem = cartItems.find((i) => i.id === item.id)
    const currentCartQuantity = existingCartItem ? existingCartItem.quantity : 0
    const availableStock = item.stock - currentCartQuantity
    
    if (availableStock <= 0) {
      alert(`No more items available in stock`)
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
      // Update local cart state using branch index for CartContext
      addToCart(selectedBranch, item, 1)

      // Immediately update local cartItems state
      setCartItems((prevItems) => {
        const existingItem = prevItems.find((i) => i.id === item.id)
        if (existingItem) {
          return prevItems.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
        } else {
          return [...prevItems, { ...item, quantity: 1 }]
        }
      })

      // Sync with server using actual branchId (MongoDB ObjectId)
      console.log('Adding to cart:', { userId, branchId, menuItemId: item.id, itemName: item.name })
      
      const response = await fetch("http://192.168.1.24:9000/api/v1/hotel/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          branchId: branchId,
          menuItemId: item.id,
          quantity: 1,
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
          `http://192.168.1.24:9000/api/v1/hotel/cart/remove?userId=${userId}&branchId=${branchId}&menuItemId=${item.id}`,
          {
            method: "DELETE",
          },
        )
      } else {
        await fetch("http://192.168.1.24:9000/api/v1/hotel/cart/update", {
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
    const isOutOfStock = item.stock <= 0
    const availableStock = item.stock - quantity

    const handleAddWithAlert = () => {
      if (availableStock <= 0) {
        alert(`❌ No more items available!\n\nOnly ${item.stock} items in stock and you already have ${quantity} in your cart.`)
        return
      }
      if (availableStock === 1 && quantity > 0) {
        alert(`⚠️ Last item available!\n\nThis is the last ${item.name} in stock. Adding this will make it out of stock.`)
      }
      handleAddToCart(item, index)
    }

    return (
      <View style={[styles.cartControl, colorScheme === 'dark' ? styles.cartControlDark : styles.cartControlLight]}>
        {isOutOfStock ? (
          <View style={[styles.outOfStockContainer, colorScheme === 'dark' ? styles.outOfStockContainerDark : styles.outOfStockContainerLight]}>
            <Icon name="block" size={16} color="#ff4444" />
            <Text style={[styles.outOfStockText, colorScheme === 'dark' ? styles.outOfStockTextDark : styles.outOfStockTextLight]}>
              OUT OF STOCK
            </Text>
          </View>
        ) : quantity > 0 ? (
          <View style={styles.quantityContainer}>
            <View style={styles.quantityControls}>
              <TouchableOpacity 
                style={[styles.quantityButton, styles.minusButton]} 
                onPress={() => handleRemoveFromCart(item, index)}
              >
                <Icon name="remove" size={16} color="#fff" />
              </TouchableOpacity>
              
              <View style={[styles.quantityDisplay, colorScheme === 'dark' ? styles.quantityDisplayDark : styles.quantityDisplayLight]}>
                <Text style={[styles.quantityText, colorScheme === 'dark' ? styles.quantityTextDark : styles.quantityTextLight]}>
                  {quantity}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={[
                  styles.quantityButton, 
                  styles.plusButton,
                  availableStock <= 0 && styles.quantityButtonDisabled
                ]} 
                onPress={handleAddWithAlert}
                disabled={availableStock <= 0}
              >
                <Icon name="add" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.stockInfoContainer}>
              <Icon name="inventory" size={12} color={availableStock <= 2 ? "#ff6b35" : "#4CAF50"} />
              <Text style={[
                styles.stockCountText,
                { color: availableStock <= 2 ? "#ff6b35" : "#4CAF50" }
              ]}>
                {availableStock <= 0 ? "No more left" : `${availableStock} left`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.addButtonContainer}>
            <TouchableOpacity 
              style={[styles.addButton, colorScheme === 'dark' ? styles.addButtonDark : styles.addButtonLight]} 
              onPress={() => handleAddToCart(item, index)}
            >
              <Icon name="add-shopping-cart" size={16} color="#fff" />
              <Text style={styles.addButtonText}>
                ADD
              </Text>
            </TouchableOpacity>
            
            <View style={styles.stockInfoContainer}>
              <Icon name="inventory" size={12} color={item.stock <= 2 ? "#ff6b35" : "#4CAF50"} />
              <Text style={[
                styles.stockCountText,
                { color: item.stock <= 2 ? "#ff6b35" : "#4CAF50" }
              ]}>
                {item.stock} left
              </Text>
            </View>
            
            {item.subscriptionEnabled && item.subscriptionPlans && item.subscriptionPlans.length > 0 && (
              <TouchableOpacity 
                style={[styles.subscribeButton, colorScheme === 'dark' ? styles.subscribeButtonDark : styles.subscribeButtonLight]} 
                onPress={() => navigation.navigate('SubscriptionOrder', { product: item })}
              >
                <Icon name="subscription" size={14} color="#fff" />
                <Text style={styles.subscribeButtonText}>
                  SUBSCRIBE
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    )
  }

  const renderFoodItem = ({ item, index }) => {
    return (
      <Animated.View style={[styles.foodCard, { transform: [{ scale: itemAnimatedValues[index] || 1 }] }, colorScheme === 'dark' ? styles.foodCardDark : styles.foodCardLight]}>
        <View style={styles.foodItemContent}>
          <View style={styles.foodDetails}>
            <Text style={[styles.foodName, colorScheme === 'dark' ? styles.textDark : styles.textLight]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.foodPrice, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{(item.price || 0).toFixed(2)}</Text>
            <Text style={[styles.foodDescription, colorScheme === 'dark' ? styles.descriptionDark : styles.descriptionLight]} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          <View style={styles.foodImageContainer}>
            <Image
              source={item.image ? { uri: item.image } : require("../assets/lemon.jpg")}
              style={styles.foodImage}
            />
            <View style={styles.addButtonContainer}>{renderCartControl(item, index)}</View>
          </View>
        </View>
        <View style={[styles.divider, colorScheme === 'dark' ? styles.dividerDark : styles.dividerLight]} />
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
    padding: 0,
    paddingBottom: 80,
  },
  foodCard: {
    marginBottom: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  foodCardLight: {
    backgroundColor: "#fff",
  },
  foodCardDark: {
    backgroundColor: "#2a2a2a",
  },
  foodItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  foodDetails: {
    flex: 1,
    marginRight: 16,
    justifyContent: "space-between",
  },
  foodName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  foodPrice: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  foodDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  foodImageContainer: {
    width: 118,
    alignItems: "center",
  },
  foodImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    resizeMode: "cover",
  },
  addButtonContainer: {
    position: "absolute",
    bottom: -10,
    width: "100%",
    alignItems: "center",
  },
  divider: {
    height: 1,
    marginTop: 16,
  },
  dividerLight: {
    backgroundColor: "#e5e7eb",
  },
  dividerDark: {
    backgroundColor: "#444",
  },
  cartControl: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#800000",
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  cartControlLight: {
    backgroundColor: "#fff",
  },
  cartControlDark: {
    backgroundColor: "#2a2a2a",
  },
  quantityText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "bold",
    minWidth: 24,
    textAlign: "center",
  },
  addButtonText: {
    color: "#FFD700",
    fontWeight: "700",
    fontSize: 12,
  },
  subscribeButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  subscribeButtonLight: {
    backgroundColor: "#FFD700",
  },
  subscribeButtonDark: {
    backgroundColor: "#FFA500",
  },
  subscribeButtonText: {
    color: "#800000",
    fontWeight: "600",
    fontSize: 10,
  },
  addButtonContainer: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  addButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonLight: {
    backgroundColor: "#FFD700",
  },
  addButtonDark: {
    backgroundColor: "#FFA500",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  quantityContainer: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 20,
    padding: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  minusButton: {
    backgroundColor: "#ff4444",
  },
  plusButton: {
    backgroundColor: "#4CAF50",
  },
  quantityDisplay: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityDisplayLight: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  quantityDisplayDark: {
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444",
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  quantityTextLight: {
    color: "#333",
  },
  quantityTextDark: {
    color: "#fff",
  },
  stockInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockCountText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  outOfStockContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffebee",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffcdd2",
  },
  outOfStockContainerLight: {
    backgroundColor: "#ffebee",
    borderColor: "#ffcdd2",
  },
  outOfStockContainerDark: {
    backgroundColor: "#3a1f1f",
    borderColor: "#5d2a2a",
  },
  outOfStockButton: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  outOfStockButtonLight: {
    backgroundColor: "#f5f5f5",
    borderColor: "#e0e0e0",
  },
  outOfStockButtonDark: {
    backgroundColor: "#3a3a3a",
    borderColor: "#555",
  },
  outOfStockText: {
    color: "#999",
    fontWeight: "700",
    fontSize: 10,
  },
  outOfStockTextLight: {
    color: "#999",
  },
  outOfStockTextDark: {
    color: "#666",
  },
  lowStockButton: {
    backgroundColor: "#fff3cd",
    borderWidth: 1,
    borderColor: "#ffeaa7",
  },
  lowStockText: {
    color: "#856404",
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityButtonTextDisabled: {
    color: "#ccc",
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
})

export default Product