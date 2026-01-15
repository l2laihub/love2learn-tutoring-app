/**
 * MessageImagePicker Component
 * Select up to 5 images for a message
 */

import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing } from '../../theme';

interface MessageImagePickerProps {
  images: string[]; // Local URIs
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export function MessageImagePicker({
  images,
  onImagesChange,
  maxImages = 5,
  disabled = false,
}: MessageImagePickerProps) {
  const [loading, setLoading] = useState(false);

  const pickImages = async () => {
    if (disabled || images.length >= maxImages) return;

    try {
      setLoading(true);

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to select images.'
        );
        return;
      }

      // Pick images
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: maxImages - images.length,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset) => asset.uri);
        const combined = [...images, ...newImages].slice(0, maxImages);
        onImagesChange(combined);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  if (images.length === 0) {
    return (
      <Pressable
        onPress={pickImages}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.addButton,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Ionicons name="images-outline" size={24} color={colors.primary.main} />
        <Text style={styles.addText}>Add Images</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {images.map((uri, index) => (
          <View key={uri} style={styles.imageContainer}>
            <Image source={{ uri }} style={styles.image} />
            {!disabled && (
              <Pressable
                onPress={() => removeImage(index)}
                style={styles.removeButton}
              >
                <Ionicons name="close-circle" size={24} color={colors.accent.main} />
              </Pressable>
            )}
          </View>
        ))}

        {images.length < maxImages && !disabled && (
          <Pressable
            onPress={pickImages}
            disabled={loading}
            style={({ pressed }) => [
              styles.addMoreButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={32} color={colors.primary.main} />
          </Pressable>
        )}
      </ScrollView>

      <Text style={styles.counter}>
        {images.length}/{maxImages} images
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary.light,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary.main,
    borderStyle: 'dashed',
  },
  addText: {
    marginLeft: spacing.sm,
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary.main,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  imageContainer: {
    marginRight: spacing.sm,
    position: 'relative',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
  },
  addMoreButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.neutral.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.primary.main,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.neutral.textMuted,
    textAlign: 'right',
  },
});
