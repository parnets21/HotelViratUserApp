import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, StatusBar, ActivityIndicator, Alert, Appearance } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/MaterialIcons"
import { useNavigation } from "@react-navigation/native"
import { useCart } from "../context/CartContext"
import { useState, useEffect } from "react"
import AsyncStorage from '@react-native-async-storage/async-storage'

const MyCart = () => {
  const navigation = useNavigation()
  const { 
    addToCart, 
    removeFromCart, 
    getBranchCartItems, 
    calculateBranchTotal, 
    selectedBranch,
    clearBranchCart
  } = useCart()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [userId, setUserId] = useState(null)
  const [branchId, setBranchId] = useState(null)
  const [branchDetails, setBranchDetails] = useState(null)
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme())

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme)
    })
    return () => subscription.remove()
  }, [])

  // Fetch user ID from AsyncStorage
  useEffect(() => {
    const getUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId')
        if (storedUserId) {
          setUserId(storedUserId)
        }
      } catch (error) {
        console.error('Error fetching user ID:', error)
      }
    }
    
    getUserId()
  }, [])

  // Fetch cart data from server
  useEffect(() => {
    const fetchCartData = async () => {
      if (!userId) return
      
      setLoading(true)
      setError(null)
      
      try {
        // Add timeout to prevent infinite loading
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          controller.abort()
        }, 10000) // 10 second timeout
        
        // Get branch ID for the selected branch index
        const branchesResponse = await fetch('https://hotelvirat.com/api/v1/hotel/branch', {
          signal: controller.signal
        })
        
        if (!branchesResponse.ok) {
          throw new Error(`Branch API failed: ${branchesResponse.status}`)
        }
        
        const branchesData = await branchesResponse.json()
        clearTimeout(timeoutId)
        
        if (!Array.isArray(branchesData) || branchesData.length === 0) {
          setError('No branches available')
          setLoading(false)
          return
        }
        
        const currentBranchId = branchesData[selectedBranch]?._id
        if (!currentBranchId) {
          setError('Selected branch not found')
          setLoading(false)
          return
        }
        
        setBranchId(currentBranchId)
        setBranchDetails({
          name: branchesData[selectedBranch].name,
          address: branchesData[selectedBranch].address
        })
        
        // Fetch cart data with timeout
        const cartController = new AbortController()
        const cartTimeoutId = setTimeout(() => {
          cartController.abort()
        }, 8000) // 8 second timeout
        
        const cartResponse = await fetch(`https://hotelvirat.com/api/v1/hotel/cart?userId=${userId}&branchId=${currentBranchId}`, {
          signal: cartController.signal
        })
        
        if (!cartResponse.ok) {
          throw new Error(`Cart API failed: ${cartResponse.status}`)
        }
        
        const cartData = await cartResponse.json()
        clearTimeout(cartTimeoutId)
        
        console.log('Cart API Response:', JSON.stringify(cartData, null, 2))
        
        if (cartData && cartData.items && cartData.items.length > 0) {
          // Update local cart state with server data
          const formattedItems = cartData.items.map(item => {
            // Construct image URL - use production server where images are hosted
            let imageUrl = null;
            if (item.image) {
              if (item.image.startsWith('http')) {
                imageUrl = item.image;
              } else {
                // Use production server where images are actually hosted
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
              id: item.menuItemId,
              name: item.name,
              price: item.price || 0,
              quantity: item.quantity,
              image: imageUrl
            };
          })
          console.log('Formatted cart items with prices:', formattedItems.map(item => ({ name: item.name, price: item.price })))
          setCartItems(formattedItems)
        } else {
          console.log('No cart items found or empty cart')
          setCartItems([])
        }
      } catch (error) {
        console.error('Error fetching cart data:', error)
        if (error.name === 'AbortError') {
          setError('Request timed out. Please check your connection.')
        } else {
          setError(`Failed to load cart: ${error.message}`)
        }
        setCartItems([]) // Set empty cart to prevent infinite loading
      } finally {
        setLoading(false)
      }
    }
    
    fetchCartData()
  }, [userId, selectedBranch]) 

