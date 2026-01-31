/**
 * Tutor Registration Screen
 * Love2Learn Tutoring App
 *
 * Registration screen specifically for tutors with business name field
 */

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
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme';

type MessageType = 'error' | 'success' | 'info';

interface Message {
  type: MessageType;
  text: string;
}

export default function RegisterTutorScreen() {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const getMessageStyle = (type: MessageType) => {
    switch (type) {
      case 'error':
        return { bg: colors.status.errorBg, color: colors.status.error, icon: 'alert-circle' as const };
      case 'success':
        return { bg: colors.status.successBg, color: colors.status.success, icon: 'checkmark-circle' as const };
      case 'info':
        return { bg: colors.status.infoBg, color: colors.status.info, icon: 'information-circle' as const };
    }
  };

  const validateForm = (): boolean => {
    if (!businessName.trim()) {
      setMessage({ type: 'error', text: 'Please enter your business name' });
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
    if (!agreedToTerms) {
      setMessage({ type: 'error', text: 'Please agree to the Terms of Service and Privacy Policy' });
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
      const normalizedEmail = email.trim().toLowerCase();

      // Calculate trial end date (14 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      // Sign up the user with tutor role metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name: businessName.trim(),
            role: 'tutor',
            business_name: businessName.trim(),
            trial_ends_at: trialEndsAt.toISOString(),
          },
        },
      });

      if (authError) {
        // Handle specific error messages
        if (authError.message.includes('already registered') ||
            authError.message.includes('already been registered')) {
          setMessage({
            type: 'error',
            text: 'An account with this email already exists. Please sign in instead.'
          });
        } else if (authError.message.includes('valid email')) {
          setMessage({ type: 'error', text: 'Please enter a valid email address' });
        } else if (authError.message.includes('password')) {
          setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
        } else {
          setMessage({ type: 'error', text: authError.message });
        }
        return;
      }

      if (!authData.user) {
        setMessage({
          type: 'error',
          text: 'User creation failed. Please try again.'
        });
        return;
      }

      // Check if session exists (auto-confirmed) or not (email confirmation required)
      if (authData.session) {
        // User is auto-confirmed and logged in - redirect to tutor onboarding
        setMessage({
          type: 'success',
          text: 'Account created successfully! Redirecting to setup...'
        });
        setTimeout(() => {
          router.replace('/(auth)/onboarding/tutor/business');
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

  const openTermsOfService = () => {
    // TODO: Replace with actual Terms of Service URL
    Linking.openURL('https://love2learn.com/terms');
  };

  const openPrivacyPolicy = () => {
    // TODO: Replace with actual Privacy Policy URL
    Linking.openURL('https://love2learn.com/privacy');
  };

  // Show success state after registration
  if (registrationComplete) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons name="mail" size={64} color={colors.status.success} />
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
                text: "If you don't see the email, check your spam folder."
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
            <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Start Your Tutoring Business</Text>
            <Text style={styles.subtitle}>
              Create your tutor account and start managing lessons in minutes
            </Text>
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
            {/* Business Name */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="business-outline"
                size={20}
                color={colors.neutral.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Business Name"
                placeholderTextColor={colors.neutral.textMuted}
                value={businessName}
                onChangeText={(text) => {
                  setBusinessName(text);
                  setMessage(null);
                }}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.neutral.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.neutral.textMuted}
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

            {/* Password */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.neutral.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.neutral.textMuted}
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
                  color={colors.neutral.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.neutral.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={colors.neutral.textMuted}
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
                  color={colors.neutral.textMuted}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordHint}>
              Password must be at least 6 characters
            </Text>

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              disabled={isLoading}
            >
              <View style={[
                styles.checkbox,
                agreedToTerms && styles.checkboxChecked
              ]}>
                {agreedToTerms && (
                  <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
                )}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={openTermsOfService}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={styles.termsLink} onPress={openPrivacyPolicy}>
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

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

            {/* Trial info */}
            <View style={styles.trialInfo}>
              <Ionicons name="gift-outline" size={18} color={colors.secondary.main} />
              <Text style={styles.trialInfoText}>
                Start with a 14-day free trial. No credit card required.
              </Text>
            </View>
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
    backgroundColor: colors.neutral.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    ...shadows.md,
  },
  logo: {
    width: 70,
    height: 70,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.base,
  },
  messageText: {
    fontSize: typography.sizes.sm,
    marginLeft: spacing.sm,
    flex: 1,
  },
  form: {
    marginBottom: spacing['2xl'],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    marginBottom: spacing.base,
    paddingHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: colors.neutral.borderLight,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  passwordHint: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginBottom: spacing.base,
    marginTop: -spacing.sm,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.primary.main,
  },
  termsText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary.main,
    fontWeight: typography.weights.medium,
  },
  registerButton: {
    backgroundColor: colors.accent.main,
    borderRadius: borderRadius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  registerButtonDisabled: {
    backgroundColor: colors.accent.light,
  },
  registerButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textInverse,
  },
  trialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.base,
    paddingVertical: spacing.sm,
  },
  trialInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.secondary.main,
    marginLeft: spacing.sm,
    fontWeight: typography.weights.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  loginLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary.main,
    fontWeight: typography.weights.semibold,
  },
  // Success state styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.status.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  successTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  successText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  emailText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.sm,
    marginBottom: spacing.base,
  },
  successHint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
    paddingHorizontal: spacing.base,
  },
  signInButton: {
    backgroundColor: colors.accent.main,
    borderRadius: borderRadius.md,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    ...shadows.md,
  },
  signInButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textInverse,
  },
  resendButton: {
    padding: spacing.md,
  },
  resendButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary.main,
    fontWeight: typography.weights.medium,
  },
});
