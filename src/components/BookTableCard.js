import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const BookTableCard = ({ branchId }) => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableTablesCount, setAvailableTablesCount] = useState(0);
  const navigation = useNavigation();

  useEffect(() => {
    // Fetch tables when component loads
    fetchTables();
  }, [branchId]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch tables directly from admin panel backend
      const response = await fetch('https://hotelvirat.com/api/v1/hotel/table');
      
      const data = await response.json();
      
      if (response.ok && data) {
        const tablesArray = Array.isArray(data) ? data : [];
        setTables(tablesArray);
        
        // Count all tables as available since availability is determined by time slots
        const available = tablesArray.length;
        setAvailableTablesCount(available);
        
        console.log('✅ Tables fetched for BookTableCard:', tablesArray);
        console.log('✅ Available tables count:', available);
      } else {
        setError('No tables found');
        setTables([]);
        setAvailableTablesCount(0);
      }
    } catch (error) {
      console.error('❌ Error fetching tables:', error);
      setError('Failed to load tables');
      setTables([]);
      setAvailableTablesCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleBookTableClick = () => {
    if (tables.length === 0) {
      Alert.alert(
        'No Tables Available',
        'Sorry, no tables are currently available for booking.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Navigate to table booking screen with tables data and branch info
    navigation.navigate('TableBooking', {
      tables: tables,
      branchId: branchId, // Pass the actual branch ID
      availableCount: availableTablesCount
    });
  };

  if (loading) {
    // Don't show loading if no branch is selected yet
    if (branchId === null || branchId === undefined) {
      return null;
    }
    
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#800000" />
        <Text style={styles.loadingText}>Loading table availability...</Text>
      </View>
    );
  }

  if (error) {
    // Don't show error if no branch is selected yet
    if (branchId === null || branchId === undefined) {
      return null;
    }
    
    return (
      <View style={styles.errorContainer}>
        <Icon name="table-restaurant" size={48} color="#ccc" />
        <Text style={styles.errorText}>
          {error}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchTables}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handleBookTableClick}>
      <View style={styles.banner}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Icon name="table-restaurant" size={20} color="#FFD700" />
            <Text style={styles.title}>Book a Table</Text>
            <Icon name="table-restaurant" size={20} color="#FFD700" />
          </View>
          <Text style={styles.subtitle}>Reserve your dining experience</Text>
        </View>

        <View style={styles.bannerContent}>
          <View style={styles.iconContainer}>
            <View style={styles.tableIconWrapper}>
              <Icon name="table-restaurant" size={40} color="#800000" />
            </View>
            <View style={styles.availableBadge}>
              <Text style={styles.availableText}>AVAILABLE</Text>
            </View>
          </View>

          <View style={styles.content}>
            <Text style={styles.tableTitle}>Reserve Your Table</Text>
            <Text style={styles.description} numberOfLines={2}>
              Book a table for your perfect dining experience at Hotel Virat
            </Text>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{tables.length}</Text>
                <Text style={styles.statLabel}>Total Tables</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{availableTablesCount}</Text>
                <Text style={styles.statLabel}>Available Now</Text>
              </View>
            </View>

            <View style={styles.clickHint}>
              <Text style={styles.clickText}>Tap to book now</Text>
              <Icon name="arrow-forward" size={16} color="#800000" />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    paddingHorizontal: 15,
  },
  banner: {
    backgroundColor: 'white',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    padding: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    margin: 15,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#800000',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 15,
    paddingTop: 15,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#800000',
    marginHorizontal: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  iconContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  availableBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  description: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#800000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#ddd',
    marginHorizontal: 15,
  },
  clickHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  clickText: {
    fontSize: 12,
    color: '#800000',
    marginRight: 5,
    fontStyle: 'italic',
  },
});

export default BookTableCard;