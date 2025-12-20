import { useState, useEffect } from "react";
import { ActivityIndicator, View, StyleSheet, Appearance } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Home from "./src/Screens/Home";
import MyCart from "./src/Screens/MyCart";
import Product from "./src/Screens/Product";
import CheckOut from "./src/Screens/CheckOut";
import { CartProvider } from "./src/context/CartContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import MyOrders from "./src/Screens/MyOrders";
import Profile from "./src/Screens/Profile";
import Login from "./src/Screens/Login";
import Registration from "./src/Screens/Registration";
import EditProfile from "./src/Screens/EditProfile";
import Subscription from "./src/Screens/Subscription";
import SubscriptionOrder from "./src/Screens/SubscriptionOrder";
import MySubscriptions from "./src/Screens/MySubscriptions";
import RoomBooking from "./src/Screens/RoomBooking";
import Ionicons from "react-native-vector-icons/Ionicons";
import PrivacyPolicy from "./src/Screens/PrivacyPolicy";
import TermsConditions from "./src/Screens/TermsConditions";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeScreen" component={Home} />
      <Stack.Screen name="Product" component={Product} />
      <Stack.Screen name="MyCart" component={MyCart} />
      <Stack.Screen name="Subscription" component={Subscription} />
      <Stack.Screen name="SubscriptionOrder" component={SubscriptionOrder} /> 
      <Stack.Screen
        name="CheckOut"
        component={CheckOut}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "RoomBooking") {
            iconName = focused ? "bed" : "bed-outline";
          } else if (route.name === "MyOrders") {
            iconName = focused ? "list" : "list-outline";
          } else if (route.name === "MySubscriptions") {
            iconName = focused ? "refresh" : "refresh-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#800000",
        tabBarInactiveTintColor: "gray",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Appearance.getColorScheme() === 'dark' ? '#2a2a2a' : '#fff',
          borderTopColor: Appearance.getColorScheme() === 'dark' ? '#444' : '#e5e7eb',
        },
      })}
    >
      <Tab.Screen name="Home" component={MainStackScreen} />
      <Tab.Screen name="RoomBooking" component={RoomBooking} options={{ title: "Rooms" }} />
      <Tab.Screen name="MyOrders" component={MyOrders} />
      <Tab.Screen name="MySubscriptions" component={MySubscriptions} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { isLoggedIn, login, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          login();
        }
      } catch (error) {
        console.error("Failed to check auth status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, [login]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  // Use DefaultTheme or DarkTheme based on system theme
  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <CartProvider>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isLoggedIn ? (
            <>
              <Stack.Screen
                name="Tabs"
                component={TabNavigator}
              />
              <Stack.Screen name="EditProfile" component={EditProfile} />
              <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
              <Stack.Screen name="TermsCondition" component={TermsConditions} />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Login"
                component={Login}
              />
              <Stack.Screen name="Registration" component={Registration} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </CartProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerLight: {
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
});