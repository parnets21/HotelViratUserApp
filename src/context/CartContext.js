import { createContext, useContext, useState, useEffect, useCallback } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { API_BASE_URL } from '../config/api'

// Create the context
const CartContext = createContext()

// Create a provider component
export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({})
  const [selectedBranch, setSelectedBranch] = useState(0)
  const [userId, setUserId] = useState(null)
  const [isCartInitialized, setIsCartInitialized] = useState(false)
  const [cartItems, setCartItems] = useState({})

  // Load user ID from AsyncStorage
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId")
        if (storedUserId) {
          setUserId(storedUserId)
        } else {
          // Clear cart if no user is logged in
          setCart({})
          setCartItems({})
        }
      } catch (error) {
        console.error("Error loading user ID:", error)
      }
    }

    loadUserId()

    // This is a workaround since React Native doesn't support storage event listeners
    // We'll check for user ID changes periodically
    const interval = setInterval(loadUserId, 1000)

    return () => clearInterval(interval)
  }, [])

  // Reset cart when user ID changes (login/logout)
  useEffect(() => {
    // Reset cart state when user changes
    setCart({})
    setCartItems({})
    setIsCartInitialized(false)
  }, [userId])

  // Sync cart with server on initial load or when user/branch changes
  useEffect(() => {
    const syncCartWithServer = async () => {
      if (!userId) {
        setIsCartInitialized(true)
        return
      }

      try {
        // Get branches
        const branchesResponse = await fetch(`${API_BASE_URL}/branch`)
        const branchesData = await branchesResponse.json()

        if (!Array.isArray(branchesData) || branchesData.length === 0) {
          setIsCartInitialized(true)
          return
        }

        // Get cart for current branch
        const branchId = branchesData[selectedBranch]?._id
        if (!branchId) {
          setIsCartInitialized(true)
          return
        }

        const cartResponse = await fetch(
          `${API_BASE_URL}/cart?userId=${userId}&branchId=${branchId}`,
        )
        const cartData = await cartResponse.json()

        if (cartData && cartData.items && cartData.items.length > 0) {
          // Update local cart state with server data
          const branchCart = {}
          const branchItems = []

          cartData.items.forEach((item) => {
            branchCart[item.menuItemId] = item.quantity
            branchItems.push({
              id: item.menuItemId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image: item.image,
            })
          })

          setCart((prevCart) => ({
            ...prevCart,
            [selectedBranch]: branchCart,
          }))

          setCartItems((prevItems) => ({
            ...prevItems,
            [selectedBranch]: branchItems,
          }))
        } else {
          // Ensure the branch cart is empty if no items returned
          setCart((prevCart) => ({
            ...prevCart,
            [selectedBranch]: {},
          }))

          setCartItems((prevItems) => ({
            ...prevItems,
            [selectedBranch]: [],
          }))
        }
      } catch (error) {
        console.error("Error syncing cart with server:", error)
      } finally {
        setIsCartInitialized(true)
      }
    }

    syncCartWithServer()
  }, [userId, selectedBranch])

  // Add item to cart
  const addToCart = useCallback(
    async (branchId, item, quantity = 1) => {
      if (!userId) return // Don't add to cart if no user is logged in

      try {
        // Update local cart state immediately for responsive UI
        setCart((prevCart) => {
          const branchCart = prevCart[branchId] || {}
          const newQuantity = (branchCart[item.id] || 0) + quantity

          return {
            ...prevCart,
            [branchId]: {
              ...branchCart,
              [item.id]: newQuantity,
            },
          }
        })

        // Update cart items state
        setCartItems((prevItems) => {
          const branchItems = prevItems[branchId] || []
          const existingItemIndex = branchItems.findIndex((i) => i.id === item.id)

          if (existingItemIndex >= 0) {
            // Update existing item
            const updatedItems = [...branchItems]
            updatedItems[existingItemIndex] = {
              ...updatedItems[existingItemIndex],
              quantity: updatedItems[existingItemIndex].quantity + quantity,
            }
            return {
              ...prevItems,
              [branchId]: updatedItems,
            }
          } else {
            // Add new item
            return {
              ...prevItems,
              [branchId]: [
                ...branchItems,
                {
                  id: item.id,
                  name: item.name,
                  price: item.price,
                  quantity: quantity,
                  image: item.image,
                },
              ],
            }
          }
        })

        // Sync with server
        await fetch(`${API_BASE_URL}/cart/add`, {
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
      } catch (error) {
        console.error("Error adding item to cart:", error)
      }
    },
    [userId],
  )

  // Remove item from cart
  const removeFromCart = useCallback(
    async (branchId, itemId, quantity = 1) => {
      if (!userId) return // Don't remove from cart if no user is logged in

      try {
        // Get current quantity before updating
        const branchCart = cart[branchId] || {}
        const currentQuantity = branchCart[itemId] || 0
        const newQuantity = currentQuantity - quantity

        // Update local cart state immediately for responsive UI
        setCart((prevCart) => {
          const branchCart = prevCart[branchId] || {}

          if (newQuantity <= 0) {
            // Remove the item completely
            const { [itemId]: _, ...rest } = branchCart
            return {
              ...prevCart,
              [branchId]: rest,
            }
          } else {
            // Reduce the quantity
            return {
              ...prevCart,
              [branchId]: {
                ...branchCart,
                [itemId]: newQuantity,
              },
            }
          }
        })

        // Update cart items state
        setCartItems((prevItems) => {
          const branchItems = prevItems[branchId] || []

          if (newQuantity <= 0) {
            // Remove the item completely
            return {
              ...prevItems,
              [branchId]: branchItems.filter((item) => item.id !== itemId),
            }
          } else {
            // Reduce the quantity
            return {
              ...prevItems,
              [branchId]: branchItems.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item)),
            }
          }
        })

        // Sync with server
        if (newQuantity <= 0) {
          await fetch(
            `${API_BASE_URL}/cart/remove?userId=${userId}&branchId=${branchId}&menuItemId=${itemId}`,
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
              menuItemId: itemId,
              quantity: newQuantity,
            }),
          })
        }
      } catch (error) {
        console.error("Error removing item from cart:", error)
      }
    },
    [userId, cart],
  )

  // Clear cart for a specific branch only
  const clearBranchCart = useCallback(
    async (branchId) => {
      if (!userId) return

      try {
        // Update local state
        setCart((prevCart) => {
          const { [branchId]: _, ...remainingCarts } = prevCart
          return remainingCarts
        })

        setCartItems((prevItems) => {
          const { [branchId]: _, ...remainingItems } = prevItems
          return remainingItems
        })

        // Sync with server
        await fetch(`${API_BASE_URL}/cart/clear?userId=${userId}&branchId=${branchId}`, {
          method: "DELETE",
        })
      } catch (error) {
        console.error("Error clearing cart:", error)
      }
    },
    [userId],
  )

  // Get cart items count for a branch
  const getBranchCartCount = useCallback(
    (branchId) => {
      // If cart isn't initialized yet or no user is logged in, return 0
      if (!isCartInitialized || !userId) return 0

      const branchItems = cartItems[branchId] || []
      return branchItems.reduce((sum, item) => sum + item.quantity, 0)
    },
    [isCartInitialized, userId, cartItems],
  )

  // Get cart items for a branch
  const getBranchCartItems = useCallback(
    (branchId) => {
      // If cart isn't initialized yet or no user is logged in, return empty array
      if (!isCartInitialized || !userId) return []

      return cartItems[branchId] || []
    },
    [isCartInitialized, userId, cartItems],
  )

  // Calculate total price for a branch
  const calculateBranchTotal = useCallback(
    (branchId) => {
      // If cart isn't initialized yet or no user is logged in, return 0
      if (!isCartInitialized || !userId) return 0

      const branchItems = cartItems[branchId] || []
      return branchItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    },
    [isCartInitialized, userId, cartItems],
  )

  return (
    <CartContext.Provider
      value={{
        cart,
        selectedBranch,
        setSelectedBranch,
        addToCart,
        removeFromCart,
        clearBranchCart,
        getBranchCartCount,
        getBranchCartItems,
        calculateBranchTotal,
        isCartInitialized,
        cartItems,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

// Custom hook to use the cart context
export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
