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

const Toast = ({ message, type }) => {
  return (
    <View style={[styles.toastContainer, type === 'error' ? styles.errorToast : styles.successToast]}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
};

const Registration = () => {
  const navigation = useNavigation();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [toast, setToast] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
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
    
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(displayDuration),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() =>  {
      setToast(null);
    });
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
    if (!name.trim()) {
      showToast("Please enter your name", 'error');
      return;
    }
    if (mobile.length !== 10) {
      showToast("Please enter a valid 10-digit mobile number", 'error');
      return;
    }

    setIsSendingOtp(true);
    try {
      const response = await fetch('http://192.168.1.24:9000/api/v1/hotel/user-auth/register/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, mobile }),
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
      const response = await fetch('http://192.168.1.24:9000/api/v1/hotel/user-auth/register/resend-otp', {
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

  const handleRegister = async () => {
    setIsRegistering(true);
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
        showToast("Registration successful!");
        setTimeout(() => {
          navigation.navigate("Login");
        }, 2000);
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast("Error verifying OTP", 'error');
    } finally {
      setIsRegistering(false);
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
          <Text style={[styles.title, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Register</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={[styles.inputLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Full Name</Text>
          <View style={[styles.inputContainer, colorScheme === 'dark' ? styles.inputContainerDark : styles.inputContainerLight]}>
            <TextInput
              style={[styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
              placeholder="Enter your full name"
              placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
              value={name}
              onChangeText={setName}
              editable={!otpSent}
            />
          </View>

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
              style={[styles.primaryButton, isRegistering && styles.disabledButton, colorScheme === 'dark' ? styles.primaryButtonDark : styles.primaryButtonLight]} 
              onPress={handleRegister}
              disabled={isRegistering}
            >
              {isRegistering ? (
                <ActivityIndicator size="small" color={colorScheme === 'dark' ? "#FFD700" : "#FFD700"} />
              ) : (
                <Text style={styles.primaryButtonText}>Register</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={[styles.loginText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Already have an account? Login</Text>
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
   /*  elevation: 5, */
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
  loginLink: {
    marginTop: 20,
    alignSelf: "center",
  },
  loginText: {
    fontSize: 16,
    fontWeight: "500",
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
    fontWeight: "600",
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

export default Registration;