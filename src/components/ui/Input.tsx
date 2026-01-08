import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
  Pressable,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography, shadows } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  error,
  hint,
  icon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const inputContainerStyle = [
    styles.inputContainer,
    isFocused && styles.inputContainerFocused,
    error && styles.inputContainerError,
  ];

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  // Handle container press to focus input (helps with mobile touch issues)
  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableWithoutFeedback onPress={handleContainerPress}>
        <View style={inputContainerStyle}>
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={colors.neutral.textMuted}
              style={styles.icon}
            />
          )}
          <TextInput
            ref={inputRef}
            style={[styles.input, icon && styles.inputWithIcon, style]}
            placeholderTextColor={colors.neutral.textMuted}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoCorrect={false}
            spellCheck={false}
            {...props}
          />
          {rightIcon && (
            <Pressable
              onPress={onRightIconPress}
              style={styles.rightIcon}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={rightIcon} size={20} color={colors.neutral.textMuted} />
            </Pressable>
          )}
        </View>
      </TouchableWithoutFeedback>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

// Search input variant
interface SearchInputProps extends Omit<InputProps, 'icon'> {
  onClear?: () => void;
}

export function SearchInput({ value, onClear, ...props }: SearchInputProps) {
  return (
    <Input
      icon="search"
      placeholder="Search..."
      rightIcon={value ? 'close-circle' : undefined}
      onRightIconPress={onClear}
      value={value}
      {...props}
    />
  );
}

// Password input variant
interface PasswordInputProps extends Omit<InputProps, 'secureTextEntry' | 'rightIcon'> {}

export function PasswordInput(props: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Input
      secureTextEntry={!showPassword}
      rightIcon={showPassword ? 'eye-off' : 'eye'}
      onRightIconPress={() => setShowPassword(!showPassword)}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.surface,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputContainerFocused: {
    borderColor: colors.piano.primary,
    ...shadows.sm,
  },
  inputContainerError: {
    borderColor: colors.status.error,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    paddingVertical: spacing.md,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },
  icon: {
    marginRight: spacing.xs,
  },
  rightIcon: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  error: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
});

export default Input;
