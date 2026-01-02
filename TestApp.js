import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const TestApp = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎉 App is Working!</Text>
      <Text style={styles.subtitle}>Network connectivity test successful</Text>
      
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Test Button</Text>
      </TouchableOpacity>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>✅ Metro Server: Connected</Text>
        <Text style={styles.statusText}>✅ App Loading: Fixed</Text>
        <Text style={styles.statusText}>✅ Backend: https://hotelvirat.com</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#800000',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#800000',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 30,
  },
  buttonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    alignItems: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
});

export default TestApp;