const handleIncreaseQuantity = async (item) => {
    if (!userId || !branchId) return
    
    try {
      // Update local cart state
      addToCart(selectedBranch, item, 1)
      
      // Update server cart
      await fetch('https://hotelvirat.com/api/v1/hotel/cart/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          branchId: branchId,
          menuItemId: item.id,
          quantity: item.quantity + 1
        }),
      })
      
      // Update local cart items
      setCartItems(prevItems => 
        prevItems.map(cartItem => 
          cartItem.id === item.id 
            ? { ...cartItem, quantity: cartItem.quantity + 1 } 
            : cartItem
        )
      )
    } catch (error) {
      console.error('Error increasing item quantity:', error)
    }
  }

  const handleDecreaseQuantity = async (item) => {
    if (!userId || !branchId) return
    
    try {
      // Update local cart state
      removeFromCart(selectedBranch, item.id, 1)
      
      if (item.quantity <= 1) {
        // Remove item completely
        await fetch(`https://hotelvirat.com/api/v1/hotel/cart/remove?userId=${userId}&branchId=${branchId}&menuItemId=${item.id}`, {
          method: 'DELETE',
        })
        
        // Update local cart items
        setCartItems(prevItems => prevItems.filter(cartItem => cartItem.id !== item.id))
      } else {
        // Update quantity
        await fetch('https://hotelvirat.com/api/v1/hotel/cart/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
            branchId: branchId,
            menuItemId: item.id,
            quantity: item.quantity - 1
          }),
        })
        
        // Update local cart items
        setCartItems(prevItems => 
          prevItems.map(cartItem => 
            cartItem.id === item.id 
              ? { ...cartItem, quantity: cartItem.quantity - 1 } 
              : cartItem
          )
        )
      }
    } catch (error) {
      console.error('Error decreasing item quantity:', error)
    }
  }

  const handleRemoveItem = async (itemId) => {
    if (!userId || !branchId) return
    
    try {
      // Find the item
      const item = cartItems.find((item) => item.id === itemId)
      if (!item) return
      
      // Remove from local cart state
      removeFromCart(selectedBranch, itemId, item.quantity)
      
      // Remove from server
      await fetch(`https://hotelvirat.com/api/v1/hotel/cart/remove?userId=${userId}&branchId=${branchId}&menuItemId=${itemId}`, {
        method: 'DELETE',
      })
      
      // Update local cart items
      setCartItems(prevItems => prevItems.filter(item => item.id !== itemId))
    } catch (error) {
      console.error('Error removing item:', error)
    }
  }

  const handleClearCart = async () => {
    if (!userId || !branchId) return
    
    Alert.alert(
      "Clear Cart",
      "Are you sure you want to clear your cart?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear",
          onPress: async () => {
            try {
              // Clear local cart state
              clearBranchCart(selectedBranch)
              
              // Clear server cart
              await fetch(`https://hotelvirat.com/api/v1/hotel/cart/clear?userId=${userId}&branchId=${branchId}`, {
                method: 'DELETE',
              })
              
              // Update local cart items
              setCartItems([])
            } catch (error) {
              console.error('Error clearing cart:', error)
            }
          },
          style: "destructive"
        }
      ]
    )
  }

  const renderItem = ({ item }) => {
    return (
      <View style={[styles.cartItem, colorScheme === 'dark' ? styles.cartItemDark : styles.cartItemLight]}>
        <Image 
          source={item.image ? { uri: item.image } : require("../assets/lemon.jpg")} 
          style={styles.itemImage} 
        />
        <View style={styles.itemDetails}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{item.name}</Text>
            <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveItem(item.id)}>
              <Icon name="close" size={18} color="#800000" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.itemPrice, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{item.price.toFixed(2)}</Text>
          
          <View style={styles.quantityControl}>
            <TouchableOpacity style={[styles.quantityButton, colorScheme === 'dark' ? styles.quantityButtonDark : styles.quantityButtonLight]} onPress={() => handleDecreaseQuantity(item)}>
              <Text style={styles.quantityButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={[styles.quantityText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{item.quantity}</Text>
            <TouchableOpacity 
              style={[styles.quantityButton, colorScheme === 'dark' ? styles.quantityButtonDark : styles.quantityButtonLight]} 
              onPress={() => handleIncreaseQuantity(item)}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={[styles.loadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Loading cart...</Text>
        <Text style={[styles.loadingSubtext, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
          This should only take a few seconds
        </Text>
      </View>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <StatusBar backgroundColor={colorScheme === 'dark' ? '#1a1a1a' : '#fff'} barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        {/* Header */}
        <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
            <Icon name="arrow-back" size={24} color="#800000" />
          </TouchableOpacity>
          <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>My Cart</Text>
          <View style={styles.headerIcon} />
        </View>

        {/* Error Message */}
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color="#ff4444" />
          <Text style={[styles.errorTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            Failed to Load Cart
          </Text>
          <Text style={[styles.errorMessage, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            {error}
          </Text>
          
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null)
              setLoading(true)
              // Trigger a re-fetch
              const fetchCartData = async () => {
                if (!userId) return
                
                setLoading(true)
                setError(null)
                
                try {
                  const branchesResponse = await fetch('https://hotelvirat.com/api/v1/hotel/branch')
                  const branchesData = await branchesResponse.json()
                  
                  if (!Array.isArray(branchesData) || branchesData.length === 0) {
                    setError('No branches available')
                    setLoading(false)
                    return
                  }
                  
                  const currentBranchId = branchesData[selectedBranch]?._id
                  if (!currentBranchId) {
                    setError('Selected branch not found')
                    setLoading(false)
                    return
                  }
                  
                  setBranchId(currentBranchId)
                  setBranchDetails({
                    name: branchesData[selectedBranch].name,
                    address: branchesData[selectedBranch].address
                  })
                  
                  const cartResponse = await fetch(`https://hotelvirat.com/api/v1/hotel/cart?userId=${userId}&branchId=${currentBranchId}`)
                  const cartData = await cartResponse.json()
                  
                  if (cartData && cartData.items) {
                    const formattedItems = cartData.items.map(item => {
                      // Construct image URL - use production server where images are hosted
                      let imageUrl = null;
                      if (item.image) {
                        if (item.image.startsWith('http')) {
                          imageUrl = item.image;
                        } else {
                          // Use production server where images are actually hosted
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
                        id: item.menuItemId,
                        name: item.name,
                        price: item.price || 0,
                        quantity: item.quantity,
                        image: imageUrl
                      };
                    })
                    setCartItems(formattedItems)
                  } else {
                    setCartItems([])
                  }
                } catch (error) {
                  console.error('Error fetching cart data:', error)
                  setError(`Failed to load cart: ${error.message}`)
                  setCartItems([])
                } finally {
                  setLoading(false)
                }
              }
              
              fetchCartData()
            }}
          >
            <Icon name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar backgroundColor={colorScheme === 'dark' ? '#1a1a1a' : '#fff'} barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Icon name="arrow-back" size={24} color="#800000" />
        </TouchableOpacity>
        <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>My Cart</Text>
        {cartItems.length > 0 && (
          <TouchableOpacity onPress={handleClearCart} style={styles.headerIcon}>
            <Icon name="delete-outline" size={24} color="#800000" />
          </TouchableOpacity>
        )}
      </View>

      {/* Branch Info */}
      {branchDetails && (
        <View style={[styles.branchInfo, colorScheme === 'dark' ? styles.branchInfoDark : styles.branchInfoLight]}>
          <Icon name="location-on" size={16} color="#800000" />
          <Text style={[styles.branchName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{branchDetails.name}</Text>
        </View>
      )}

      {/* Cart Items */}
      {cartItems.length === 0 ? (
        <View style={styles.emptyCart}>
          <Icon name="shopping-cart" size={80} color={colorScheme === 'dark' ? '#888' : '#d1d5db'} />
          <Text style={[styles.emptyCartText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Your cart is empty</Text>
          <TouchableOpacity style={[styles.continueShoppingButton, colorScheme === 'dark' ? styles.continueShoppingButtonDark : styles.continueShoppingButtonLight]} onPress={() => navigation.goBack()}>
            <Text style={styles.continueShoppingText}>Hungry? Explore the Menu!</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.cartList}
            showsVerticalScrollIndicator={false}
          />

          {/* Total and Checkout */}
          <View style={[styles.checkoutContainer, colorScheme === 'dark' ? styles.checkoutContainerDark : styles.checkoutContainerLight]}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Total:</Text>
              <Text style={styles.totalPrice}>₹{calculateTotal().toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutButton, colorScheme === 'dark' ? styles.checkoutButtonDark : styles.checkoutButtonLight]}
              onPress={() => navigation.navigate("CheckOut")}
            >
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  textLight: {
    color: '#333',
  },
  textDark: {
    color: '#e5e5e5',
  },
  header: {
    flexDirection: "row",
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
  headerText: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerIcon: {
    width: 40,
    alignItems: "center",
  },
  branchInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  branchInfoLight: {
    backgroundColor: "#fff7ed",
  },
  branchInfoDark: {
    backgroundColor: "#3a3a3a",
  },
  branchName: {
    fontSize: 14,
    marginLeft: 5,
  },
  emptyCart: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyCartText: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 30,
  },
  continueShoppingButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  continueShoppingButtonLight: {
    backgroundColor: "#800000",
  },
  continueShoppingButtonDark: {
    backgroundColor: "#4a0000",
  },
  continueShoppingText: {
    color: "#FFD700",
    fontWeight: "600",
    fontSize: 16,
  },
  cartList: {
    padding: 15,
  },
  cartItem: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cartItemLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  cartItemDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  itemImage: {
    width: 100,
    height: 120,
    resizeMode: "cover",
  },
  itemDetails: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    flex: 1,
  },
  removeButton: {
    padding: 5,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 5,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonLight: {
    backgroundColor: "#800000",
  },
  quantityButtonDark: {
    backgroundColor: "#4a0000",
  },
  quantityButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "bold",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "600",
    marginHorizontal: 15,
    minWidth: 20,
    textAlign: "center",
  },
  checkoutContainer: {
    padding: 20,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  checkoutContainerLight: {
    backgroundColor: "#fff",
    borderTopColor: "#e5e7eb",
  },
  checkoutContainerDark: {
    backgroundColor: "#2a2a2a",
    borderTopColor: "#444",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFD700",
  },
  checkoutButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  checkoutButtonLight: {
    backgroundColor: "#800000",
  },
  checkoutButtonDark: {
    backgroundColor: "#4a0000",
  },
  checkoutButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
  },
})

export default MyCart
