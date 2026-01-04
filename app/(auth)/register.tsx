import { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { validateInvitationToken } from '../../src/hooks/useParentInvitation';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme';

type MessageType = 'error' | 'success' | 'info';

interface Message {
  type: MessageType;
  text: string;
}

export default function RegisterScreen() {
  // Get invitation token from URL params
  const { token, email: invitedEmail } = useLocalSearchParams<{ token?: string; email?: string }>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  // Invitation state
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitedParentName, setInvitedParentName] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  const { signUp } = useAuthContext();

  // Validate invitation token on mount
  useEffect(() => {
    async function checkInvitation() {
      if (token) {
        setIsValidatingToken(true);
        try {
          const result = await validateInvitationToken(token);
          if (result.isValid && result.email) {
            setInvitationToken(token);
            setEmail(result.email);
            if (result.name) {
              setName(result.name);
              setInvitedParentName(result.name);
            }
            setMessage({
              type: 'info',
              text: `Welcome! You've been invited to join Love2Learn. Please complete your registration.`
            });
          } else {
            setMessage({
              type: 'error',
              text: result.error || 'This invitation link is invalid or has expired. Please contact the tutor for a new invitation.'
            });
          }
        } catch (error) {
          console.error('Error validating token:', error);
          setMessage({
            type: 'error',
            text: 'Failed to validate invitation. Please try again.'
          });
        } finally {
          setIsValidatingToken(false);
        }
      } else if (invitedEmail) {
        // If email is passed directly (without token), pre-fill it
        setEmail(invitedEmail);
      }
    }

    checkInvitation();
  }, [token, invitedEmail]);

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
      // Pass invitation token if available (for linking to existing parent record)
      const { data: session, error: signUpError } = await signUp(
        email.trim(),
        password,
        name.trim(),
        invitationToken || undefined
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
        return { bg: colors.status.errorBg, color: colors.status.error, icon: 'alert-circle' as const };
      case 'success':
        return { bg: colors.status.successBg, color: colors.status.success, icon: 'checkmark-circle' as const };
      case 'info':
        return { bg: colors.status.infoBg, color: colors.status.info, icon: 'information-circle' as const };
    }
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

  // Show loading state while validating invitation token
  if (isValidatingToken) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Validating invitation...</Text>
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
            <Text style={styles.title}>
              {invitationToken ? 'Complete Registration' : 'Create Account'}
            </Text>
            <Text style={styles.subtitle}>
              {invitationToken
                ? `Welcome${invitedParentName ? `, ${invitedParentName}` : ''}! Set up your password to get started.`
                : 'Start your tutoring journey'}
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
            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.neutral.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={colors.neutral.textMuted}
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

            <View style={[
              styles.inputContainer,
              invitationToken && styles.inputContainerLocked
            ]}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={invitationToken ? colors.status.success : colors.neutral.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, invitationToken && styles.inputLocked]}
                placeholder="Email"
                placeholderTextColor={colors.neutral.textMuted}
                value={email}
                onChangeText={(text) => {
                  if (!invitationToken) {
                    setEmail(text);
                    setMessage(null);
                  }
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!isLoading && !invitationToken}
              />
              {invitationToken && (
                <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
              )}
            </View>

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
  inputContainerLocked: {
    backgroundColor: colors.status.successBg,
    borderWidth: 1,
    borderColor: colors.status.success,
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
  inputLocked: {
    color: colors.secondary.dark,
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  passwordHint: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginBottom: spacing.xl,
    marginTop: -spacing.sm,
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
  // Loading container for token validation
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.base,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
});
