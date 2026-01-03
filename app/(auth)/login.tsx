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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const { signIn, resetPassword } = useAuthContext();

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

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email' });
      return false;
    }
    if (!password) {
      setMessage({ type: 'error', text: 'Please enter your password' });
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    setMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email.trim(), password);

      if (signInError) {
        // Handle specific error messages
        if (signInError.message.includes('Invalid login credentials')) {
          setMessage({ type: 'error', text: 'Invalid email or password. Please try again.' });
        } else if (signInError.message.includes('Email not confirmed')) {
          setMessage({
            type: 'info',
            text: 'Please verify your email before signing in. Check your inbox for the verification link.'
          });
        } else {
          setMessage({ type: 'error', text: signInError.message });
        }
        return;
      }

      // Success - show brief message then navigate
      setMessage({ type: 'success', text: 'Welcome back! Signing you in...' });
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    } catch (err) {
      console.error('Login error:', err);
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      setMessage({
        type: 'info',
        text: 'Please enter your email address first, then tap Forgot Password.'
      });
      return;
    }

    if (!emailRegex.test(email.trim())) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setIsResettingPassword(true);
    setMessage(null);

    try {
      const { error: resetError } = await resetPassword(email.trim());

      if (resetError) {
        setMessage({ type: 'error', text: resetError.message });
        return;
      }

      setMessage({
        type: 'success',
        text: `Password reset email sent to ${email.trim()}. Check your inbox for the reset link.`
      });
    } catch (err) {
      console.error('Password reset error:', err);
      setMessage({ type: 'error', text: 'Failed to send reset email. Please try again.' });
    } finally {
      setIsResettingPassword(false);
    }
  };

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
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="heart" size={48} color="#FF6B6B" />
            </View>
            <Text style={styles.title}>Love2Learn</Text>
            <Text style={styles.subtitle}>Welcome back!</Text>
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
                autoComplete="password"
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

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
              disabled={isLoading || isResettingPassword}
            >
              {isResettingPassword ? (
                <View style={styles.forgotPasswordLoading}>
                  <ActivityIndicator size="small" color="#FF6B6B" />
                  <Text style={styles.forgotPasswordText}>Sending...</Text>
                </View>
              ) : (
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity disabled={isLoading}>
                <Text style={styles.registerLink}>Sign Up</Text>
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
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
    fontSize: 32,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  loginButton: {
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
  loginButtonDisabled: {
    backgroundColor: '#FFAAA8',
    shadowOpacity: 0.1,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  registerLink: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
  },
});
