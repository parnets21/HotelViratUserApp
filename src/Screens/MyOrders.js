import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation, useRoute } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";

const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
};

const getStatusColor = (status) => {
  const colors = {
    pending: "#f97316",
    confirmed: "#3b82f6",
    preparing: "#8b5cf6",
    "out for delivery": "#0ea5e9",
    delivered: "#4BB543",
    cancelled: "#FF3333",
  };
  return colors[status.toLowerCase()] || "#666";
};

const getPaymentMethodIcon = (method) => {
  const icons = {
    card: "credit-card",
    upi: "account-balance",
    cash: "payments",
  };
  return icons[method?.toLowerCase()] || "payments";
};

const getPaymentMethodText = (method) => {
  const texts = {
    card: "Card Payment",
    upi: "UPI Payment",
    cash: "Cash on Delivery",
  };
  return texts[method?.toLowerCase()] || "Payment method not available";
};

// Component for order item in the list
const OrderItem = ({ item, onPress, onCancelPress, canCancelOrder, isLastItem, colorScheme }) => {
  const capitalizeStatus = (status) => {
    if (!status) return status;
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  // Safety check for null/undefined item
  if (!item) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.orderCard, isLastItem && styles.lastOrderCard, colorScheme === 'dark' ? styles.orderCardDark : styles.orderCardLight]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <Text style={[styles.orderId, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Order #{item.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
            <Text style={[styles.orderStatus, { color: getStatusColor(item.status) }]}>
              {capitalizeStatus(item.status)}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={24} color={colorScheme === 'dark' ? "#888" : "#999"} />
      </View>

      <View style={styles.orderDetails}> 
    
        {[
          { icon: "store", text: item.branchId?.name || "Unknown Branch" },
          { icon: "event", text: formatDate(item.createdAt) },
          { icon: getPaymentMethodIcon(item.paymentMethod), text: getPaymentMethodText(item.paymentMethod) },
          { icon: "currency-rupee", text: `₹${item.total?.toFixed(2) || '0.00'}` },
        ].map((detail, index) => (
          <View key={index} style={styles.orderInfo}>
            <Icon name={detail.icon} size={18} color={colorScheme === 'dark' ? "#888" : "#666"} style={styles.orderIcon} />
            <Text style={[styles.orderInfoText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{detail.text}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.orderItemsPreview, colorScheme === 'dark' ? styles.orderItemsPreviewDark : styles.orderItemsPreviewLight]}>
        {item.items && item.items.length > 0 ? (
          <>
            {item.items.slice(0, 2).map((orderItem, index) => (
              <View key={index} style={styles.orderItemPreview}>
                <Image
                  source={
                    orderItem?.image
                      ? { uri: `${orderItem.image}` }
                      : require("../assets/lemon.jpg")
                  }
                  style={styles.orderItemImage}
                />
                <Text style={[styles.orderItemName, colorScheme === 'dark' ? styles.textDark : styles.textLight]} numberOfLines={1}>
                  {orderItem?.quantity || 0}x {orderItem?.name || 'Unknown Item'}
                </Text>
              </View>
            ))}
            {item.items.length > 2 && <Text style={[styles.orderMoreItems, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>+{item.items.length - 2} more items</Text>}
          </>
        ) : (
          <Text style={[styles.orderMoreItems, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No items found</Text>
        )}
      </View>

      <View style={[styles.orderActions, colorScheme === 'dark' ? styles.orderActionsDark : styles.orderActionsLight]}>
        {item.status.toLowerCase() === "pending" && canCancelOrder(item) && (
          <TouchableOpacity
            style={[styles.orderActionButton, styles.cancelButton, colorScheme === 'dark' ? styles.cancelButtonDark : styles.cancelButtonLight]}
            onPress={() => onCancelPress(item)}
          >
            <Icon name="close" size={16} color="#FF3333" />
            <Text style={[styles.orderActionText, styles.cancelText]}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.orderActionButton, colorScheme === 'dark' ? styles.orderActionButtonDark : styles.orderActionButtonLight]} onPress={onPress}>
          <Icon name="receipt-long" size={16} color={colorScheme === 'dark' ? "#888" : "#666"} />
          <Text style={[styles.orderActionText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Details</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// Component for order details modal
const OrderDetailModal = ({ order, onClose, onCancelPress, canCancelOrder, loading, getDeliverySteps, colorScheme }) => {
  if (!order) return null;

  const deliverySteps = getDeliverySteps(order);

  return (
    <Modal visible={!!order} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, colorScheme === 'dark' ? styles.modalOverlayDark : styles.modalOverlayLight]}>
        <View style={[styles.modalContainer, colorScheme === 'dark' ? styles.modalContainerDark : styles.modalContainerLight]}>
          <View style={[styles.modalHeader, colorScheme === 'dark' ? styles.modalHeaderDark : styles.modalHeaderLight]}>
            <Text style={[styles.modalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Order #{order.orderNumber}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={24} color={colorScheme === 'dark' ? "#888" : "#666"} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Order Tracking */}
            {deliverySteps && deliverySteps.length > 0 && (
              <View style={[styles.modalSection, colorScheme === 'dark' ? styles.modalSectionDark : styles.modalSectionLight]}>
                <Text style={[styles.modalSectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Order Tracking</Text>
                <View style={styles.trackingContainer}>
                  {deliverySteps.map((step, index) => (
                    <View key={index} style={styles.trackingStep}>
                      <View style={styles.trackingStepLeft}>
                        <View
                          style={[
                            styles.trackingDot,
                            step.completed ? styles.trackingDotCompleted : styles.trackingDotPending,
                            order.status.toLowerCase() === "cancelled" && step.status.toLowerCase() === "cancelled"
                              ? styles.trackingDotCancelled
                              : {},
                          ]}
                        />
                        {index < deliverySteps.length - 1 && (
                          <View
                            style={[
                              styles.trackingLine,
                              step.completed && deliverySteps[index + 1].completed
                                ? styles.trackingLineCompleted
                                : styles.trackingLinePending,
                            ]}
                          />
                        )}
                      </View>
                      <View style={styles.trackingStepContent}>
                        <Text style={[styles.trackingStepTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{step.status}</Text>
                        {step.time && (
                          <Text style={[styles.trackingStepTime, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                            {new Date(step.time).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>

                {order.status.toLowerCase() === "cancelled" && order.cancellationReason && (
                  <View style={[styles.cancellationReason, colorScheme === 'dark' ? styles.cancellationReasonDark : styles.cancellationReasonLight]}>
                    <Text style={[styles.cancellationReasonTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Cancellation Reason:</Text>
                    <Text style={[styles.cancellationReasonText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{order.cancellationReason}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Order Items */}
            <View style={[styles.modalSection, colorScheme === 'dark' ? styles.modalSectionDark : styles.modalSectionLight]}>
              <Text style={[styles.modalSectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Order Items</Text>
              <View style={[styles.orderItemsContainer, colorScheme === 'dark' ? styles.orderItemsContainerDark : styles.orderItemsContainerLight]}>
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, index) => (
                    <View key={index} style={[styles.modalItem, colorScheme === 'dark' ? styles.modalItemDark : styles.modalItemLight]}>
                      <Image
                        source={
                          item?.image
                            ? { uri: `${item.image}` }
                            : require("../assets/lemon.jpg")
                        }
                        style={styles.modalItemImage}
                      />
                      <View style={styles.modalItemDetails}>
                        <View style={styles.modalItemTop}>
                          <Text style={[styles.modalItemName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{item?.name || 'Unknown Item'}</Text>
                          <Text style={styles.modalItemPrice}>₹{((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}</Text>
                        </View>
                        <Text style={[styles.modalItemQuantity, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Quantity: {item?.quantity || 0}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.modalItemName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No items found</Text>
                )}
              </View>
            </View>

            {/* Restaurant Details */}
            <View style={[styles.modalSection, colorScheme === 'dark' ? styles.modalSectionDark : styles.modalSectionLight]}>
              <Text style={[styles.modalSectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Restaurant Details</Text>
              <View style={styles.restaurantDetails}>
                <Icon name="store" size={20} color="#FFD700" style={styles.restaurantIcon} />
                <View style={styles.restaurantInfo}>
                  <Text style={[styles.restaurantName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{order.branchId?.name || 'Unknown Restaurant'}</Text>
                  <Text style={[styles.restaurantAddress, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{order.branchId?.address || 'Address not available'}</Text>
                </View>
              </View>
            </View>

            {/* Delivery Details */}
            <View style={[styles.modalSection, colorScheme === 'dark' ? styles.modalSectionDark : styles.modalSectionLight]}>
              <Text style={[styles.modalSectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delivery Details</Text>
              <View style={styles.deliveryOption}>
                <Icon
                  name={order.deliveryOption === "delivery" ? "delivery-dining" : "store-mall-directory"}
                  size={20}
                  color="#FFD700"
                  style={styles.deliveryIcon}
                />
                <Text style={[styles.deliveryOptionText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                  {order.deliveryOption === "delivery" ? "Home Delivery" : "Self Pickup"}
                </Text>
              </View>

              {order.deliveryOption === "delivery" && order.deliveryAddress && (
                <View style={[styles.addressContainer, colorScheme === 'dark' ? styles.addressContainerDark : styles.addressContainerLight]}>
                  <Text style={[styles.addressLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delivery Address:</Text>
                  <Text style={[styles.addressText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{order.deliveryAddress}</Text>
                </View>
              )}
            </View>

            {/* Payment Information */}
            <View style={[styles.modalSection, colorScheme === 'dark' ? styles.modalSectionDark : styles.modalSectionLight]}>
              <Text style={[styles.modalSectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Payment Information</Text>
              <View style={styles.paymentMethod}>
                <Icon
                  name={getPaymentMethodIcon(order.paymentMethod)}
                  size={20}
                  color="#FFD700"
                  style={styles.paymentIcon}
                />
                <Text style={[styles.paymentMethodText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{getPaymentMethodText(order.paymentMethod)}</Text>
              </View>

              {order.paymentMethod === "card" && (
                <View style={[styles.cardDetails, colorScheme === 'dark' ? styles.cardDetailsDark : styles.cardDetailsLight]}>
                  {/* <Text style={styles.cardType}>Card ending with ****</Text> */}
                </View>
              )}

              {order.paymentMethod === "upi" && (
                <View style={[styles.cardDetails, colorScheme === 'dark' ? styles.cardDetailsDark : styles.cardDetailsLight]}>
                  <Text style={[styles.cardType, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>UPI Payment</Text>
                </View>
              )}
            </View>

            {/* Contact Information */}
            <View style={[styles.modalSection, colorScheme === 'dark' ? styles.modalSectionDark : styles.modalSectionLight]}>
              <Text style={[styles.modalSectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Contact Information</Text>
              <View style={styles.contactInfo}>
                {[
                  { icon: "person", text: order.name },
                  { icon: "phone", text: order.phone },
                ].map((contact, index) => (
                  <View key={index} style={styles.contactItem}>
                    <Icon name={contact.icon} size={20} color={colorScheme === 'dark' ? "#888" : "#666"} style={styles.contactIcon} />
                    <Text style={[styles.contactText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{contact.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Price Details */}
            <View style={[styles.modalSection, colorScheme === 'dark' ? styles.modalSectionDark : styles.modalSectionLight]}>
              <Text style={[styles.modalSectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Price Details</Text>
              <View style={[styles.priceDetails, colorScheme === 'dark' ? styles.priceDetailsDark : styles.priceDetailsLight]}>
                <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
                  <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Item Total</Text>
                  <Text style={[styles.priceValue, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{order.subtotal.toFixed(2)}</Text>
                </View>

                {order.discount > 0 && (
                  <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
                    <View style={styles.discountRow}>
                      <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Discount</Text>
                      {order.couponCode && (
                        <View style={styles.couponBadge}>
                          <Text style={styles.couponBadgeText}>{order.couponCode}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.priceValue, styles.discountValue]}>
                      -₹{order.discount.toFixed(2)}
                    </Text>
                  </View>
                )}

                {order.deliveryOption === "delivery" && (
                  <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
                    <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delivery Fee</Text>
                    <Text style={[styles.priceValue, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{order.deliveryFee.toFixed(2)}</Text>
                  </View>
                )}

                <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
                  <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Taxes & Charges</Text>
                  <Text style={[styles.priceValue, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{order.tax.toFixed(2)}</Text>
                </View>

                <View style={[styles.priceRow, styles.totalRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
                  <Text style={[styles.totalLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Grand Total</Text>
                  <Text style={styles.totalValue}>₹{order.total.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {/* Special Instructions */}
            {order.specialInstructions && (
              <View style={[styles.modalSection, colorScheme === 'dark' ? styles.modalSectionDark : styles.modalSectionLight]}>
                <Text style={[styles.modalSectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Special Instructions</Text>
                <View style={[styles.instructionsContainer, colorScheme === 'dark' ? styles.instructionsContainerDark : styles.instructionsContainerLight]}>
                  <Icon name="info" size={20} color={colorScheme === 'dark' ? "#888" : "#666"} style={styles.instructionsIcon} />
                  <Text
                    style={[styles.instructionsText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {order.specialInstructions}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.modalFooter, colorScheme === 'dark' ? styles.modalFooterDark : styles.modalFooterLight]}>
            {order.status.toLowerCase() === "pending" && canCancelOrder(order) && (
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelOrderButton, colorScheme === 'dark' ? styles.cancelOrderButtonDark : styles.cancelOrderButtonLight]}
                onPress={() => {
                  onClose();
                  onCancelPress(order);
                }}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : (
                  <Text style={styles.modalButtonText}>Cancel Order</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Component for cancel reason modal
const CancelReasonModal = ({ visible, onClose, onConfirm, cancelReason, setCancelReason, loading, colorScheme }) => (
  <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
    <View style={[styles.modalOverlay, colorScheme === 'dark' ? styles.modalOverlayDark : styles.modalOverlayLight]}>
      <View style={[styles.modalContainer, colorScheme === 'dark' ? styles.modalContainerDark : styles.modalContainerLight]}>
        <View style={[styles.modalHeader, colorScheme === 'dark' ? styles.modalHeaderDark : styles.modalHeaderLight]}>
          <Text style={[styles.modalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Cancel Order</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="close" size={24} color={colorScheme === 'dark' ? "#888" : "#666"} />
          </TouchableOpacity>
        </View>

        <View style={styles.cancelReasonContainer}>
          <Text style={[styles.cancelReasonTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Please tell us why you want to cancel this order</Text>

          <TextInput
            style={[styles.cancelReasonInput, colorScheme === 'dark' ? styles.cancelReasonInputDark : styles.cancelReasonInputLight]}
            placeholder="Enter reason for cancellation"
            placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
            value={cancelReason}
            onChangeText={setCancelReason}
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={styles.cancelReasonOptions}>
            {["Changed my mind", "Ordered by mistake", "Duplicate order"].map((reason, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.cancelReasonOption, colorScheme === 'dark' ? styles.cancelReasonOptionDark : styles.cancelReasonOptionLight]}
                onPress={() => setCancelReason(reason)}
              >
                <Text style={[styles.cancelReasonOptionText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{reason}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.modalFooter, colorScheme === 'dark' ? styles.modalFooterDark : styles.modalFooterLight]}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelOrderButton, colorScheme === 'dark' ? styles.cancelOrderButtonDark : styles.cancelOrderButtonLight]}
            onPress={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFD700" />
            ) : (
              <Text style={styles.modalButtonText}>Confirm Cancellation</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Empty state component
const EmptyState = ({ onOrderNow, colorScheme }) => (
  <View style={[styles.emptyState, colorScheme === 'dark' ? styles.emptyStateDark : styles.emptyStateLight]}>
    <Icon name="receipt-long" size={80} color={colorScheme === 'dark' ? "#888" : "#999"} />
    <Text style={[styles.emptyStateTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No orders yet</Text>
    <Text style={[styles.emptyStateText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Your order history will appear here</Text>
    <TouchableOpacity style={[styles.shopNowButton, colorScheme === 'dark' ? styles.shopNowButtonDark : styles.shopNowButtonLight]} onPress={onOrderNow}>
      <Text style={styles.shopNowButtonText}>Order Now</Text>
    </TouchableOpacity>
  </View>
);

const MyOrders = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [userId, setUserId] = useState(null);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  // Listen for system color scheme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Fetch user ID from AsyncStorage
  useEffect(() => {
    const getUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId");
        if (storedUserId) {
          setUserId(storedUserId);
        } else {
          Toast.show({
            type: "error",
            text1: "Authentication Error",
            text2: "Please log in to view your orders",
            position: "top",
            visibilityTime: 3000,
          });
          navigation.navigate("Login");
        }
      } catch (error) {
        console.error("Error getting user ID:", error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to load user data",
          position: "top",
          visibilityTime: 3000,
        });
      }
    };
    getUserId();
  }, []);

  // Fetch orders when userId is available
  useEffect(() => {
    if (userId) {
      fetchOrders();
    }
  }, [userId]);

  // Handle new order from CheckOut
  useEffect(() => {
    if (route.params?.newOrder) {
      setOrders((prevOrders) => [route.params.newOrder, ...prevOrders]);
      Toast.show({
        type: "success",
        text1: "Order Placed Successfully",
        text2: `Order #${route.params.newOrder.orderNumber.slice(-6)} has been placed`,
        position: "top",
        visibilityTime: 4000,
      });
    }
  }, [route.params?.newOrder]);

  // Fetch orders from backend
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://hotelvirat.com/api/v1/hotel/order/user/${userId}`);
      const data = await response.json();
      if (response.ok) {
        setOrders(data);
      } else {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: data.message || "Failed to fetch orders",
          position: "top",
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to fetch orders",
        position: "top",
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Refresh orders
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
    Toast.show({
      type: "info",
      text1: "Orders Refreshed",
      position: "top",
      visibilityTime: 2000,
    });
  };

  // Check if order can be cancelled (within 15 minutes)
  const canCancelOrder = (order) => {
    if (!order || !order.createdAt) return false;
    const orderDate = new Date(order.createdAt);
    const currentDate = new Date();
    const diffInMinutes = (currentDate - orderDate) / (1000 * 60);
    return diffInMinutes <= 15;
  };

  // Initiate order cancellation
  const initiateOrderCancel = (order) => {
    if (!canCancelOrder(order)) {
      Alert.alert("Cannot Cancel Order", "Orders can only be cancelled within 15 minutes of placement.", [
        { text: "OK" },
      ]);
      return;
    }
    setOrderToCancel(order);
    setShowCancelModal(true);
  };

  // Handle order cancellation
  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    if (!cancelReason.trim()) {
      Alert.alert("Cancellation Reason Required", "Please provide a reason for cancellation.", [
        { text: "OK" },
      ]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`https://hotelvirat.com/api/v1/hotel/order/${orderToCancel._id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "cancelled",
          cancellationReason: cancelReason,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setOrders((prevOrders) =>
          prevOrders.map((o) =>
            o._id === orderToCancel._id
              ? {
                  ...o,
                  status: "cancelled",
                  cancellationReason: cancelReason,
                  deliverySteps: [
                    ...o.deliverySteps,
                    { status: "Cancelled", time: new Date().toISOString(), completed: true },
                  ],
                }
              : o
          )
        );
        Toast.show({
          type: "success",
          text1: "Order Cancelled",
          text2: `Order #${orderToCancel.orderNumber.slice(-6)} has been cancelled`,
          position: "top",
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: data.message || "Failed to cancel order",
          position: "top",
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error("Error cancelling order:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to cancel order",
        position: "top",
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setShowCancelModal(false);
      setCancelReason("");
      setOrderToCancel(null);
      setSelectedOrder(null);
    }
  };

  // Get delivery steps for tracking
  const getDeliverySteps = (order) => {
    return order.deliverySteps || [{ status: "Order Placed", time: order.createdAt, completed: true }];
  };

  // Close cancel modal
  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelReason("");
    setOrderToCancel(null);
  };

  if (loading && orders.length === 0) {
    return (
      <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <StatusBar backgroundColor={colorScheme === 'dark' ? "#1a1a1a" : "#fff"} barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />
        <View style={[styles.loadingContainer, colorScheme === 'dark' ? styles.loadingContainerDark : styles.loadingContainerLight]}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={[styles.loadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar backgroundColor={colorScheme === 'dark' ? "#1a1a1a" : "#fff"} barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />

      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <TouchableOpacity
          onPress={() => navigation.navigate("Tabs", { screen: "Home" })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-back" size={24} color={colorScheme === 'dark' ? "#e5e5e5" : "#333"} />
        </TouchableOpacity>
        <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>My Orders</Text>
        <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="refresh" size={24} color={colorScheme === 'dark' ? "#e5e5e5" : "#333"} />
        </TouchableOpacity>
      </View>

      {orders.length === 0 ? (
        <EmptyState onOrderNow={() => navigation.navigate("Tabs", { screen: "Home" })} colorScheme={colorScheme} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => (
            <OrderItem
              item={item}
              onPress={() => setSelectedOrder(item)}
              onCancelPress={initiateOrderCancel}
              canCancelOrder={canCancelOrder}
              isLastItem={index === orders.length - 1}
              colorScheme={colorScheme}
            />
          )}
          contentContainerStyle={styles.orderList}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListFooterComponent={<View />}
          ListFooterComponentStyle={styles.listFooter}
        />
      )}

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onCancelPress={initiateOrderCancel}
        canCancelOrder={canCancelOrder}
        loading={loading}
        getDeliverySteps={getDeliverySteps}
        colorScheme={colorScheme}
      />

      <CancelReasonModal
        visible={showCancelModal}
        onClose={closeCancelModal}
        onConfirm={handleCancelOrder}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        loading={loading}
        colorScheme={colorScheme}
      />

      <Toast />
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
  headerText: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyStateLight: {
    backgroundColor: "#f8f9fa",
  },
  emptyStateDark: {
    backgroundColor: "#1a1a1a",
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    marginBottom: 30,
  },
  shopNowButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
   /*  elevation: 5, */
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  shopNowButtonLight: {
    backgroundColor: "#800000",
  },
  shopNowButtonDark: {
    backgroundColor: "#4a0000",
  },
  shopNowButtonText: {
    color: "#FFD700",
    fontWeight: "600",
    fontSize: 16,
  },
  orderList: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 0,
  },
  orderCard: {
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    borderWidth: 1,
  /*   elevation: 3, */
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  orderCardLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  orderCardDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  lastOrderCard: {
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  listFooter: {
    height: 0,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderId: {
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  orderDetails: {
    marginBottom: 12,
  },
  orderInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  orderIcon: {
    marginRight: 10,
  },
  orderInfoText: {
    fontSize: 14,
  },
  orderItemsPreview: {
    paddingTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  orderItemsPreviewLight: {
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
  },
  orderItemsPreviewDark: {
    borderTopColor: "#444",
    borderTopWidth: 1,
  },
  orderItemPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 8,
  },
  orderItemImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 6,
  },
  orderItemName: {
    fontSize: 14,
  },
  orderMoreItems: {
    fontSize: 14,
    color: "#FFD700",
    fontWeight: "600",
  },
  orderActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
  },
  orderActionsLight: {
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
  },
  orderActionsDark: {
    borderTopColor: "#444",
    borderTopWidth: 1,
  },
  orderActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 10,
  },
  orderActionButtonLight: {
    borderColor: "#e5e7eb",
  },
  orderActionButtonDark: {
    borderColor: "#444",
  },
  orderActionText: {
    fontSize: 14,
    marginLeft: 4,
  },
  cancelButton: {
    backgroundColor: "#fff7ed",
  },
  cancelButtonLight: {
    borderColor: "#FF3333",
  },
  cancelButtonDark: {
    borderColor: "#FF3333",
    backgroundColor: "#4a0000",
  },
  cancelText: {
    color: "#FF3333",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlayLight: {
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalOverlayDark: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "90%",
 /*    elevation: 5, */
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
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
  modalHeaderLight: {
    borderBottomColor: "#e5e7eb",
  },
  modalHeaderDark: {
    borderBottomColor: "#444",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalSection: {
    padding: 16,
    borderBottomWidth: 1,
  },
  modalSectionLight: {
    borderBottomColor: "#e5e7eb",
  },
  modalSectionDark: {
    borderBottomColor: "#444",
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  trackingContainer: {
    marginLeft: 8,
  },
  trackingStep: {
    flexDirection: "row",
    marginBottom: 16,
  },
  trackingStepLeft: {
    alignItems: "center",
    marginRight: 12,
  },
  trackingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    zIndex: 1,
  },
  trackingDotCompleted: {
    backgroundColor: "#4BB543",
    borderColor: "#4BB543",
  },
  trackingDotPending: {
    borderColor: "#999",
  },
  trackingDotPendingLight: {
    backgroundColor: "#fff",
  },
  trackingDotPendingDark: {
    backgroundColor: "#2a2a2a",
  },
  trackingDotCancelled: {
    backgroundColor: "#FF3333",
    borderColor: "#FF3333",
  },
  trackingLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -8,
  },
  trackingLineCompleted: {
    backgroundColor: "#4BB543",
  },
  trackingLinePending: {
    backgroundColor: "#999",
  },
  trackingStepContent: {
    flex: 1,
  },
  trackingStepTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  trackingStepTime: {
    fontSize: 12,
  },
  cancellationReason: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  cancellationReasonLight: {
    backgroundColor: "#fff7ed",
  },
  cancellationReasonDark: {
    backgroundColor: "#4a0000",
  },
  cancellationReasonTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF3333",
    marginBottom: 4,
  },
  cancellationReasonText: {
    fontSize: 14,
  },
  orderItemsContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  orderItemsContainerLight: {
    borderColor: "#e5e7eb",
  },
  orderItemsContainerDark: {
    borderColor: "#444",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  modalItemLight: {
    borderBottomColor: "#e5e7eb",
  },
  modalItemDark: {
    borderBottomColor: "#444",
  },
  modalItemImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  modalItemDetails: {
    flex: 1,
  },
  modalItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modalItemName: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalItemPrice: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFD700",
  },
  modalItemQuantity: {
    fontSize: 14,
  },
  restaurantDetails: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  restaurantIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  restaurantAddress: {
    fontSize: 14,
    lineHeight: 20,
  },
  deliveryOption: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  deliveryIcon: {
    marginRight: 12,
  },
  deliveryOptionText: {
    fontSize: 15,
  },
  addressContainer: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
  },
  addressContainerLight: {
    backgroundColor: "#fff7ed",
  },
  addressContainerDark: {
    backgroundColor: "#4a0000",
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  paymentIcon: {
    marginRight: 12,
  },
  paymentMethodText: {
    fontSize: 15,
  },
  cardDetails: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
  },
  cardDetailsLight: {
    backgroundColor: "#fff7ed",
  },
  cardDetailsDark: {
    backgroundColor: "#4a0000",
  },
  cardType: {
    fontSize: 14,
  },
  contactInfo: {
    marginTop: 8,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  contactIcon: {
    marginRight: 12,
  },
  contactText: {
    fontSize: 15,
  },
  priceDetails: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  priceDetailsLight: {
    borderColor: "#e5e7eb",
  },
  priceDetailsDark: {
    borderColor: "#444",
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
  discountRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  couponBadge: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  couponBadgeText: {
    fontSize: 12,
    color: "#4BB543",
    fontWeight: "600",
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: "700",
    color: "#FFD700",
  },
  instructionsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 8,
  },
  instructionsContainerLight: {
    backgroundColor: "#fff7ed",
  },
  instructionsContainerDark: {
    backgroundColor: "#4a0000",
  },
  instructionsIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
   /*  elevation: 4, */
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  modalFooterLight: {
    borderTopColor: "#e5e7eb",
  },
  modalFooterDark: {
    borderTopColor: "#444",
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelOrderButton: {
  },
  cancelOrderButtonLight: {
    backgroundColor: "#800000",
  },
  cancelOrderButtonDark: {
    backgroundColor: "#4a0000",
  },
  modalButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelReasonContainer: {
    padding: 16,
  },
  cancelReasonTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  cancelReasonInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
  },
  cancelReasonInputLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    color: "#333",
  },
  cancelReasonInputDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
    color: "#e5e5e5",
  },
  cancelReasonOptions: {
    marginTop: 8,
  },
  cancelReasonOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  cancelReasonOptionLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  cancelReasonOptionDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  cancelReasonOptionText: {
    fontSize: 14,
  },
});

export default MyOrders;
