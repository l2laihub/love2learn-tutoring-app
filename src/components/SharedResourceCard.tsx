/**
 * SharedResourceCard
 * Card component for displaying shared resources (worksheets, PDFs, images, videos)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { SharedResourceWithStudent, ResourceType } from '../types/database';
import { YouTubeThumbnail } from './YouTubeEmbed';
import { YouTubePlayer } from './YouTubePlayer';
import { getYouTubeVideoInfo } from '../utils/youtube';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SharedResourceCardProps {
  resource: SharedResourceWithStudent;
  onPress?: () => void;
  onMarkViewed?: (id: string) => void;
  onDelete?: (resource: SharedResourceWithStudent) => void;
  showDeleteButton?: boolean;
  compact?: boolean;
  // Multi-select support
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (resource: SharedResourceWithStudent) => void;
}

const getResourceTypeConfig = (type: ResourceType) => {
  switch (type) {
    case 'worksheet':
      return {
        icon: 'document-text',
        label: 'Worksheet',
        color: colors.piano.primary,
        bgColor: colors.piano.subtle,
      };
    case 'pdf':
      return {
        icon: 'document',
        label: 'PDF Document',
        color: colors.math.primary,
        bgColor: colors.math.subtle,
      };
    case 'image':
      return {
        icon: 'image',
        label: 'Session Image',
        color: colors.status.info,
        bgColor: colors.status.infoBg,
      };
    case 'video':
      return {
        icon: 'logo-youtube',
        label: 'Video',
        color: '#FF0000',
        bgColor: '#FFEBEE',
      };
    default:
      return {
        icon: 'document-outline',
        label: 'Resource',
        color: colors.neutral.text,
        bgColor: colors.neutral.background,
      };
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
};

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function SharedResourceCard({
  resource,
  onPress,
  onMarkViewed,
  onDelete,
  showDeleteButton = false,
  compact = false,
  isSelectable = false,
  isSelected = false,
  onSelect,
}: SharedResourceCardProps) {
  const config = getResourceTypeConfig(resource.resource_type);
  const isUnviewed = !resource.viewed_at;

  const handlePress = () => {
    if (isSelectable && onSelect) {
      onSelect(resource);
      return;
    }
    if (isUnviewed && onMarkViewed) {
      onMarkViewed(resource.id);
    }
    onPress?.();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(resource);
    }
  };

  const handleOpenInYouTube = async () => {
    if (resource.external_url) {
      try {
        await Linking.openURL(resource.external_url);
      } catch (err) {
        console.error('Error opening YouTube URL:', err);
      }
    }
  };

  // Render thumbnail based on resource type
  const renderThumbnail = () => {
    const size = compact ? 60 : 80;

    if (resource.resource_type === 'video' && resource.external_url) {
      return <YouTubeThumbnail url={resource.external_url} size={size} />;
    }

    if (resource.resource_type === 'image' && resource.thumbnail_url) {
      return (
        <Image
          source={{ uri: resource.thumbnail_url }}
          style={[styles.thumbnailImage, { width: size, height: size }]}
          resizeMode="cover"
        />
      );
    }

    return (
      <View style={[styles.iconContainer, { backgroundColor: config.bgColor, width: size, height: size }]}>
        <Ionicons name={config.icon as any} size={size / 2.5} color={config.color} />
      </View>
    );
  };

  // Render embedded YouTube player for video resources
  const renderVideoPlayer = () => {
    if (resource.resource_type !== 'video' || !resource.external_url) return null;

    const videoInfo = getYouTubeVideoInfo(resource.external_url);
    if (!videoInfo) return null;

    const playerWidth = SCREEN_WIDTH - spacing.base * 2 - spacing.md * 2; // Account for card padding
    const playerHeight = Math.round(playerWidth * 9 / 16);

    return (
      <YouTubePlayer
        videoId={videoInfo.videoId}
        width={playerWidth}
        height={playerHeight}
        title={resource.title || 'YouTube Video'}
      />
    );
  };

  if (compact) {
    return (
      <Pressable style={styles.compactContainer} onPress={handlePress}>
        {renderThumbnail()}
        <View style={styles.compactContent}>
          <View style={styles.compactHeader}>
            <Text style={styles.compactTitle} numberOfLines={1}>
              {resource.title}
            </Text>
            {isUnviewed && <View style={styles.unviewedDot} />}
          </View>
          <Text style={styles.compactMeta}>
            {resource.student?.name} • {formatDate(resource.created_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
      </Pressable>
    );
  }

  // For video resources, render with embedded player
  if (resource.resource_type === 'video' && !compact) {
    return (
      <View style={styles.container}>
        {/* Unviewed indicator */}
        {isUnviewed && (
          <View style={styles.unviewedBadge}>
            <Text style={styles.unviewedText}>New</Text>
          </View>
        )}

        {/* Embedded Video Player */}
        <View style={styles.videoSection}>{renderVideoPlayer()}</View>

        {/* Content */}
        <View style={styles.contentSection}>
          {/* Type Badge */}
          <View style={[styles.typeBadge, { backgroundColor: config.bgColor }]}>
            <Ionicons name={config.icon as any} size={12} color={config.color} />
            <Text style={[styles.typeLabel, { color: config.color }]}>{config.label}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {resource.title}
          </Text>

          {/* Description */}
          {resource.description && (
            <Text style={styles.description} numberOfLines={2}>
              {resource.description}
            </Text>
          )}

          {/* Meta Info */}
          <View style={styles.metaRow}>
            <View style={styles.studentInfo}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentInitial}>
                  {resource.student?.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.studentName}>{resource.student?.name || 'Unknown'}</Text>
            </View>
            <Text style={styles.date}>{formatDate(resource.created_at)}</Text>
          </View>

          {/* Open in YouTube button */}
          <Pressable style={styles.openInYouTubeButton} onPress={handleOpenInYouTube}>
            <Ionicons name="open-outline" size={16} color={colors.neutral.white} />
            <Text style={styles.openInYouTubeText}>Open in YouTube</Text>
          </Pressable>

          {/* Delete Button (for tutors) - only show when not in select mode */}
          {showDeleteButton && onDelete && !isSelectable && (
            <Pressable
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={16} color={colors.status.error} />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          )}
        </View>

        {/* Selection Checkbox Overlay */}
        {isSelectable && (
          <View style={styles.selectionOverlay}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && (
                <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
              )}
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <Pressable style={[styles.container, isSelected && styles.containerSelected]} onPress={handlePress}>
      {/* Unviewed indicator */}
      {isUnviewed && (
        <View style={styles.unviewedBadge}>
          <Text style={styles.unviewedText}>New</Text>
        </View>
      )}

      {/* Thumbnail */}
      <View style={styles.thumbnailSection}>{renderThumbnail()}</View>

      {/* Content */}
      <View style={styles.contentSection}>
        {/* Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.icon as any} size={12} color={config.color} />
          <Text style={[styles.typeLabel, { color: config.color }]}>{config.label}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {resource.title}
        </Text>

        {/* Description */}
        {resource.description && (
          <Text style={styles.description} numberOfLines={2}>
            {resource.description}
          </Text>
        )}

        {/* Meta Info */}
        <View style={styles.metaRow}>
          <View style={styles.studentInfo}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentInitial}>
                {resource.student?.name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.studentName}>{resource.student?.name || 'Unknown'}</Text>
          </View>
          <Text style={styles.date}>{formatDate(resource.created_at)}</Text>
        </View>

        {/* File Size (for PDFs and images) */}
        {resource.file_size && (
          <Text style={styles.fileSize}>{formatFileSize(resource.file_size)}</Text>
        )}

        {/* Delete Button (for tutors) - only show when not in select mode */}
        {showDeleteButton && onDelete && !isSelectable && (
          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={16} color={colors.status.error} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        )}
      </View>

      {/* Selection Checkbox Overlay */}
      {isSelectable && (
        <View style={styles.selectionOverlay}>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && (
              <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
            )}
          </View>
        </View>
      )}

      {/* Selected border highlight */}
      {isSelected && <View style={styles.selectedBorder} />}
    </Pressable>
  );
}

