import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../src/contexts/AuthContext';

type MessageType = 'error' | 'success' | 'info';

interface Message {
  type: MessageType;
  text: string;
}

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const { signUp } = useAuthContext();

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Please enter your name' });
      return false;
    }
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email' });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return false;
    }
    if (!password) {
      setMessage({ type: 'error', text: 'Please enter a password' });
      return false;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return false;
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    setMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { data: session, error: signUpError } = await signUp(
        email.trim(),
        password,
        name.trim()
      );

      if (signUpError) {
        // Handle specific error messages
        if (signUpError.message.includes('already registered') ||
            signUpError.message.includes('already been registered')) {
          setMessage({
            type: 'error',
            text: 'An account with this email already exists. Please sign in instead.'
          });
        } else if (signUpError.message.includes('valid email')) {
          setMessage({ type: 'error', text: 'Please enter a valid email address' });
        } else if (signUpError.message.includes('password')) {
          setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
        } else {
          setMessage({ type: 'error', text: signUpError.message });
        }
        return;
      }

      // Check if session exists (auto-confirmed) or not (email confirmation required)
      if (session) {
        // User is auto-confirmed and logged in
        setMessage({
          type: 'success',
          text: 'Account created successfully! Redirecting...'
        });
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1500);
      } else {
        // Email confirmation is required
        setRegistrationComplete(true);
        setMessage({
          type: 'success',
          text: 'Account created! Please check your email to verify your account.'
        });
      }
    } catch (err) {
      console.error('Registration error:', err);
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const getMessageStyle = (type: MessageType) => {
    switch (type) {
      case 'error':
        return { bg: '#FFEBEE', color: '#F44336', icon: 'alert-circle' as const };
      case 'success':
        return { bg: '#E8F5E9', color: '#4CAF50', icon: 'checkmark-circle' as const };
      case 'info':
        return { bg: '#E3F2FD', color: '#2196F3', icon: 'information-circle' as const };
    }
  };

  // Show success state after registration
  if (registrationComplete) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons name="mail" size={64} color="#4CAF50" />
          </View>
          <Text style={styles.successTitle}>Check Your Email</Text>
          <Text style={styles.successText}>
            We've sent a verification link to:
          </Text>
          <Text style={styles.emailText}>{email}</Text>
          <Text style={styles.successHint}>
            Click the link in the email to verify your account, then come back here to sign in.
          </Text>

          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.signInButtonText}>Go to Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={() => {
              setMessage({
                type: 'info',
                text: 'If you don\'t see the email, check your spam folder.'
              });
            }}
          >
            <Text style={styles.resendButtonText}>Didn't receive the email?</Text>
          </TouchableOpacity>

          {message && (
            <View style={[
              styles.messageContainer,
              { backgroundColor: getMessageStyle(message.type).bg }
            ]}>
              <Ionicons
                name={getMessageStyle(message.type).icon}
                size={20}
                color={getMessageStyle(message.type).color}
              />
              <Text style={[
                styles.messageText,
                { color: getMessageStyle(message.type).color }
              ]}>
                {message.text}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="heart" size={48} color="#FF6B6B" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start your tutoring journey</Text>
          </View>

          {message && (
            <View style={[
              styles.messageContainer,
              { backgroundColor: getMessageStyle(message.type).bg }
            ]}>
              <Ionicons
                name={getMessageStyle(message.type).icon}
                size={20}
                color={getMessageStyle(message.type).color}
              />
              <Text style={[
                styles.messageText,
                { color: getMessageStyle(message.type).color }
              ]}>
                {message.text}
              </Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#999"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setMessage(null);
                }}
                autoCapitalize="words"
                autoComplete="name"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setMessage(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                disabled={isLoading}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setMessage(null);
                }}
                secureTextEntry={!showConfirmPassword}
                autoComplete="new-password"
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                disabled={isLoading}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordHint}>
              Password must be at least 6 characters
            </Text>

            <TouchableOpacity
              style={[
                styles.registerButton,
                isLoading && styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity disabled={isLoading}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 4,
  },
  passwordHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 24,
    marginTop: -8,
  },
  registerButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  registerButtonDisabled: {
    backgroundColor: '#FFAAA8',
    shadowOpacity: 0.1,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  // Success state styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 16,
  },
  successHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  signInButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resendButton: {
    padding: 12,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
  },
});
