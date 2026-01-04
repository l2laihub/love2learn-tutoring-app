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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme';

type MessageType = 'error' | 'success' | 'info';

interface Message {
  type: MessageType;
  text: string;
}

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const { resetPassword } = useAuthContext();

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

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    setMessage(null);

    if (!validateEmail()) {
      return;
    }

    setIsLoading(true);

    try {
      const { error: resetError } = await resetPassword(email.trim());

      if (resetError) {
        setMessage({ type: 'error', text: resetError.message });
        return;
      }

      setEmailSent(true);
      setMessage({
        type: 'success',
        text: `Password reset email sent to ${email.trim()}. Check your inbox for the reset link.`
      });
    } catch (err) {
      console.error('Password reset error:', err);
      setMessage({ type: 'error', text: 'Failed to send reset email. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Success state after email sent
  if (emailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons name="mail-open" size={64} color={colors.primary.main} />
          </View>
          <Text style={styles.successTitle}>Check Your Email</Text>
          <Text style={styles.successText}>
            We've sent a password reset link to:
          </Text>
          <Text style={styles.emailText}>{email}</Text>
          <Text style={styles.successHint}>
            Click the link in the email to reset your password. If you don't see it, check your spam folder.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.primaryButtonText}>Back to Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setEmailSent(false);
              setMessage(null);
            }}
          >
            <Text style={styles.secondaryButtonText}>Try a different email</Text>
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
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              No worries! Enter your email and we'll send you a link to reset your password.
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
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral.textInverse} />
              ) : (
                <Text style={styles.resetButtonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              disabled={isLoading}
            >
              <Text style={styles.loginLink}>Sign In</Text>
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
    paddingHorizontal: spacing.base,
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
    marginBottom: spacing.xl,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
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
    backgroundColor: colors.primary.subtle,
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