/**
 * List of shared resource cards
 */
export interface SharedResourceListProps {
  resources: SharedResourceWithStudent[];
  onResourcePress?: (resource: SharedResourceWithStudent) => void;
  onMarkViewed?: (id: string) => void;
  onDelete?: (resource: SharedResourceWithStudent) => void;
  showDeleteButton?: boolean;
  compact?: boolean;
  emptyMessage?: string;
  // Multi-select support
  isSelectable?: boolean;
  selectedIds?: string[];
  onSelect?: (resource: SharedResourceWithStudent) => void;
}

export function SharedResourceList({
  resources,
  onResourcePress,
  onMarkViewed,
  onDelete,
  showDeleteButton = false,
  compact = false,
  emptyMessage = 'No resources shared yet',
  isSelectable = false,
  selectedIds = [],
  onSelect,
}: SharedResourceListProps) {
  if (resources.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="folder-open-outline" size={64} color={colors.neutral.textMuted} />
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={compact ? styles.compactList : styles.list}>
      {resources.map((resource) => (
        <SharedResourceCard
          key={resource.id}
          resource={resource}
          onPress={() => onResourcePress?.(resource)}
          onMarkViewed={onMarkViewed}
          onDelete={onDelete}
          showDeleteButton={showDeleteButton}
          compact={compact}
          isSelectable={isSelectable}
          isSelected={selectedIds.includes(resource.id)}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  thumbnailSection: {
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: 0,
  },
  thumbnailImage: {
    borderRadius: borderRadius.md,
  },
  iconContainer: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Video player styles
  videoSection: {
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: 0,
  },
  videoPlayerWrapper: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.neutral.text,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  videoThumbnailFull: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 5, // Optical centering for play icon
  },
  youtubeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
  },
  openInYouTubeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#FF0000',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  openInYouTubeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  contentSection: {
    padding: spacing.md,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xs,
  },
  typeLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  studentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.piano.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInitial: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  studentName: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  date: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  fileSize: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
  unviewedBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.status.info,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    zIndex: 1,
  },
  unviewedText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    ...shadows.sm,
  },
  compactContent: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  compactTitle: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  compactMeta: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  unviewedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.info,
  },
  // List styles
  list: {
    gap: spacing.md,
  },
  compactList: {
    gap: spacing.sm,
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.status.errorBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  deleteButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },
  // Selection styles
  containerSelected: {
    borderColor: colors.piano.primary,
    borderWidth: 2,
  },
  selectionOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.piano.primary,
    borderColor: colors.piano.primary,
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.piano.primary,
    pointerEvents: 'none',
  },
});

export default SharedResourceCard;
