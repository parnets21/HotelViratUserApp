import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Image,
  Animated,
  Platform,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Appearance,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/MaterialIcons"
import { Picker } from "@react-native-picker/picker"
import { useNavigation } from "@react-navigation/native"
import { useCart } from "../context/CartContext"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Toast component with loading
const Toast = ({ message, type, isLoading }) => {
  return (
    <View style={[styles.toastContainer, type === "error" ? styles.errorToast : styles.successToast]}>
      {isLoading && <ActivityIndicator size="small" color="#FFD700" style={{ marginRight: 8 }} />}
      <Text style={styles.toastText}>{message}</Text>
    </View>
  )
}

// Address Item Component
const AddressItem = ({ address, selected, onSelect, onSetDefault, onEdit, onDelete, colorScheme }) => {
  return (
    <TouchableOpacity
      style={[styles.addressItem, selected && styles.addressItemSelected, colorScheme === 'dark' ? styles.addressItemDark : styles.addressItemLight]}
      onPress={() => onSelect(address)}
    >
      <View style={styles.addressItemContent}>
        <View style={styles.addressItemHeader}>
          <View style={[styles.addressItemBadge, colorScheme === 'dark' ? styles.addressItemBadgeDark : styles.addressItemBadgeLight]}>
            <Text style={[styles.addressItemBadgeText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{address.type}</Text>
          </View>
          {address.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
        <Text style={[styles.addressItemText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{address.address}</Text>
        <View style={styles.addressItemActions}>
          {!address.isDefault && (
            <TouchableOpacity style={styles.addressAction} onPress={() => onSetDefault(address._id)}>
              <Text style={styles.addressActionText}>Set Default</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.addressAction} onPress={() => onEdit(address)}>
            <Text style={styles.addressActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addressAction} onPress={() => onDelete(address._id)}>
            <Text style={[styles.addressActionText, styles.deleteActionText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.addressItemRadio}>
        <View style={[styles.radioOuter, colorScheme === 'dark' ? styles.radioOuterDark : styles.radioOuterLight]}>
          {selected && <View style={styles.radioInner} />}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// Address Modal Component (for both Add and Edit)
const AddressModal = ({ visible, onClose, onSave, userId, editAddress = null, colorScheme }) => {
  const [addressType, setAddressType] = useState("Home")
  const [addressText, setAddressText] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isEditMode = !!editAddress

  // Initialize form with edit data if available
  useEffect(() => {
    if (editAddress) {
      setAddressType(editAddress.type)
      setAddressText(editAddress.address)
      setIsDefault(editAddress.isDefault)
    } else {
      // Reset form for add mode
      setAddressType("Home")
      setAddressText("")
      setIsDefault(false)
    }
  }, [editAddress, visible])

  const handleSave = async () => {
    if (!addressText.trim()) {
      return
    }

    setIsLoading(true)
    try {
      if (isEditMode) {
        // Update existing address
        const response = await fetch(`http://192.168.1.24:9000/api/v1/hotel/address/${editAddress._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: addressType,
            address: addressText,
            isDefault,
          }),
        })

        const data = await response.json()
        if (response.ok) {
          onSave({ ...editAddress, ...data.address })
          onClose()
        } else {
          console.error("Error updating address:", data.message)
        }
      } else {
        // Add new address
        const response = await fetch("http://192.168.1.24:9000/api/v1/hotel/address", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            type: addressType,
            address: addressText,
            isDefault,
          }),
        })

        const data = await response.json()
        if (response.ok) {
          onSave(data.address)
          onClose()
        } else {
          console.error("Error adding address:", data.message)
        }
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? "updating" : "adding"} address:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
        <View style={[styles.modalContent, colorScheme === 'dark' ? styles.modalContentDark : styles.modalContentLight]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              {isEditMode ? "Edit Address" : "Add New Address"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colorScheme === 'dark' ? "#e5e5e5" : "#333"} />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Address Type</Text>
            <View style={styles.addressTypeContainer}>
              {["Home", "Work", "Other"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.addressTypeButton, addressType === type && styles.addressTypeButtonSelected, colorScheme === 'dark' ? styles.addressTypeButtonDark : styles.addressTypeButtonLight]}
                  onPress={() => setAddressType(type)}
                >
                  <Text
                    style={[styles.addressTypeButtonText, addressType === type && styles.addressTypeButtonTextSelected, colorScheme === 'dark' ? styles.textDark : styles.textLight, addressType === type && styles.addressTypeButtonTextSelectedDark]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
              placeholder="Enter your complete address"
              placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
              value={addressText}
              onChangeText={setAddressText}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formGroup}>
            <TouchableOpacity style={styles.defaultCheckbox} onPress={() => setIsDefault(!isDefault)}>
              <View style={[styles.checkbox, isDefault && styles.checkboxChecked, colorScheme === 'dark' ? styles.checkboxDark : styles.checkboxLight]}>
                {isDefault && <Icon name="check" size={16} color="#FFD700" />}
              </View>
              <Text style={[styles.checkboxLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Set as default address</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.cancelButton, colorScheme === 'dark' ? styles.cancelButtonDark : styles.cancelButtonLight]} onPress={onClose}>
              <Text style={[styles.cancelButtonText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, !addressText.trim() && styles.saveButtonDisabled, colorScheme === 'dark' ? styles.saveButtonDark : styles.saveButtonLight]}
              onPress={handleSave}
              disabled={!addressText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFD700" />
              ) : (
                <Text style={styles.saveButtonText}>{isEditMode ? "Update Address" : "Save Address"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// Delete Confirmation Modal
const DeleteConfirmationModal = ({ visible, onClose, onConfirm, isLoading, colorScheme }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.confirmModalContainer}>
        <View style={[styles.confirmModalContent, colorScheme === 'dark' ? styles.confirmModalContentDark : styles.confirmModalContentLight]}>
          <Icon name="warning" size={40} color="#FFD700" style={styles.confirmModalIcon} />
          <Text style={[styles.confirmModalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delete Address</Text>
          <Text style={[styles.confirmModalText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Are you sure you want to delete this address?</Text>
          <View style={styles.confirmModalActions}>
            <TouchableOpacity style={[styles.confirmCancelButton, colorScheme === 'dark' ? styles.confirmCancelButtonDark : styles.confirmCancelButtonLight]} onPress={onClose} disabled={isLoading}>
              <Text style={[styles.confirmCancelButtonText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmDeleteButton} onPress={onConfirm} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFD700" />
              ) : (
                <Text style={styles.confirmDeleteButtonText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const CheckOut = () => {
  const navigation = useNavigation()
  const { getBranchCartItems, calculateBranchTotal, clearBranchCart, selectedBranch } = useCart()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme())

  // Listen for system color scheme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme)
    })
    return () => subscription.remove()
  }, [])

  // Form state
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [deliveryOption, setDeliveryOption] = useState("delivery")
  const [specialInstructions, setSpecialInstructions] = useState("")
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)

  // Address state
  const [addresses, setAddresses] = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [addressToDelete, setAddressToDelete] = useState(null)
  const [isAddressLoading, setIsAddressLoading] = useState(false)

  // API data state
  const [userId, setUserId] = useState(null)
  const [branchId, setBranchId] = useState(null)
  const [branchDetails, setBranchDetails] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [couponDetails, setCouponDetails] = useState(null)
  const [loading, setLoading] = useState(true)

  // Toast and loading state
  const [toast, setToast] = useState(null)
  const [isOrderLoading, setIsOrderLoading] = useState(false)

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

  // Fetch addresses when userId changes
  useEffect(() => {
    fetchAddresses()
  }, [userId])

  // Fetch addresses function
  const fetchAddresses = async () => {
    if (!userId) return

    try {
      const response = await fetch(`http://192.168.1.24:9000/api/v1/hotel/address/${userId}`)
      const data = await response.json()

      if (Array.isArray(data)) {
        setAddresses(data)

        // Set default address as selected
        const defaultAddress = data.find((addr) => addr.isDefault)
        if (defaultAddress) {
          setSelectedAddress(defaultAddress)
        } else if (data.length > 0) {
          setSelectedAddress(data[0])
        }
      }
    } catch (error) {
      console.error("Error fetching addresses:", error)
      showToast("Failed to load addresses", "error")
    }
  }

  // Fetch branch and cart data
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return

      setLoading(true)
      try {
        // Get branch ID for the selected branch index
        const branchesResponse = await fetch("http://192.168.1.24:9000/api/v1/hotel/branch")
        const branchesData = await branchesResponse.json()

        if (!Array.isArray(branchesData) || branchesData.length === 0) {
          showToast("No branches available", "error")
          setLoading(false)
          return
        }

        const currentBranchId = branchesData[selectedBranch]?._id
        if (!currentBranchId) {
          showToast("Selected branch not found", "error")
          setLoading(false)
          return
        }

        setBranchId(currentBranchId)
        setBranchDetails({
          name: branchesData[selectedBranch].name,
          address: branchesData[selectedBranch].address,
        })

        // Fetch cart data
        const cartResponse = await fetch(
          `http://192.168.1.24:9000/api/v1/hotel/cart?userId=${userId}&branchId=${currentBranchId}`,
        )
        const cartData = await cartResponse.json()

        if (cartData && cartData.items) {
          setCartItems(
            cartData.items.map((item) => ({
              id: item.menuItemId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image: item.image ? `${item.image}` : null,
            })),
          )
        } else {
          setCartItems([])
        }

        // Fetch available coupons
        const couponsResponse = await fetch(
          `http://192.168.1.24:9000/api/v1/hotel/coupon?isActive=true&branchId=${currentBranchId}`,
        )
        const couponsData = await couponsResponse.json()

        if (Array.isArray(couponsData)) {
          setAvailableCoupons(
            couponsData.map((coupon) => ({
              code: coupon.code,
              description: coupon.description,
              discountType: coupon.discountType,
              discountValue: coupon.discountValue,
              minOrder: coupon.minOrderValue || 0,
              maxDiscount: coupon.maxDiscountAmount,
            })),
          )
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        showToast("Failed to load data", "error")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId, selectedBranch])

  // Show toast message with custom duration
  const showToast = (message, type = "success", loading = false, duration = 2000) => {
    setToast({ message, type })
    setIsOrderLoading(loading)

    // Start animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()

    // Set timeout to hide toast
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToast(null)
        if (!loading) {
          setIsOrderLoading(false)
        }
      })
    }, duration)

    return () => clearTimeout(timer)
  }

  // Calculate order totals
  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0)
  const deliveryFee = deliveryOption === "delivery" ? 40 : 0
  const discount = couponDetails ? couponDetails.discountAmount : 0
  const discountedSubtotal = subtotal - discount
  const tax = discountedSubtotal * 0.05
  const total = discountedSubtotal + deliveryFee + tax

  // Handle apply coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return

    setIsApplyingCoupon(true)
    try {
      const response = await fetch("http://192.168.1.24:9000/api/v1/hotel/coupon/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: couponCode,
          orderValue: subtotal,
          userId,
          branchId,
        }),
      })

      const data = await response.json()

      if (response.ok && data.valid) {
        setAppliedCoupon(couponCode.toUpperCase())
        setCouponDetails({
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountAmount: data.discountAmount,
        })
        showToast(
          `Coupon applied! ${data.discountType === "percentage" ? `${data.discountValue}% off` : `₹${data.discountAmount} off`}`,
          "success",
        )
      } else {
        setAppliedCoupon(null)
        setCouponDetails(null)
        showToast(data.message || "Invalid coupon code", "error")
      }
    } catch (error) {
      console.error("Error applying coupon:", error)
      showToast("Failed to apply coupon", "error")
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  // Handle select coupon
  const handleSelectCoupon = async (coupon) => {
    setCouponCode(coupon.code)
    setIsApplyingCoupon(true)

    try {
      const response = await fetch("http://192.168.1.24:9000/api/v1/hotel/coupon/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: coupon.code,
          orderValue: subtotal,
          userId,
          branchId,
        }),
      })

      const data = await response.json()

      if (response.ok && data.valid) {
        setAppliedCoupon(coupon.code)
        setCouponDetails({
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountAmount: data.discountAmount,
        })
        showToast(
          `Coupon applied! ${data.discountType === "percentage" ? `${data.discountValue}% off` : `₹${data.discountAmount} off`}`,
          "success",
        )
      } else {
        showToast(data.message || `Minimum order ₹${coupon.minOrder} required`, "error")
      }
    } catch (error) {
      console.error("Error selecting coupon:", error)
      showToast("Failed to apply coupon", "error")
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  // Handle remove coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode("")
    setCouponDetails(null)
    showToast("Coupon removed", "success")
  }

  // Handle set default address
  const handleSetDefaultAddress = async (addressId) => {
    try {
      const response = await fetch(`http://192.168.1.24:9000/api/v1/hotel/address/${addressId}/default`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        // Update addresses list
        const updatedAddresses = addresses.map((addr) => ({
          ...addr,
          isDefault: addr._id === addressId,
        }))
        setAddresses(updatedAddresses)
        showToast("Default address updated", "success")
      } else {
        showToast("Failed to update default address", "error")
      }
    } catch (error) {
      console.error("Error setting default address:", error)
      showToast("Failed to update default address", "error")
    }
  }

  // Handle add/update address
  const handleSaveAddress = (address) => {
    if (editingAddress) {
      // Update existing address in the list
      const updatedAddresses = addresses.map((addr) => (addr._id === address._id ? address : addr))
      setAddresses(updatedAddresses)

      // If the updated address was selected, update selectedAddress
      if (selectedAddress && selectedAddress._id === address._id) {
        setSelectedAddress(address)
      }

      // If the updated address is now default, update all other addresses
      if (address.isDefault) {
        const newAddresses = updatedAddresses.map((addr) => ({
          ...addr,
          isDefault: addr._id === address._id,
        }))
        setAddresses(newAddresses)
      }

      showToast("Address updated successfully", "success")
    } else {
      // Add new address to the list
      setAddresses([...addresses, address])

      // If this is the first address or it's set as default, select it
      if (address.isDefault || addresses.length === 0) {
        setSelectedAddress(address)
      }

      // If the new address is default, update all other addresses
      if (address.isDefault && addresses.length > 0) {
        const newAddresses = [...addresses].map((addr) => ({
          ...addr,
          isDefault: false,
        }))
        setAddresses([...newAddresses, address])
      }

      showToast("Address added successfully", "success")
    }

    // Reset editing state
    setEditingAddress(null)
  }

  // Handle edit address
  const handleEditAddress = (address) => {
    setEditingAddress(address)
    setShowAddressModal(true)
  }

  // Handle delete address
  const handleDeleteAddress = (addressId) => {
    setAddressToDelete(addressId)
    setShowDeleteModal(true)
  }

  // Confirm delete address
  const confirmDeleteAddress = async () => {
    if (!addressToDelete) return

    setIsAddressLoading(true)
    try {
      const response = await fetch(`http://192.168.1.24:9000/api/v1/hotel/address/${addressToDelete}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Remove address from list
        const newAddresses = addresses.filter((addr) => addr._id !== addressToDelete)
        setAddresses(newAddresses)

        // If the deleted address was selected, select another one
        if (selectedAddress && selectedAddress._id === addressToDelete) {
          const defaultAddress = newAddresses.find((addr) => addr.isDefault)
          setSelectedAddress(defaultAddress || (newAddresses.length > 0 ? newAddresses[0] : null))
        }

        showToast("Address deleted successfully", "success")
      } else {
        const errorData = await response.json()
        showToast(errorData.message || "Failed to delete address", "error")
      }
    } catch (error) {
      console.error("Error deleting address:", error)
      showToast("Failed to delete address", "error")
    } finally {
      setIsAddressLoading(false)
      setShowDeleteModal(false)
      setAddressToDelete(null)
    }
  }

  // Handle place order
  const handlePlaceOrder = async () => {
    if (!name.trim()) {
      showToast("Please enter your name", "error")
      return
    }

    if (!phone.trim() || phone.length < 10) {
      showToast("Please enter a valid phone number", "error")
      return
    }

    if (deliveryOption === "delivery" && !selectedAddress) {
      showToast("Please select a delivery address", "error")
      return
    }

    if (cartItems.length === 0) {
      showToast("Your cart is empty", "error")
      return
    }

    // Validate stock before placing order
    try {
      const stockValidationPromises = cartItems.map(async (item) => {
        const response = await fetch(`http://192.168.1.24:9000/api/v1/hotel/menu/${item.id}`)
        const productData = await response.json()
        
        if (productData.stock < item.quantity) {
          throw new Error(`${item.name}: Only ${productData.stock} items available in stock`)
        }
        return { item, productData }
      })

      await Promise.all(stockValidationPromises)
    } catch (error) {
      showToast(error.message, "error")
      return
    }

    setIsOrderLoading(true)
    showToast("Processing your order, please wait...", "success", true, 10000)

    try {
      // Prepare order items in the format expected by the API
      const orderItems = cartItems.map((item) => ({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image ? item.image.replace("http://192.168.1.24:9000/", "") : null,
      }))

      // Create order
      const orderResponse = await fetch("http://192.168.1.24:9000/api/v1/hotel/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          branchId,
          items: orderItems,
          subtotal,
          discount,
          couponCode: appliedCoupon,
          deliveryFee,
          tax,
          total,
          deliveryOption,
          deliveryAddress: selectedAddress ? selectedAddress.address : null,
          name,
          phone,
          paymentMethod,
          specialInstructions,
        }),
      })

      const orderData = await orderResponse.json()

      if (!orderResponse.ok) {
        throw new Error(orderData.message || "Failed to create order")
      }

      // Apply coupon if used
      if (appliedCoupon) {
        await fetch("http://192.168.1.24:9000/api/v1/hotel/coupon/apply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: appliedCoupon,
            userId,
            orderId: orderData.order._id,
          }),
        })
      }

      // Clear local cart state
      clearBranchCart(selectedBranch)

      // Show success toast
      showToast("Order placed successfully!", "success", false, 1000)

      // Navigate to orders screen
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "Tabs",
              params: { screen: "MyOrders" },
            },
          ],
        })
      }, 1000)
    } catch (error) {
      console.error("Error placing order:", error)
      showToast(error.message || "Failed to place order", "error")
      setIsOrderLoading(false)
    }
  }

  // Render coupon item
  const renderCouponItem = (coupon) => (
    <TouchableOpacity
      key={coupon.code}
      style={[
        styles.couponItem,
        appliedCoupon === coupon.code && styles.couponItemSelected,
        subtotal < coupon.minOrder && styles.couponItemDisabled,
        colorScheme === 'dark' ? styles.couponItemDark : styles.couponItemLight
      ]}
      onPress={() => handleSelectCoupon(coupon)}
      disabled={subtotal < coupon.minOrder || isApplyingCoupon}
    >
      <View style={styles.couponItemLeft}>
        <Icon name="local-offer" size={24} color={appliedCoupon === coupon.code ? "#FFD700" : colorScheme === 'dark' ? "#888" : "#999"} />
        <View style={styles.couponItemDetails}>
          <Text style={[styles.couponItemCode, appliedCoupon === coupon.code && styles.couponItemCodeSelected, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            {coupon.code}
          </Text>
          <Text style={[styles.couponItemDescription, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            {coupon.discountType === "percentage" ? `${coupon.discountValue}% Off` : `₹${coupon.discountValue} off`}
          </Text>
          <Text style={[styles.couponItemMinOrder, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Min. Order ₹{coupon.minOrder}</Text>
        </View>
      </View>
      {appliedCoupon === coupon.code && <Icon name="check-circle" size={24} color="#FFD700" />}
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={[styles.loadingContainer, colorScheme === 'dark' ? styles.loadingContainerDark : styles.loadingContainerLight]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={[styles.loadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Loading checkout...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar backgroundColor={colorScheme === 'dark' ? "#1a1a1a" : "#fff"} barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />

      {/* Toast Message */}
      {toast && (
        <Animated.View style={[styles.toastWrapper, { opacity: fadeAnim }]}>
          <Toast message={toast.message} type={toast.type} isLoading={isOrderLoading} />
        </Animated.View>
      )}

      {/* Address Modal (Add/Edit) */}
      <AddressModal
        visible={showAddressModal}
        onClose={() => {
          setShowAddressModal(false)
          setEditingAddress(null)
        }}
        onSave={handleSaveAddress}
        userId={userId}
        editAddress={editingAddress}
        colorScheme={colorScheme}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteAddress}
        isLoading={isAddressLoading}
        colorScheme={colorScheme}
      />

      {/* Header */}
      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colorScheme === 'dark' ? "#e5e5e5" : "#333"} />
        </TouchableOpacity>
        <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Scrollable Content */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Branch Info */}
        {branchDetails && (
          <View style={[styles.branchInfo, colorScheme === 'dark' ? styles.branchInfoDark : styles.branchInfoLight]}>
            <Icon name="location-on" size={20} color="#FFD700" />
            <Text style={[styles.branchName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{branchDetails.name}</Text>
          </View>
        )}

        {/* Order Summary */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Order Summary</Text>
          <View style={[styles.orderSummary, colorScheme === 'dark' ? styles.orderSummaryDark : styles.orderSummaryLight]}>
            {cartItems.map((item) => (
              <View key={item.id} style={[styles.orderItem, colorScheme === 'dark' ? styles.orderItemDark : styles.orderItemLight]}>
                <Image
                  source={item.image ? { uri: item.image } : require("../assets/lemon.jpg")}
                  style={styles.orderItemImage}
                />
                <View style={styles.orderItemDetails}>
                  <View style={styles.orderItemLeft}>
                    <Text style={styles.orderItemQuantity}>{item.quantity}x</Text>
                    <Text style={[styles.orderItemName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{item.name}</Text>
                  </View>
                  <Text style={[styles.orderItemPrice, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Delivery Option */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delivery Option</Text>
          <View style={styles.deliveryOptions}>
            <TouchableOpacity
              style={[styles.deliveryOption, deliveryOption === "delivery" && styles.deliveryOptionSelected, colorScheme === 'dark' ? styles.deliveryOptionDark : styles.deliveryOptionLight]}
              onPress={() => setDeliveryOption("delivery")}
            >
              <Icon name="delivery-dining" size={24} color={deliveryOption === "delivery" ? "#FFD700" : colorScheme === 'dark' ? "#888" : "#999"} />
              <Text
                style={[styles.deliveryOptionText, deliveryOption === "delivery" && styles.deliveryOptionTextSelected, colorScheme === 'dark' ? styles.textDark : styles.textLight]}
              >
                Delivery
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deliveryOption, deliveryOption === "pickup" && styles.deliveryOptionSelected, colorScheme === 'dark' ? styles.deliveryOptionDark : styles.deliveryOptionLight]}
              onPress={() => setDeliveryOption("pickup")}
            >
              <Icon name="store" size={24} color={deliveryOption === "pickup" ? "#FFD700" : colorScheme === 'dark' ? "#888" : "#999"} />
              <Text
                style={[styles.deliveryOptionText, deliveryOption === "pickup" && styles.deliveryOptionTextSelected, colorScheme === 'dark' ? styles.textDark : styles.textLight]}
              >
                Pickup
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Address */}
        {deliveryOption === "delivery" && (
          <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delivery Address</Text>
              <TouchableOpacity
                style={[styles.addButton, colorScheme === 'dark' ? styles.addButtonDark : styles.addButtonLight]}
                onPress={() => {
                  setEditingAddress(null)
                  setShowAddressModal(true)
                }}
              >
                <Icon name="add" size={18} color="#FFD700" />
                <Text style={styles.addButtonText}>Add New</Text>
              </TouchableOpacity>
            </View>

            {addresses.length === 0 ? (
              <View style={[styles.noAddressContainer, colorScheme === 'dark' ? styles.noAddressContainerDark : styles.noAddressContainerLight]}>
                <Icon name="location-off" size={40} color={colorScheme === 'dark' ? "#888" : "#999"} />
                <Text style={[styles.noAddressText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No saved addresses</Text>
                <Text style={[styles.noAddressSubtext, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Add a new address to continue</Text>
              </View>
            ) : (
              <View style={styles.addressList}>
                {addresses.map((address) => (
                  <AddressItem
                    key={address._id}
                    address={address}
                    selected={selectedAddress && selectedAddress._id === address._id}
                    onSelect={setSelectedAddress}
                    onSetDefault={handleSetDefaultAddress}
                    onEdit={handleEditAddress}
                    onDelete={handleDeleteAddress}
                    colorScheme={colorScheme}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Contact Information */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Contact Information</Text>
          <View style={styles.formGroup}>
            <Text style={[styles.label, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Full Name</Text>
            <TextInput
              style={[styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
              placeholder="Enter your full name"
              placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={[styles.label, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Phone Number</Text>
            <TextInput
              style={[styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
              placeholder="Enter your phone number"
              placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* Payment Method */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Payment Method</Text>
          <View style={[styles.pickerContainer, colorScheme === 'dark' ? styles.pickerContainerDark : styles.pickerContainerLight]}>
            <Picker
              selectedValue={paymentMethod}
              onValueChange={(itemValue) => setPaymentMethod(itemValue)}
              style={[styles.picker, colorScheme === 'dark' ? styles.pickerDark : styles.pickerLight]}
            >
              <Picker.Item label="Cash on Delivery" value="cash" />
              <Picker.Item label="Credit/Debit Card" value="card" />
              <Picker.Item label="UPI" value="upi" />
            </Picker>
          </View>
        </View>

        {/* Available Offers */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Available Offers</Text>
          <View style={styles.couponContainer}>
            <TextInput
              style={[styles.couponInput, colorScheme === 'dark' ? styles.couponInputDark : styles.couponInputLight]}
              placeholder="Enter coupon code"
              placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
              value={couponCode}
              onChangeText={setCouponCode}
              editable={!appliedCoupon && !isApplyingCoupon}
            />
            {appliedCoupon ? (
              <TouchableOpacity style={[styles.couponButton, colorScheme === 'dark' ? styles.couponButtonDark : styles.couponButtonLight]} onPress={handleRemoveCoupon} disabled={isApplyingCoupon}>
                <Text style={styles.couponButtonText}>Remove</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.couponButton, (!couponCode || isApplyingCoupon) && styles.couponButtonDisabled, colorScheme === 'dark' ? styles.couponButtonDark : styles.couponButtonLight]}
                onPress={handleApplyCoupon}
                disabled={!couponCode || isApplyingCoupon}
              >
                {isApplyingCoupon ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : (
                  <Text style={styles.couponButtonText}>Apply</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {appliedCoupon && couponDetails && (
            <View style={styles.couponAppliedContainer}>
              <Icon name="check-circle" size={20} color="#4BB543" />
              <Text style={[styles.couponAppliedText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                Coupon {appliedCoupon} applied
                {couponDetails.discountType === "percentage"
                  ? ` (${couponDetails.discountValue}% off)`
                  : ` (₹${couponDetails.discountAmount} off)`}
              </Text>
            </View>
          )}
          <View style={styles.couponList}>{availableCoupons.map((coupon) => renderCouponItem(coupon))}</View>
        </View>

        {/* Special Instructions */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Special Instructions</Text>
          <TextInput
            style={[styles.input, styles.textArea, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
            placeholder="Any special instructions for your order?"
            placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Price Details */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Price Details</Text>
          <View style={[styles.priceDetails, colorScheme === 'dark' ? styles.priceDetailsDark : styles.priceDetailsLight]}>
            <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
              <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Subtotal</Text>
              <Text style={[styles.priceValue, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{subtotal.toFixed(2)}</Text>
            </View>
            {discount > 0 && (
              <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
                <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                  Discount{" "}
                  {couponDetails && couponDetails.discountType === "percentage"
                    ? `(${couponDetails.discountValue}%)`
                    : ""}
                </Text>
                <Text style={[styles.priceValue, styles.discountValue]}>-₹{discount.toFixed(2)}</Text>
              </View>
            )}
            {deliveryOption === "delivery" && (
              <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
                <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delivery Fee</Text>
                <Text style={[styles.priceValue, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{deliveryFee.toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
              <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Tax (5%)</Text>
              <Text style={[styles.priceValue, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.priceRow, styles.totalRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
              <Text style={[styles.totalLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Total</Text>
              <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer with Place Order Button */}
      <View style={[styles.footer, colorScheme === 'dark' ? styles.footerDark : styles.footerLight]}>
        <TouchableOpacity
          style={[styles.placeOrderButton, isOrderLoading && styles.placeOrderButtonDisabled, colorScheme === 'dark' ? styles.placeOrderButtonDark : styles.placeOrderButtonLight]}
          onPress={handlePlaceOrder}
          disabled={isOrderLoading}
        >
          {isOrderLoading ? (
            <ActivityIndicator size="large" color="#FFD700" />
          ) : (
            <Text style={styles.placeOrderButtonText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
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
  loadingContainerLight: {
    backgroundColor: "#f8f9fa",
  },
  loadingContainerDark: {
    backgroundColor: "#1a1a1a",
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    elevation: 4,
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
  },
  branchInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  branchInfoLight: {
    backgroundColor: "#fff",
    borderBottomColor: "#e5e7eb",
  },
  branchInfoDark: {
    backgroundColor: "#2a2a2a",
    borderBottomColor: "#444",
  },
  branchName: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  section: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  sectionLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  sectionDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonLight: {
    backgroundColor: "#800000",
  },
  addButtonDark: {
    backgroundColor: "#4a0000",
  },
  addButtonText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  orderSummary: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  orderSummaryLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  orderSummaryDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  orderItemLight: {
    borderBottomColor: "#e5e7eb",
  },
  orderItemDark: {
    borderBottomColor: "#444",
  },
  orderItemImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 10,
  },
  orderItemDetails: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderItemQuantity: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFD700",
    marginRight: 8,
    width: 30,
  },
  orderItemName: {
    fontSize: 15,
  },
  orderItemPrice: {
    fontSize: 15,
    fontWeight: "600",
  },
  deliveryOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deliveryOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  deliveryOptionLight: {
    borderColor: "#e5e7eb",
  },
  deliveryOptionDark: {
    borderColor: "#444",
  },
  deliveryOptionSelected: {
    borderColor: "#800000",
    backgroundColor: "#fff7ed",
  },
  deliveryOptionText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  deliveryOptionTextSelected: {
    color: "#FFD700",
  },
  addressList: {
    marginTop: 8,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  addressItemLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  addressItemDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  addressItemSelected: {
    borderColor: "#800000",
    backgroundColor: "#fff7ed",
  },
  addressItemContent: {
    flex: 1,
  },
  addressItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  addressItemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  addressItemBadgeLight: {
    backgroundColor: "#e5e7eb",
  },
  addressItemBadgeDark: {
    backgroundColor: "#444",
  },
  addressItemBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  defaultBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4BB543",
  },
  addressItemText: {
    fontSize: 14,
    lineHeight: 20,
  },
  addressItemRadio: {
    marginLeft: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterLight: {
    borderColor: "#800000",
  },
  radioOuterDark: {
    borderColor: "#FFD700",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#800000",
  },
  addressItemActions: {
    flexDirection: "row",
    marginTop: 8,
  },
  addressAction: {
    marginRight: 16,
  },
  addressActionText: {
    fontSize: 13,
    color: "#FFD700",
    fontWeight: "600",
  },
  deleteActionText: {
    color: "#FF3333",
  },
  noAddressContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
  },
  noAddressContainerLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  noAddressContainerDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  noAddressText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10,
  },
  noAddressSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    color: "#333",
  },
  inputDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
    color: "#e5e5e5",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  pickerContainerLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  pickerContainerDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  picker: {
    height: 50,
  },
  pickerLight: {
    color: "#333",
  },
  pickerDark: {
    color: "#e5e5e5",
  },
  couponContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 10,
  },
  couponInputLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    color: "#333",
  },
  couponInputDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
    color: "#e5e5e5",
  },
  couponButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  couponButtonLight: {
    backgroundColor: "#800000",
  },
  couponButtonDark: {
    backgroundColor: "#4a0000",
  },
  couponButtonDisabled: {
    backgroundColor: "#e5e7eb",
  },
  couponButtonText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "600",
  },
  couponAppliedContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    padding: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
  },
  couponAppliedText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#4BB543",
    fontWeight: "600",
  },
  couponList: {
    marginTop: 8,
  },
  couponItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  couponItemLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  couponItemDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  couponItemSelected: {
    borderColor: "#800000",
    backgroundColor: "#fff7ed",
  },
  couponItemDisabled: {
    backgroundColor: "#e5e7eb",
    opacity: 0.7,
  },
  couponItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  couponItemDetails: {
    marginLeft: 12,
  },
  couponItemCode: {
    fontSize: 16,
    fontWeight: "700",
  },
  couponItemCodeSelected: {
    color: "#FFD700",
  },
  couponItemDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  couponItemMinOrder: {
    fontSize: 13,
    marginTop: 2,
  },
  priceDetails: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  priceDetailsLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  priceDetailsDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  priceRowLight: {
    borderBottomColor: "#e5e7eb",
  },
  priceRowDark: {
    borderBottomColor: "#444",
  },
  priceLabel: {
    fontSize: 15,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  discountValue: {
    color: "#4BB543",
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFD700",
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  footerLight: {
    backgroundColor: "#fff",
    borderTopColor: "#e5e7eb",
  },
  footerDark: {
    backgroundColor: "#2a2a2a",
    borderTopColor: "#444",
  },
  placeOrderButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  placeOrderButtonLight: {
    backgroundColor: "#800000",
  },
  placeOrderButtonDark: {
    backgroundColor: "#4a0000",
  },
  placeOrderButtonDisabled: {
    opacity: 0.6,
  },
  placeOrderButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
  },
  toastWrapper: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: "center",
  },
  toastContainer: {
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  successToast: {
    backgroundColor: "#4BB543",
  },
  errorToast: {
    backgroundColor: "#FF3333",
  },
  toastText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "80%",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modalContentLight: {
    backgroundColor: "#fff",
  },
  modalContentDark: {
    backgroundColor: "#2a2a2a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  addressTypeContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  addressTypeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    marginHorizontal: 4,
    borderRadius: 6,
  },
  addressTypeButtonLight: {
    borderColor: "#e5e7eb",
  },
  addressTypeButtonDark: {
    borderColor: "#444",
  },
  addressTypeButtonSelected: {
    borderColor: "#800000",
    backgroundColor: "#fff7ed",
  },
  addressTypeButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addressTypeButtonTextSelected: {
    color: "#FFD700",
  },
  addressTypeButtonTextSelectedDark: {
    color: "#FFD700",
  },
  defaultCheckbox: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxLight: {
    borderColor: "#e5e7eb",
  },
  checkboxDark: {
    borderColor: "#444",
  },
  checkboxChecked: {
    backgroundColor: "#800000",
    borderColor: "#800000",
  },
  checkboxLabel: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    marginRight: 8,
  },
  cancelButtonLight: {
    borderColor: "#e5e7eb",
  },
  cancelButtonDark: {
    borderColor: "#444",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 2,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    marginLeft: 8,
  },
  saveButtonLight: {
    backgroundColor: "#800000",
  },
  saveButtonDark: {
    backgroundColor: "#4a0000",
  },
  saveButtonDisabled: {
    backgroundColor: "#e5e7eb",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFD700",
  },
  confirmModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  confirmModalContent: {
    borderRadius: 12,
    padding: 24,
    width: "80%",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  confirmModalContentLight: {
    backgroundColor: "#fff",
  },
  confirmModalContentDark: {
    backgroundColor: "#2a2a2a",
  },
  confirmModalIcon: {
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmModalText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  confirmModalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    marginRight: 8,
  },
  confirmCancelButtonLight: {
    borderColor: "#e5e7eb",
  },
  confirmCancelButtonDark: {
    borderColor: "#444",
  },
  confirmCancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FF3333",
    borderRadius: 8,
    marginLeft: 8,
  },
  confirmDeleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFD700",
  },
})

export default CheckOut