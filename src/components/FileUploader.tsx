/**
 * FileUploader
 * Reusable component for selecting and uploading files (PDFs and images)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { STORAGE_BUCKETS, FILE_SIZE_LIMITS, ALLOWED_MIME_TYPES, StorageBucket } from '../hooks/useFileUpload';

export interface SelectedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface FileUploaderProps {
  type: 'pdf' | 'image';
  onFileSelected: (file: SelectedFile) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  selectedFile?: SelectedFile | null;
  onClear?: () => void;
}

export function FileUploader({
  type,
  onFileSelected,
  onError,
  disabled = false,
  selectedFile,
  onClear,
}: FileUploaderProps) {
  const [picking, setPicking] = useState(false);

  const bucket: StorageBucket = type === 'pdf' ? STORAGE_BUCKETS.WORKSHEETS : STORAGE_BUCKETS.SESSION_MEDIA;
  const maxSize = FILE_SIZE_LIMITS[bucket];
  const allowedTypes = ALLOWED_MIME_TYPES[bucket];

  const handlePickDocument = async () => {
    if (disabled || picking) return;

    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedTypes,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      // Validate file size
      if (file.size && file.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));
        onError?.(`File too large. Maximum size is ${maxSizeMB}MB`);
        return;
      }

      // Validate MIME type
      if (file.mimeType && !allowedTypes.includes(file.mimeType as (typeof allowedTypes)[number])) {
        onError?.(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
        return;
      }

      onFileSelected({
        uri: file.uri,
        name: file.name,
        size: file.size || 0,
        mimeType: file.mimeType || 'application/octet-stream',
      });
    } catch (err) {
      console.error('Document picker error:', err);
      onError?.('Failed to select file');
    } finally {
      setPicking(false);
    }
  };

  const handlePickImage = async (useCamera: boolean) => {
    if (disabled || picking) return;

    setPicking(true);
    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          onError?.('Camera permission is required');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          onError?.('Photo library permission is required');
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const image = result.assets[0];

      // Get file info
      const uri = image.uri;
      // Generate a proper filename - don't use data URL segments
      const timestamp = Date.now();
      const extension = (image.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
      const fileName = image.fileName || `photo_${timestamp}.${extension}`;
      const mimeType = image.mimeType || 'image/jpeg';

      // Estimate file size (fileSize might not be available on all platforms)
      const fileSize = image.fileSize || 0;

      // Validate file size if available
      if (fileSize > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));
        onError?.(`Image too large. Maximum size is ${maxSizeMB}MB`);
        return;
      }

      onFileSelected({
        uri,
        name: fileName,
        size: fileSize,
        mimeType,
      });
    } catch (err) {
      console.error('Image picker error:', err);
      onError?.('Failed to select image');
    } finally {
      setPicking(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getIcon = () => {
    return type === 'pdf' ? 'document' : 'image';
  };

  const getLabel = () => {
    return type === 'pdf' ? 'Select PDF' : 'Select Image';
  };

  const getDescription = () => {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    if (type === 'pdf') {
      return `PDF files only, max ${maxSizeMB}MB`;
    }
    return `PNG, JPG, GIF, or WebP, max ${maxSizeMB}MB`;
  };

  // If a file is selected, show the preview
  if (selectedFile) {
    return (
      <View style={styles.selectedContainer}>
        <View style={styles.selectedFile}>
          <View style={[styles.fileIcon, { backgroundColor: type === 'pdf' ? colors.math.subtle : colors.status.infoBg }]}>
            <Ionicons
              name={type === 'pdf' ? 'document' : 'image'}
              size={24}
              color={type === 'pdf' ? colors.math.primary : colors.status.info}
            />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {selectedFile.name}
            </Text>
            <Text style={styles.fileSize}>{formatFileSize(selectedFile.size)}</Text>
          </View>
          {onClear && (
            <Pressable onPress={onClear} style={styles.clearButton}>
              <Ionicons name="close-circle" size={24} color={colors.neutral.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {type === 'pdf' ? (
        // PDF Picker - single button
        <Pressable
          style={[styles.dropzone, disabled && styles.dropzoneDisabled]}
          onPress={handlePickDocument}
          disabled={disabled || picking}
        >
          {picking ? (
            <ActivityIndicator size="large" color={colors.piano.primary} />
          ) : (
            <>
              <View style={styles.iconContainer}>
                <Ionicons name={getIcon()} size={48} color={colors.piano.primary} />
              </View>
              <Text style={styles.dropzoneLabel}>{getLabel()}</Text>
              <Text style={styles.dropzoneDescription}>{getDescription()}</Text>
            </>
          )}
        </Pressable>
      ) : (
        // Image Picker - two options
        <View style={styles.imagePickerOptions}>
          <Pressable
            style={[styles.imageOption, disabled && styles.dropzoneDisabled]}
            onPress={() => handlePickImage(false)}
            disabled={disabled || picking}
          >
            {picking ? (
              <ActivityIndicator size="small" color={colors.piano.primary} />
            ) : (
              <>
                <View style={styles.smallIconContainer}>
                  <Ionicons name="images" size={32} color={colors.piano.primary} />
                </View>
                <Text style={styles.optionLabel}>Photo Library</Text>
                <Text style={styles.optionDescription}>Choose from gallery</Text>
              </>
            )}
          </Pressable>

          {Platform.OS !== 'web' && (
            <Pressable
              style={[styles.imageOption, disabled && styles.dropzoneDisabled]}
              onPress={() => handlePickImage(true)}
              disabled={disabled || picking}
            >
              {picking ? (
                <ActivityIndicator size="small" color={colors.piano.primary} />
              ) : (
                <>
                  <View style={styles.smallIconContainer}>
                    <Ionicons name="camera" size={32} color={colors.piano.primary} />
                  </View>
                  <Text style={styles.optionLabel}>Take Photo</Text>
                  <Text style={styles.optionDescription}>Use camera</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  dropzone: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  dropzoneDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.piano.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  dropzoneLabel: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  dropzoneDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  imagePickerOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  imageOption: {
    flex: 1,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  smallIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.piano.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  optionLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  selectedContainer: {},
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  fileSize: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  clearButton: {
    padding: spacing.xs,
  },
});

export default FileUploader;
