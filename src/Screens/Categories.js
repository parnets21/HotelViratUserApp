import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Image,
  ActivityIndicator,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import { useCart } from "../context/CartContext";
import { API_BASE_URL, IMAGE_BASE_URL } from "../config/api";

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

const Categories = ({ route }) => {
  const navigation = useNavigation();
  const { branchId, branchName, branchIndex } = route.params;
  const { getBranchCartCount } = useCart();
  
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Fetch categories and menu items for the selected branch
  useEffect(() => {
    const fetchData = async () => {
      if (!branchId) return;
      
      console.log("🍽️ Fetching categories for branch:", branchId, branchName);
      setLoading(true);
      setError(null);
      
      try {
        // Fetch categories filtered by branch
        const categoriesUrl = `${API_BASE_URL}/category?branchId=${branchId}`;
        console.log("📋 Categories URL:", categoriesUrl);
        const categoriesResponse = await fetch(categoriesUrl);
        
        if (!categoriesResponse.ok) {
          throw new Error(`Categories API failed: ${categoriesResponse.status}`);
        }
        
        const categoriesData = await categoriesResponse.json();
        console.log("✅ Categories fetched:", categoriesData.length);
        
        // Process categories data
        const processedCategories = categoriesData.map(category => {
          let imageUrl = null;
          if (category.image) {
            if (category.image.startsWith('http')) {
              imageUrl = category.image;
            } else {
              const cleanImagePath = category.image.startsWith('/') 
                ? category.image.substring(1) 
                : category.image;
              imageUrl = `${IMAGE_BASE_URL}/${cleanImagePath}`;
            }
          }
          
          return {
            id: category._id || category.id,
            name: category.name,
            image: imageUrl,
            description: category.description || ''
          };
        });
        
        // Fetch products for all categories
        console.log("🍽️ Fetching products from backend...");
        const productsResponse = await fetch(`${API_BASE_URL}/menu`);
        
        if (!productsResponse.ok) {
          throw new Error(`Products API failed: ${productsResponse.status}`);
        }
        
        const productsData = await productsResponse.json();
        const products = Array.isArray(productsData.data) ? productsData.data : 
                        Array.isArray(productsData) ? productsData : [];
        
        console.log(`✅ Total products fetched: ${products.length}`);
        
        // Group products by category
        const groupedMenuItems = {};
        processedCategories.forEach(category => {
          groupedMenuItems[category.id] = [];
        });
        
        products.forEach(product => {
          const categoryId = product.categoryId?._id || 
                           product.categoryId?.id || 
                           product.categoryId || 
                           product.category?._id || 
                           product.category?.id;
          
          if (categoryId && groupedMenuItems[categoryId]) {
            let imageUrl = null;
            if (product.image) {
              const cleanImagePath = product.image.startsWith('/') 
                ? product.image.substring(1) 
                : product.image;
              imageUrl = `${IMAGE_BASE_URL}/${cleanImagePath}`;
            }
            
            groupedMenuItems[categoryId].push({
              id: product._id || product.id,
              name: trimNumbersFromName(product.name || product.itemName),
              price: product.price || product.prices?.Large || Object.values(product.prices || {})[0] || 0,
              description: product.description || '',
              image: imageUrl,
              categoryId: categoryId,
              isVeg: product.isVeg !== false,
              isAvailable: product.isAvailable !== false,
            });
          }
        });
        
        console.log("📊 Menu items count per category:");
        Object.keys(groupedMenuItems).forEach(categoryId => {
          const category = processedCategories.find(cat => cat.id === categoryId);
          console.log(`  - ${category?.name || categoryId}: ${groupedMenuItems[categoryId].length} items`);
        });
        
        setCategories(processedCategories);
        setMenuItems(groupedMenuItems);
        setLoading(false);
        
      } catch (error) {
        console.error("❌ Error fetching data:", error);
        setError(`Failed to load categories: ${error.message}`);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [branchId]);

  // Navigate to product screen with selected category
  const handleCategoryPress = (categoryId, index) => {
    const categoryMenuItems = menuItems[categoryId] || [];
    
    navigation.navigate("Product", {
      initialCategory: index,
      categoryId: categoryId,
      categories: categories,
      branchId: branchId,
      menuItems: categoryMenuItems,
      allMenuItems: menuItems
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={[styles.loadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
          Loading categories...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
        <Icon name="error-outline" size={60} color="#FFD700" />
        <Text style={[styles.errorText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, colorScheme === 'dark' ? styles.retryButtonDark : styles.retryButtonLight]}
          onPress={() => {
            setError(null);
            setLoading(true);
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar 
        backgroundColor={colorScheme === 'dark' ? '#1a1a1a' : '#fff'} 
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} 
      />

      {/* Header */}
      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#800000" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            {branchName}
          </Text>
          <Text style={[styles.headerSubtext, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            Select a category
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => navigation.navigate("MyCart")}
        >
          <Icon name="shopping-cart" size={24} color="#fff" />
          {getBranchCartCount(branchIndex) > 0 && (
            <View style={[styles.cartBadge, colorScheme === 'dark' ? styles.cartBadgeDark : styles.cartBadgeLight]}>
              <Text style={styles.cartBadgeText}>{getBranchCartCount(branchIndex)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Categories Grid */}
      {categories.length > 0 ? (
        <FlatList
          data={categories}
          numColumns={2}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => handleCategoryPress(item.id, index)}
              activeOpacity={0.7}
            >
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={styles.categoryImage}
                />
              ) : (
                <View style={[styles.categoryImage, styles.categoryImagePlaceholder]}>
                  <Icon name="restaurant" size={50} color="#800000" />
                </View>
              )}
              <View style={styles.categoryOverlay}>
                <Text style={styles.categoryCardText}>{item.name}</Text>
                
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.categoriesContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="restaurant-menu" size={80} color="#ccc" />
          <Text style={[styles.emptyText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
            No categories available for this branch
          </Text>
        </View>
      )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  backButton: {
    padding: 5,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 15,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtext: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  cartButton: {
    backgroundColor: "#800000",
    padding: 10,
    borderRadius: 50,
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
  categoriesContainer: {
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  categoryCard: {
    flex: 1,
    margin: 5,
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  categoryImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  categoryImagePlaceholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default Categories;
