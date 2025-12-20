import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Appearance,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from "react-native-vector-icons/MaterialIcons";
import { launchImageLibrary } from 'react-native-image-picker';

const EditProfile = ({ route }) => {
  const navigation = useNavigation();
  const { userData } = route.params;
  const [name, setName] = useState(userData.name);
  const [email, setEmail] = useState(userData.email === 'Not provided' ? '' : userData.email);
  const [image, setImage] = useState(userData.profileImage);
  const [isLoading, setIsLoading] = useState(false);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  // Listen for system color scheme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const BASE_URL = 'http://192.168.1.24:9000/api/v1/hotel';

  const showToast = (message, type = 'error') => {
    if (Platform.OS === "android") {
      ToastAndroid.showWithGravity(
        message,
        ToastAndroid.LONG,
        ToastAndroid.BOTTOM
      );
    } else {
      Alert.alert(type === 'error' ? 'Error' : 'Success', message);
    }
  };

  const selectImage = async () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
    };

    try {
      const response = await launchImageLibrary(options);
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        showToast(`Error selecting image: ${response.errorMessage}`, 'error');
      } else if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        setImage({
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'profile.jpg',
        });
      }
    } catch (error) {
      showToast('Error selecting image', 'error');
    }
  };

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email.trim() || '');

      if (image && image.uri && !image.uri.startsWith(BASE_URL)) {
        formData.append('image', {
          uri: image.uri,
          type: image.type || 'image/jpeg',
          name: image.name || 'profile.jpg',
        });
      }

      const response = await fetch(`${BASE_URL}/user-auth/${userId}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        showToast('Profile updated successfully', 'success');
        navigation.navigate('Tabs', { screen: 'Profile' });
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Error updating profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <View style={styles.imageContainer}>
            <TouchableOpacity onPress={selectImage}>
              <Image
                source={image}
                style={[styles.profileImage, colorScheme === 'dark' ? styles.profileImageDark : styles.profileImageLight]}
              />
              <View style={styles.imageEditIcon}>
                <Icon name="camera-alt" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Edit Profile</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Name</Text>
            <View style={[styles.inputContainer, colorScheme === 'dark' ? styles.inputContainerDark : styles.inputContainerLight]}>
              <Icon name="person" size={20} color={colorScheme === 'dark' ? "#888" : "#555"} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
                placeholder="Enter your name"
                placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Email (Optional)</Text>
            <View style={[styles.inputContainer, colorScheme === 'dark' ? styles.inputContainerDark : styles.inputContainerLight]}>
              <Icon name="email" size={20} color={colorScheme === 'dark' ? "#888" : "#555"} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
                placeholder="Enter your email"
                placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.disabledButton, colorScheme === 'dark' ? styles.primaryButtonDark : styles.primaryButtonLight]}
            onPress={handleUpdateProfile}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Update Profile</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, colorScheme === 'dark' ? styles.cancelButtonDark : styles.cancelButtonLight]}
            onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })}
          >
            <Text style={[styles.cancelButtonText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  formContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: 'center',
  },
  textLight: {
    color: "#333",
  },
  textDark: {
    color: "#e5e5e5",
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  profileImageLight: {
    borderColor: "#fff",
  },
  profileImageDark: {
    borderColor: "#2a2a2a",
  },
  imageEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#800000',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: "100%",
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  inputContainerLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  inputContainerDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  inputIcon: {
    marginLeft: 15,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 16,
  },
  inputLight: {
    color: "#333",
  },
  inputDark: {
    color: "#e5e5e5",
  },
  primaryButton: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  primaryButtonLight: {
    backgroundColor: "#800000",
  },
  primaryButtonDark: {
    backgroundColor: "#4a0000",
  },
  primaryButtonText: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.7,
  },
  cancelButton: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cancelButtonLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  cancelButtonDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});

export default EditProfile;