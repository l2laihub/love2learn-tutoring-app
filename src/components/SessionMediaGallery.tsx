/**
 * SessionMediaGallery
 * Display grid of shared images from tutoring sessions
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { SharedResourceWithStudent } from '../types/database';
import { useStorageUrl, STORAGE_BUCKETS } from '../hooks/useFileUpload';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_COLUMNS = 3;
const GALLERY_GAP = spacing.xs;
const GALLERY_ITEM_SIZE = (SCREEN_WIDTH - spacing.base * 2 - GALLERY_GAP * (GALLERY_COLUMNS - 1)) / GALLERY_COLUMNS;

export interface SessionMediaGalleryProps {
  resources: SharedResourceWithStudent[];
  loading?: boolean;
  onImagePress?: (resource: SharedResourceWithStudent) => void;
  emptyMessage?: string;
}

interface ImagePreviewModalProps {
  resource: SharedResourceWithStudent | null;
  visible: boolean;
  onClose: () => void;
  onMarkViewed?: (id: string) => void;
}

function ImagePreviewModal({ resource, visible, onClose, onMarkViewed }: ImagePreviewModalProps) {
  const { url, loading } = useStorageUrl(
    STORAGE_BUCKETS.SESSION_MEDIA,
    resource?.storage_path || null
  );

  React.useEffect(() => {
    if (resource && !resource.viewed_at && onMarkViewed) {
      onMarkViewed(resource.id);
    }
  }, [resource, onMarkViewed]);

  if (!resource) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {resource.title}
              </Text>
              <Text style={styles.modalSubtitle}>
                {resource.student?.name} • {new Date(resource.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={28} color={colors.neutral.white} />
            </Pressable>
          </View>

          {/* Image */}
          <View style={styles.modalImageContainer}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.neutral.white} />
            ) : url ? (
              <Image source={{ uri: url }} style={styles.modalImage} resizeMode="contain" />
            ) : (
              <View style={styles.modalImagePlaceholder}>
                <Ionicons name="image-outline" size={64} color={colors.neutral.textMuted} />
                <Text style={styles.modalImagePlaceholderText}>Failed to load image</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {resource.description && (
            <View style={styles.modalDescription}>
              <Text style={styles.modalDescriptionText}>{resource.description}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

interface GalleryItemProps {
  resource: SharedResourceWithStudent;
  onPress: () => void;
}

function GalleryItem({ resource, onPress }: GalleryItemProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Use thumbnail URL or storage path
  const imageUrl = resource.thumbnail_url || null;

  return (
    <Pressable style={styles.galleryItem} onPress={onPress}>
      {imageUrl && !imageError ? (
        <>
          <Image
            source={{ uri: imageUrl }}
            style={styles.galleryImage}
            resizeMode="cover"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
          {imageLoading && (
            <View style={styles.galleryImageLoading}>
              <ActivityIndicator size="small" color={colors.neutral.white} />
            </View>
          )}
        </>
      ) : (
        <View style={styles.galleryImagePlaceholder}>
          <Ionicons name="image-outline" size={32} color={colors.neutral.textMuted} />
        </View>
      )}

      {/* Unviewed indicator */}
      {!resource.viewed_at && (
        <View style={styles.unviewedBadge}>
          <View style={styles.unviewedDot} />
        </View>
      )}

      {/* Student name overlay */}
      <View style={styles.galleryOverlay}>
        <Text style={styles.galleryStudentName} numberOfLines={1}>
          {resource.student?.name}
        </Text>
      </View>
    </Pressable>
  );
}

export function SessionMediaGallery({
  resources,
  loading = false,
  onImagePress,
  emptyMessage = 'No session images yet',
}: SessionMediaGalleryProps) {
  const [selectedResource, setSelectedResource] = useState<SharedResourceWithStudent | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Filter to only show images
  const imageResources = resources.filter((r) => r.resource_type === 'image');

  const handleImagePress = (resource: SharedResourceWithStudent) => {
    if (onImagePress) {
      onImagePress(resource);
    } else {
      setSelectedResource(resource);
      setPreviewVisible(true);
    }
  };

  const handleClosePreview = () => {
    setPreviewVisible(false);
    setTimeout(() => setSelectedResource(null), 300);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.piano.primary} />
        <Text style={styles.loadingText}>Loading images...</Text>
      </View>
    );
  }

  if (imageResources.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="images-outline" size={64} color={colors.neutral.textMuted} />
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.gallery}>
        {imageResources.map((resource) => (
          <GalleryItem key={resource.id} resource={resource} onPress={() => handleImagePress(resource)} />
        ))}
      </View>

      <ImagePreviewModal
        resource={selectedResource}
        visible={previewVisible}
        onClose={handleClosePreview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GALLERY_GAP,
  },
  galleryItem: {
    width: GALLERY_ITEM_SIZE,
    height: GALLERY_ITEM_SIZE,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.neutral.border,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryImageLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.surfaceHover,
  },
  galleryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  galleryStudentName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.white,
  },
  unviewedBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  unviewedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.status.info,
    borderWidth: 2,
    borderColor: colors.neutral.white,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginTop: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.base,
    paddingTop: spacing.xl,
  },
  modalTitleContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  modalSubtitle: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImagePlaceholderText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginTop: spacing.md,
  },
  modalDescription: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  modalDescriptionText: {
    fontSize: typography.sizes.base,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
  },
});

export default SessionMediaGallery;
