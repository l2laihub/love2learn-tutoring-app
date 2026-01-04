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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme';
import { supabase } from '../../src/lib/supabase';

type MessageType = 'error' | 'success' | 'info';

interface Message {
  type: MessageType;
  text: string;
}

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [passwordReset, setPasswordReset] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // User should have a session from the recovery link
        if (session) {
          setIsValidSession(true);
        } else {
          setMessage({
            type: 'error',
            text: 'Invalid or expired reset link. Please request a new password reset.',
          });
        }
      } catch (error) {
        console.error('Session check error:', error);
        setMessage({
          type: 'error',
          text: 'Unable to verify reset link. Please try again.',
        });
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, []);

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
    if (!password) {
      setMessage({ type: 'error', text: 'Please enter a new password' });
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

  const handleResetPassword = async () => {
    setMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      setPasswordReset(true);
      setMessage({
        type: 'success',
        text: 'Your password has been reset successfully!',
      });
    } catch (err) {
      console.error('Password reset error:', err);
      setMessage({ type: 'error', text: 'Failed to reset password. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking session
  if (isCheckingSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Verifying reset link...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success state after password reset
  if (passwordReset) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={64} color={colors.status.success} />
          </View>
          <Text style={styles.successTitle}>Password Reset Complete</Text>
          <Text style={styles.successText}>
            Your password has been successfully updated.
          </Text>
          <Text style={styles.successHint}>
            You can now sign in with your new password.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.primaryButtonText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Invalid session state
  if (!isValidSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="alert-circle" size={64} color={colors.status.error} />
          </View>
          <Text style={styles.errorTitle}>Link Expired</Text>
          <Text style={styles.errorText}>
            This password reset link is invalid or has expired.
          </Text>
          <Text style={styles.errorHint}>
            Please request a new password reset link.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(auth)/forgot-password')}
          >
            <Text style={styles.primaryButtonText}>Request New Link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
          </TouchableOpacity>
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
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your new password below.
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
                name="lock-closed-outline"
                size={20}
                color={colors.neutral.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor={colors.neutral.textMuted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                editable={!isLoading}
                autoFocus
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
                placeholder="Confirm New Password"
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
              style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral.textInverse} />
              ) : (
                <Text style={styles.resetButtonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
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
    fontSize: typography.sizes['2xl'],
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
    marginBottom: spacing.xl,
    marginTop: -spacing.sm,
  },
  resetButton: {
    backgroundColor: colors.accent.main,
    borderRadius: borderRadius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  resetButtonDisabled: {
    backgroundColor: colors.accent.light,
  },
  resetButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textInverse,
  },
  // Loading state
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
  // Success state
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
  successHint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.status.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  errorTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  primaryButton: {
    backgroundColor: colors.accent.main,
    borderRadius: borderRadius.md,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    ...shadows.md,
  },
  primaryButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textInverse,
  },
  secondaryButton: {
    padding: spacing.md,
  },
  secondaryButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary.main,
    fontWeight: typography.weights.medium,
  },
});
