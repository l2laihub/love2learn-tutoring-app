/**
 * ParentFormModal
 * Modal form for creating and editing parents
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { colors, spacing, typography } from '../theme';
import { Parent, CreateParentInput, UpdateParentInput } from '../types/database';

interface ParentFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<CreateParentInput, 'user_id'> | UpdateParentInput) => Promise<boolean>;
  parent?: Parent | null;
  loading?: boolean;
}

export function ParentFormModal({
  visible,
  onClose,
  onSave,
  parent,
  loading = false,
}: ParentFormModalProps) {
  const isEditing = !!parent;

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or parent changes
  useEffect(() => {
    if (visible) {
      if (parent) {
        setName(parent.name);
        setEmail(parent.email);
        setPhone(parent.phone || '');
      } else {
        setName('');
        setEmail('');
        setPhone('');
      }
      setErrors({});
    }
  }, [visible, parent]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const formatPhone = (text: string): string => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone is optional, but validate format if provided
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length > 0 && phoneDigits.length < 10) {
        newErrors.phone = 'Please enter a complete phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const data: Omit<CreateParentInput, 'user_id'> | UpdateParentInput = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : null,
    };

    const success = await onSave(data);
    if (success) {
      onClose();
    }
  };

  const handleClose = () => {
    if (name || email || phone) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEditing ? 'Edit Parent' : 'Add Parent'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Name Input */}
          <Input
            label="Full Name"
            placeholder="Enter parent's full name"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoCapitalize="words"
            autoFocus
          />

          {/* Email Input */}
          <Input
            label="Email Address"
            placeholder="parent@example.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Phone Input */}
          <Input
            label="Phone Number (Optional)"
            placeholder="(555) 123-4567"
            value={phone}
            onChangeText={(text) => setPhone(formatPhone(text))}
            error={errors.phone}
            keyboardType="phone-pad"
            maxLength={14}
          />

          {/* Helper Text */}
          <View style={styles.helperContainer}>
            <Ionicons name="information-circle-outline" size={18} color={colors.neutral.textMuted} />
            <Text style={styles.helperText}>
              Parents can have multiple students linked to their account for billing and communication.
            </Text>
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Cancel"
            onPress={handleClose}
            variant="outline"
            style={styles.cancelButton}
          />
          <Button
            title={isEditing ? 'Save Changes' : 'Add Parent'}
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  closeButton: {
    padding: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  helperContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.neutral.background,
    borderRadius: spacing.sm,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  helperText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});

export default ParentFormModal;
