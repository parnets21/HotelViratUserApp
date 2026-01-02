import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import testNetworkConnectivity from '../../network-test';

const NetworkDebug = () => {
  const [logs, setLogs] = useState([]);
  const [testing, setTesting] = useState(false);

  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runNetworkTest = async () => {
    setTesting(true);
    setLogs([]);
    
    addLog('🔍 Starting network connectivity test...');
    
    try {
      const result = await testNetworkConnectivity();
      if (result) {
        addLog(`✅ Network test completed successfully with: ${result}`);
      } else {
        addLog('❌ All network endpoints failed');
      }
    } catch (error) {
      addLog(`❌ Network test error: ${error.message}`);
    }
    
    setTesting(false);
  };

  const testSpecificEndpoint = async (endpoint) => {
    addLog(`📡 Testing specific endpoint: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        addLog(`✅ SUCCESS: ${endpoint} - Status: ${response.status}, Data: ${JSON.stringify(data).substring(0, 100)}...`);
      } else {
        addLog(`❌ FAILED: ${endpoint} - Status: ${response.status}`);
      }
    } catch (error) {
      addLog(`❌ ERROR: ${endpoint} - ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Debug Screen</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, testing && styles.buttonDisabled]} 
          onPress={runNetworkTest}
          disabled={testing}
        >
          <Text style={styles.buttonText}>
            {testing ? 'Testing...' : 'Run Full Network Test'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => testSpecificEndpoint('https://hotelvirat.com/api/v1/hotel/category')}
        >
          <Text style={styles.buttonText}>Test Local Backend</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => testSpecificEndpoint('https://hotelvirat.com/api/v1/hotel/category')}
        >
          <Text style={styles.buttonText}>Test Localhost</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => testSpecificEndpoint('https://hotelvirat.com/api/v1/hotel/category')}
        >
          <Text style={styles.buttonText}>Test Production</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.clearButton]} 
          onPress={() => setLogs([])}
        >
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.logsContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#800000',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#800000',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  clearButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#000',
    padding: 10,
    borderRadius: 8,
  },
  logText: {
    color: '#00ff00',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});

export default NetworkDebug;