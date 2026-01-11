/**
 * AvatarUpload Component
 * Reusable component for uploading and displaying profile photos
 * Supports both parent and student avatars
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// Use legacy API for expo-file-system as SDK 54 deprecated the old methods
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography, shadows } from '../theme';

// Avatar storage bucket name
export const AVATARS_BUCKET = 'avatars';

// File size limit for avatars (5MB)
export const AVATAR_SIZE_LIMIT = 5 * 1024 * 1024;

// Allowed MIME types for avatars
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export type AvatarType = 'parent' | 'student';

export interface AvatarUploadProps {
  /** Type of avatar (parent or student) */
  type: AvatarType;
  /** ID of the parent or student */
  entityId: string;
  /** Current avatar URL (if any) */
  currentAvatarUrl?: string | null;
  /** Name to show initials as fallback */
  name: string;
  /** Size of the avatar circle */
  size?: number;
  /** Callback when avatar is uploaded */
  onUpload?: (url: string) => void;
  /** Callback when avatar is removed */
  onRemove?: () => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether to show edit overlay on hover/press */
  showEditOverlay?: boolean;
}

/**
 * Get initials from a name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generate a consistent color based on a string
 */
function getColorFromName(name: string): string {
  const colorPalette = [
    colors.piano.primary,
    colors.math.primary,
    colors.subjects.reading.primary,
    colors.subjects.speech.primary,
    colors.subjects.english.primary,
    colors.brand.coral,
    colors.brand.navy,
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colorPalette[Math.abs(hash) % colorPalette.length];
}

export function AvatarUpload({
  type,
  entityId,
  currentAvatarUrl,
  name,
  size = 100,
  onUpload,
  onRemove,
  disabled = false,
  showEditOverlay = true,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  // Track image key for cache busting on mobile
  const [imageKey, setImageKey] = useState(() => Date.now());
  // Track previous URL to detect changes
  const prevUrlRef = useRef(currentAvatarUrl);

  const initials = getInitials(name);
  const backgroundColor = getColorFromName(name);
  const fontSize = size * 0.35;

  // When the avatar URL changes externally (e.g., after upload and refresh),
  // increment the cache key to force image reload on mobile
  useEffect(() => {
    if (currentAvatarUrl !== prevUrlRef.current) {
      console.log('Avatar URL changed, busting cache:', {
        old: prevUrlRef.current?.substring(0, 50),
        new: currentAvatarUrl?.substring(0, 50),
      });
      prevUrlRef.current = currentAvatarUrl;
      setImageKey(Date.now());
      setImageError(false);
    }
  }, [currentAvatarUrl]);

  // Add cache-busting query param to URL for mobile devices
  const getImageUri = (url: string): string => {
    if (Platform.OS === 'web') return url;
    // Add timestamp to bust mobile cache when URL changes
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${imageKey}`;
  };

  const handlePickImage = async (useCamera: boolean) => {
    if (disabled || uploading) return;

    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is required to take photos.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Photo library permission is required to select photos.');
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1], // Square crop for avatars
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1], // Square crop for avatars
            quality: 0.8,
          });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const image = result.assets[0];
      await uploadAvatar(image);
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadAvatar = async (image: ImagePicker.ImagePickerAsset) => {
    try {
      setUploading(true);
      setImageError(false);

      const uri = image.uri;
      const mimeType = image.mimeType || 'image/jpeg';
      const timestamp = Date.now();
      const extension = mimeType.split('/')[1] || 'jpg';
      const fileName = `avatar_${timestamp}.${extension}`;
      const filePath = `${type}s/${entityId}/${fileName}`;

      let fileData: Blob | Uint8Array;
      let fileSize: number;

      console.log('Avatar upload starting:', {
        type,
        entityId,
        platform: Platform.OS,
        uri: uri.substring(0, 50) + '...',
        mimeType,
        imageFileSize: image.fileSize
      });

      // Determine the best method to read the file based on platform and URI scheme
      const isWebPlatform = Platform.OS === 'web';
      const isHttpUri = uri.startsWith('http://') || uri.startsWith('https://');
      const isBlobOrDataUri = uri.startsWith('blob:') || uri.startsWith('data:');
      const isLocalFileUri = uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');

      if (isWebPlatform || isBlobOrDataUri || isHttpUri) {
        // Web platform or blob/data/http URIs - use fetch
        console.log('Using fetch to read file (web/blob/http)');
        const response = await fetch(uri);
        const blob = await response.blob();
        fileSize = blob.size;
        fileData = blob;
        console.log('Fetch successful, blob size:', fileSize);
      } else if (isLocalFileUri || Platform.OS === 'ios' || Platform.OS === 'android') {
        // Native platform with local file URI - use expo-file-system directly
        // Don't try fetch for file:// or content:// URIs as it will fail
        console.log('Using FileSystem for native local file:', { uri: uri.substring(0, 50) + '...' });

        try {
          // Use file size from image picker if available
          fileSize = image.fileSize || 0;

          if (fileSize === 0) {
            try {
              const fileInfo = await FileSystem.getInfoAsync(uri);
              if (fileInfo.exists && 'size' in fileInfo) {
                fileSize = fileInfo.size || 0;
              }
            } catch (e) {
              console.warn('Could not get file size:', e);
              // Continue without file size validation
            }
          }

          // Read file as base64
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log('FileSystem read successful, base64 length:', base64.length);

          // Convert base64 to Uint8Array
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileData = bytes;

          // Use byte array length as file size if we couldn't get it earlier
          if (fileSize === 0) {
            fileSize = bytes.length;
          }

          console.log('File prepared for upload:', { fileSize, bytesLength: bytes.length });
        } catch (readError) {
          console.error('FileSystem read failed:', readError);
          throw new Error(`Failed to read image file: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
        }
      } else {
        // Unknown URI scheme - try fetch as fallback
        console.log('Unknown URI scheme, trying fetch:', uri.substring(0, 30));
        const response = await fetch(uri);
        const blob = await response.blob();
        fileSize = blob.size;
        fileData = blob;
      }

      console.log('File read complete:', { fileSize });

      // Validate file size
      if (fileSize > AVATAR_SIZE_LIMIT) {
        Alert.alert('Error', 'Image is too large. Maximum size is 5MB.');
        return;
      }

      // Delete old avatar if exists
      if (currentAvatarUrl) {
        try {
          const oldPath = extractPathFromUrl(currentAvatarUrl);
          if (oldPath) {
            await supabase.storage.from(AVATARS_BUCKET).remove([oldPath]);
          }
        } catch (e) {
          // Ignore deletion errors for old avatar
          console.warn('Failed to delete old avatar:', e);
        }
      }

      // Upload new avatar
      console.log('Uploading to storage:', { bucket: AVATARS_BUCKET, filePath, contentType: mimeType });
      const { data, error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(filePath, fileData, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Storage upload failed:', uploadError);
        throw new Error(uploadError.message);
      }

      console.log('Storage upload successful:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(AVATARS_BUCKET)
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      console.log('Avatar uploaded successfully:', { type, entityId, publicUrl });

      // Increment image key to bust cache on mobile
      setImageKey(prev => prev + 1);
      // Reset image error state for new image
      setImageError(false);

      // Notify parent component
      onUpload?.(publicUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Avatar upload error:', { type, entityId, error: errorMessage, fullError: err });
      Alert.alert('Error', `Failed to upload avatar: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (disabled || uploading || !currentAvatarUrl) return;

    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploading(true);

              const oldPath = extractPathFromUrl(currentAvatarUrl);
              if (oldPath) {
                await supabase.storage.from(AVATARS_BUCKET).remove([oldPath]);
              }

              onRemove?.();
            } catch (err) {
              console.error('Remove avatar error:', err);
              Alert.alert('Error', 'Failed to remove photo. Please try again.');
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const showActionSheet = () => {
    if (disabled || uploading) return;

    const options: Array<{ text: string; onPress: () => void }> = [
      { text: 'Choose from Library', onPress: () => { handlePickImage(false); } },
    ];

    if (Platform.OS !== 'web') {
      options.push({ text: 'Take Photo', onPress: () => { handlePickImage(true); } });
    }

    if (currentAvatarUrl) {
      options.push({ text: 'Remove Photo', onPress: () => { handleRemoveAvatar(); } });
    }

    options.push({ text: 'Cancel', onPress: () => {} });

    if (Platform.OS === 'web') {
      // On web, just open the image picker directly
      handlePickImage(false);
    } else {
      Alert.alert(
        'Change Photo',
        undefined,
        options.map((opt, index) => ({
          text: opt.text,
          onPress: opt.onPress,
          style: opt.text === 'Remove Photo' ? 'destructive' :
                 opt.text === 'Cancel' ? 'cancel' : 'default',
        }))
      );
    }
  };

  const hasValidImage = currentAvatarUrl && !imageError;

  return (
    <Pressable
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        disabled && styles.disabled,
      ]}
      onPress={showActionSheet}
      disabled={disabled || uploading}
    >
      {/* Avatar Image or Initials */}
      {hasValidImage ? (
        <Image
          source={{ uri: getImageUri(currentAvatarUrl) }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          onError={() => setImageError(true)}
        />
      ) : (
        <View
          style={[
            styles.initialsContainer,
            { width: size, height: size, borderRadius: size / 2, backgroundColor },
          ]}
        >
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </View>
      )}

      {/* Loading Overlay */}
      {uploading && (
        <View style={[styles.overlay, { borderRadius: size / 2 }]}>
          <ActivityIndicator size="small" color={colors.neutral.white} />
        </View>
      )}

      {/* Edit Overlay */}
      {showEditOverlay && !uploading && !disabled && (
        <View style={[styles.editBadge, { right: size * 0.02, bottom: size * 0.02 }]}>
          <Ionicons name="camera" size={size * 0.18} color={colors.neutral.white} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Extract storage path from a public URL
 */
function extractPathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/avatars\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Compact avatar display component (no upload capability)
 * Used for displaying avatars in lists, calendar, etc.
 */
export interface AvatarDisplayProps {
  /** Current avatar URL (if any) */
  avatarUrl?: string | null;
  /** Name to show initials as fallback */
  name: string;
  /** Size of the avatar circle */
  size?: number;
  /** Optional onPress handler */
  onPress?: () => void;
}

export function AvatarDisplay({
  avatarUrl,
  name,
  size = 40,
  onPress,
}: AvatarDisplayProps) {
  const [imageError, setImageError] = useState(false);
  // Track image key for cache busting on mobile
  const [imageKey, setImageKey] = useState(() => Date.now());
  // Track previous URL to detect changes
  const prevUrlRef = useRef(avatarUrl);

  const initials = getInitials(name);
  const backgroundColor = getColorFromName(name);
  const fontSize = size * 0.4;

  // When the avatar URL changes, bust the cache
  useEffect(() => {
    if (avatarUrl !== prevUrlRef.current) {
      prevUrlRef.current = avatarUrl;
      setImageKey(Date.now());
      setImageError(false);
    }
  }, [avatarUrl]);

  // Add cache-busting query param to URL for mobile devices
  const getImageUri = (url: string): string => {
    if (Platform.OS === 'web') return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${imageKey}`;
  };

  const hasValidImage = avatarUrl && !imageError;

  const content = hasValidImage ? (
    <Image
      source={{ uri: getImageUri(avatarUrl) }}
      style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      onError={() => setImageError(true)}
    />
  ) : (
    <View
      style={[
        styles.initialsContainer,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={{ width: size, height: size }}>
        {content}
      </Pressable>
    );
  }

  return <View style={{ width: size, height: size }}>{content}</View>;
}

/**
 * Stacked avatars component for showing multiple students
 * Used in calendar lesson cards for combined sessions
 */
export interface StackedAvatarsProps {
  /** Array of students with avatar info */
  students: Array<{
    id: string;
    name: string;
    avatar_url?: string | null;
  }>;
  /** Size of each avatar */
  size?: number;
  /** Maximum number of avatars to show before "+N" */
  maxVisible?: number;
}

export function StackedAvatars({
  students,
  size = 28,
  maxVisible = 3,
}: StackedAvatarsProps) {
  const visibleStudents = students.slice(0, maxVisible);
  const remainingCount = students.length - maxVisible;
  const overlap = size * 0.35;

  return (
    <View style={styles.stackedContainer}>
      {visibleStudents.map((student, index) => (
        <View
          key={student.id}
          style={[
            styles.stackedAvatar,
            {
              marginLeft: index === 0 ? 0 : -overlap,
              zIndex: visibleStudents.length - index,
            },
          ]}
        >
          <AvatarDisplay
            avatarUrl={student.avatar_url}
            name={student.name}
            size={size}
          />
        </View>
      ))}
      {remainingCount > 0 && (
        <View
          style={[
            styles.remainingBadge,
            {
              marginLeft: -overlap,
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Text style={[styles.remainingText, { fontSize: size * 0.4 }]}>
            +{remainingCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    ...shadows.sm,
  },
  disabled: {
    opacity: 0.6,
  },
  image: {
    resizeMode: 'cover',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.neutral.white,
    fontWeight: typography.weights.bold,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: colors.neutral.white,
  },
  stackedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatar: {
    borderWidth: 2,
    borderColor: colors.neutral.white,
    borderRadius: 999,
  },
  remainingBadge: {
    backgroundColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.neutral.white,
  },
  remainingText: {
    color: colors.neutral.text,
    fontWeight: typography.weights.semibold,
  },
});

export default AvatarUpload;
