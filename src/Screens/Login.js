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
  Animated,
  Image,
  ActivityIndicator,
  Appearance,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const Toast = ({ message, type }) => {
  return (
    <View style={[styles.toastContainer, type === 'error' ? styles.errorToast : styles.successToast]}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
};

const Login = () => {
  const navigation = useNavigation();
  const { login } = useAuth();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [toast, setToast] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const showToast = (message, type = 'success', isOtp = false) => {
    setToast({ message, type });
    const displayDuration = isOtp ? 30000 : 2000;
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    const hideTimer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToast(null);
      });
    }, displayDuration);
    
    return () => clearTimeout(hideTimer);
  };

  const startResendTimer = () => {
    setResendDisabled(true);
    setResendTimer(30);
  };

  useEffect(() => {
    let timer;
    if (resendDisabled && resendTimer > 0) {
      timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setResendDisabled(false);
    }
    return () => clearTimeout(timer);
  }, [resendDisabled, resendTimer]);

  const handleSendOtp = async () => {
    if (mobile.length !== 10) {
      showToast("Please enter a valid 10-digit mobile number", 'error');
      return;
    }

    setIsSendingOtp(true);
    try {
      const response = await fetch('http://192.168.1.24:9000/api/v1/hotel/user-auth/login/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile }),
      });

      const data = await response.json();
      if (response.ok) {
        setOtpSent(true);
        startResendTimer();
        showToast("OTP sent to your mobile number");
        setTimeout(() => {
          showToast(`Your OTP is ${data.otp}`, 'success', true);
        }, 3000);
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast("Error sending OTP", 'error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setIsSendingOtp(true);
    try {
      const response = await fetch('http://192.168.1.24:9000/api/v1/hotel/user-auth/login/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile }),
      });

      const data = await response.json();
      if (response.ok) {
        startResendTimer();
        showToast("OTP resent to your mobile number");
        setTimeout(() => {
          showToast(`Your new OTP is ${data.otp}`, 'success', true);
        }, 3000);
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast("Error resending OTP", 'error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const response = await fetch('http://192.168.1.24:9000/api/v1/hotel/user-auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile, otp }),
      });

      const data = await response.json();
      if (response.ok) {
        await AsyncStorage.setItem('userId', data.user._id);
        console.log('User ID:', data.user._id);
        showToast("Login successful!");
        login();
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast("Error verifying OTP", 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}
    >
      {toast && (
        <Animated.View style={[styles.toastWrapper, { opacity: fadeAnim }]}>
          <Toast message={toast.message} type={toast.type} />
        </Animated.View>
      )}
      
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/logo4.jpeg')} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Welcome Back</Text>
          <Text style={[styles.subtitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Login to continue</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Mobile Number</Text>
          <View style={[styles.inputContainer, colorScheme === 'dark' ? styles.inputContainerDark : styles.inputContainerLight]}>
            <TextInput
              style={[styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
              placeholder="Enter 10 digit number"
              placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
              keyboardType="phone-pad"
              maxLength={10}
              value={mobile}
              onChangeText={setMobile}
              editable={!otpSent}
            />
          </View>

          {otpSent && (
            <>
              <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>OTP</Text>
              <View style={[styles.inputContainer, colorScheme === 'dark' ? styles.inputContainerDark : styles.inputContainerLight]}>
                <TextInput
                  style={[styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
                  placeholder="Enter 6 digit OTP"
                  placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
                  keyboardType="numeric"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />
              </View>
              <TouchableOpacity
                style={[styles.resendButton, resendDisabled && styles.resendDisabled]}
                onPress={handleResendOtp}
                disabled={resendDisabled || isSendingOtp}
              >
                <Text style={[styles.resendButtonText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                  {resendDisabled ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                </Text>
                {isSendingOtp && <ActivityIndicator size="small" color={colorScheme === 'dark' ? "#FFD700" : "#FFD700"} style={styles.buttonLoader} />}
              </TouchableOpacity>
            </>
          )}

          {!otpSent ? (
            <TouchableOpacity 
              style={[styles.primaryButton, isSendingOtp && styles.disabledButton, colorScheme === 'dark' ? styles.primaryButtonDark : styles.primaryButtonLight]} 
              onPress={handleSendOtp}
              disabled={isSendingOtp}
            >
              {isSendingOtp ? (
                <ActivityIndicator size="small" color={colorScheme === 'dark' ? "#FFD700" : "#FFD700"} />
              ) : (
                <Text style={styles.primaryButtonText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.primaryButton, isLoggingIn && styles.disabledButton, colorScheme === 'dark' ? styles.primaryButtonDark : styles.primaryButtonLight]} 
              onPress={handleLogin}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <ActivityIndicator size="small" color={colorScheme === 'dark' ? "#FFD700" : "#FFD700"} />
              ) : (
                <Text style={styles.primaryButtonText}>Login</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, colorScheme === 'dark' ? styles.dividerLineDark : styles.dividerLineLight]} />
            <Text style={[styles.dividerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>or</Text>
            <View style={[styles.dividerLine, colorScheme === 'dark' ? styles.dividerLineDark : styles.dividerLineLight]} />
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, colorScheme === 'dark' ? styles.secondaryButtonDark : styles.secondaryButtonLight]}
            onPress={() => navigation.navigate("Registration")}
          >
            <Text style={styles.secondaryButtonText}>Create New Account</Text>
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
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 200,
  },
  header: {
    alignItems: "center",
    paddingBottom: 30,
    paddingTop: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  textLight: {
    color: "#333",
  },
  textDark: {
    color: "#e5e5e5",
  },
  formContainer: {
    paddingBottom: 30,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 10,
  },
  inputContainer: {
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  /*   elevation: 3, */
  },
  inputContainerLight: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  inputContainerDark: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#444",
  },
  input: {
    width: "100%",
    height: 50,
    paddingHorizontal: 20,
    fontSize: 16,
    borderRadius: 12,
  },
  inputLight: {
    color: "#333",
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  inputDark: {
    color: "#e5e5e5",
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  primaryButton: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  /*   elevation: 5, */
  },
  primaryButtonLight: {
    backgroundColor: "#800000",
    shadowColor: "#800000",
  },
  primaryButtonDark: {
    backgroundColor: "#4a0000",
    shadowColor: "#4a0000",
  },
  primaryButtonText: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryButton: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
   /*  elevation: 5, */
  },
  secondaryButtonLight: {
    backgroundColor: "#800000",
    borderWidth: 1,
    borderColor: "#800000",
    shadowColor: "#800000",
  },
  secondaryButtonDark: {
    backgroundColor: "#4a0000",
    borderWidth: 1,
    borderColor: "#4a0000",
    shadowColor: "#4a0000",
  },
  secondaryButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLineLight: {
    backgroundColor: "#e5e7eb",
  },
  dividerLineDark: {
    backgroundColor: "#444",
  },
  dividerText: {
    width: 40,
    textAlign: "center",
    fontSize: 14,
  },
  toastWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  toastContainer: {
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
   /*  elevation: 5, */
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successToast: {
    backgroundColor: '#4BB543',
  },
  errorToast: {
    backgroundColor: '#FF3333',
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  resendButton: {
    alignSelf: 'flex-end',
    marginTop: -10,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendDisabled: {
    opacity: 0.5,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonLoader: {
    marginLeft: 10,
  },
});

export default Login;