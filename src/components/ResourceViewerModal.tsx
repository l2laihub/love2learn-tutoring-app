/**
 * ResourceViewerModal
 * Modal for viewing shared resources (PDFs, images, videos)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { SharedResourceWithStudent, ResourceType } from '../types/database';
import { YouTubePlayer } from './YouTubePlayer';
import { getYouTubeVideoInfo } from '../utils/youtube';
import { supabase } from '../lib/supabase';
import { STORAGE_BUCKETS } from '../hooks/useFileUpload';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ResourceViewerModalProps {
  visible: boolean;
  resource: SharedResourceWithStudent | null;
  onClose: () => void;
  onMarkViewed?: (id: string) => void;
}

export function ResourceViewerModal({
  visible,
  resource,
  onClose,
  onMarkViewed,
}: ResourceViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch public URL for storage files
  const fetchResourceUrl = useCallback(async () => {
    console.log('[ResourceViewerModal] fetchResourceUrl called with:', {
      storage_path: resource?.storage_path,
      thumbnail_url: resource?.thumbnail_url,
      resource_type: resource?.resource_type,
    });

    // If we have thumbnail_url, use it directly - it's already a working public URL
    if (resource?.thumbnail_url) {
      console.log('[ResourceViewerModal] Using thumbnail_url directly:', resource.thumbnail_url);

      if (resource.resource_type === 'image') {
        setImageUrl(resource.thumbnail_url);
      } else {
        setPdfUrl(resource.thumbnail_url);
      }

      if (!resource.viewed_at && onMarkViewed) {
        onMarkViewed(resource.id);
      }
      return;
    }

    // If no thumbnail_url but we have storage_path, try to construct URL
    if (!resource?.storage_path) {
      console.log('[ResourceViewerModal] No storage_path or thumbnail_url available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine the correct bucket based on resource type and mime type
      let bucket: string;
      if (resource.resource_type === 'image') {
        bucket = STORAGE_BUCKETS.SESSION_MEDIA;
      } else if (resource.resource_type === 'pdf' || resource.resource_type === 'worksheet') {
        bucket = STORAGE_BUCKETS.WORKSHEETS;
      } else if (resource.mime_type?.startsWith('image/')) {
        bucket = STORAGE_BUCKETS.SESSION_MEDIA;
      } else {
        bucket = STORAGE_BUCKETS.WORKSHEETS;
      }

      console.log('[ResourceViewerModal] Using bucket:', bucket, 'for resource type:', resource.resource_type);

      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(resource.storage_path);

      let workingUrl: string | null = data?.publicUrl || null;

      if (workingUrl) {
        console.log('[ResourceViewerModal] Using constructed URL:', workingUrl);

        if (resource.resource_type === 'image') {
          setImageUrl(workingUrl);
        } else {
          setPdfUrl(workingUrl);
        }

        if (!resource.viewed_at && onMarkViewed) {
          onMarkViewed(resource.id);
        }
      } else {
        throw new Error('Could not construct public URL');
      }
    } catch (err) {
      console.error('[ResourceViewerModal] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load resource');
    } finally {
      setLoading(false);
    }
  }, [resource, onMarkViewed]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible && resource) {
      setImageUrl(null);
      setPdfUrl(null);
      setError(null);

      if (resource.resource_type === 'video') {
        // Videos use external URLs, no need to fetch
        if (!resource.viewed_at && onMarkViewed) {
          onMarkViewed(resource.id);
        }
      } else if (resource.storage_path || resource.thumbnail_url) {
        // Fetch URL for images and PDFs (using thumbnail_url or storage_path)
        fetchResourceUrl();
      }
    }
  }, [visible, resource, fetchResourceUrl, onMarkViewed]);

  // Handle opening video in browser/YouTube app
  const handleOpenVideo = async () => {
    if (!resource?.external_url) return;

    try {
      const canOpen = await Linking.canOpenURL(resource.external_url);
      if (canOpen) {
        await Linking.openURL(resource.external_url);
      } else {
        Alert.alert('Error', 'Unable to open video link');
      }
    } catch (err) {
      console.error('Error opening video:', err);
      Alert.alert('Error', 'Failed to open video');
    }
  };

  // Handle opening PDF in browser
  const handleOpenPdf = async () => {
    if (!pdfUrl) return;

    try {
      const canOpen = await Linking.canOpenURL(pdfUrl);
      if (canOpen) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('Error', 'Unable to open PDF');
      }
    } catch (err) {
      console.error('Error opening PDF:', err);
      Alert.alert('Error', 'Failed to open PDF');
    }
  };

  // Handle downloading/sharing file
  const handleDownload = async () => {
    // Use already loaded URL or thumbnail_url
    const downloadUrl = imageUrl || pdfUrl || resource?.thumbnail_url;

    if (!downloadUrl) {
      Alert.alert('Error', 'No download URL available');
      return;
    }

    console.log('[ResourceViewerModal] Download - using URL:', downloadUrl);

    setDownloading(true);

    try {
      if (Platform.OS === 'web') {
        // On web, open in new tab
        window.open(downloadUrl, '_blank');
      } else {
        // On native, download and share
        const canShare = await Sharing.isAvailableAsync();

        if (canShare && resource?.storage_path) {
          // Download file first
          const fileName = resource.storage_path.split('/').pop() || 'file';
          const fileUri = LegacyFileSystem.cacheDirectory + fileName;

          const downloadResult = await LegacyFileSystem.downloadAsync(
            downloadUrl,
            fileUri
          );

          if (downloadResult.status === 200) {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: resource?.mime_type || 'application/octet-stream',
              dialogTitle: `Share ${resource?.title || 'Resource'}`,
            });
          } else {
            throw new Error('Download failed');
          }
        } else {
          // Fallback: open in browser
          await Linking.openURL(downloadUrl);
        }
      }
    } catch (err) {
      console.error('Error downloading:', err);
      Alert.alert('Error', 'Failed to download file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Get resource type config
  const getTypeConfig = (type: ResourceType) => {
    switch (type) {
      case 'worksheet':
        return { icon: 'document-text', label: 'Worksheet', color: colors.piano.primary };
      case 'pdf':
        return { icon: 'document', label: 'PDF Document', color: colors.math.primary };
      case 'image':
        return { icon: 'image', label: 'Image', color: colors.status.info };
      case 'video':
        return { icon: 'logo-youtube', label: 'Video', color: '#FF0000' };
      default:
        return { icon: 'document-outline', label: 'Resource', color: colors.neutral.text };
    }
  };

  if (!resource) return null;

  const typeConfig = getTypeConfig(resource.resource_type);

  // Render content based on resource type
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.piano.primary} />
          <Text style={styles.loadingText}>Loading resource...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchResourceUrl}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    switch (resource.resource_type) {
      case 'video': {
        const videoInfo = resource.external_url ? getYouTubeVideoInfo(resource.external_url) : null;
        const playerWidth = SCREEN_WIDTH - spacing.base * 2;
        const playerHeight = Math.round(playerWidth * 9 / 16);

        return (
          <View style={styles.videoContainer}>
            {/* Embedded YouTube Player */}
            {videoInfo && (
              <YouTubePlayer
                videoId={videoInfo.videoId}
                width={playerWidth}
                height={playerHeight}
                title={resource.title || 'YouTube Video'}
              />
            )}

            {/* Open in YouTube button */}
            <Pressable style={styles.openExternalButton} onPress={handleOpenVideo}>
              <Ionicons name="open-outline" size={20} color={colors.neutral.white} />
              <Text style={styles.openExternalButtonText}>Open in YouTube</Text>
            </Pressable>
          </View>
        );
      }

      case 'image':
        return (
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons name="image-outline" size={64} color={colors.neutral.textMuted} />
                <Text style={styles.placeholderText}>Unable to load image</Text>
              </View>
            )}
          </View>
        );

      case 'pdf':
      case 'worksheet':
        return (
          <View style={styles.pdfContainer}>
            <View style={styles.pdfIcon}>
              <Ionicons name="document" size={80} color={typeConfig.color} />
            </View>
            <Text style={styles.pdfTitle}>{resource.title}</Text>
            {resource.file_size && (
              <Text style={styles.pdfSize}>
                {(resource.file_size / 1024 / 1024).toFixed(2)} MB
              </Text>
            )}
            <Text style={styles.pdfHint}>
              Tap the button below to view or download this document
            </Text>
            {pdfUrl && (
              <Pressable style={styles.viewPdfButton} onPress={handleOpenPdf}>
                <Ionicons name="eye-outline" size={20} color={colors.neutral.white} />
                <Text style={styles.viewPdfButtonText}>View PDF</Text>
              </Pressable>
            )}
          </View>
        );

      default:
        return (
          <View style={styles.placeholderContainer}>
            <Ionicons name="document-outline" size={64} color={colors.neutral.textMuted} />
            <Text style={styles.placeholderText}>Unknown resource type</Text>
          </View>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '20' }]}>
              <Ionicons name={typeConfig.icon as any} size={14} color={typeConfig.color} />
              <Text style={[styles.typeLabel, { color: typeConfig.color }]}>
                {typeConfig.label}
              </Text>
            </View>
          </View>
          {resource.storage_path && (
            <Pressable
              style={styles.downloadButton}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.piano.primary} />
              ) : (
                <Ionicons name="download-outline" size={24} color={colors.piano.primary} />
              )}
            </Pressable>
          )}
          {!resource.storage_path && <View style={styles.headerSpacer} />}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {renderContent()}

          {/* Details Section */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsTitle}>{resource.title}</Text>
            {resource.description && (
              <Text style={styles.detailsDescription}>{resource.description}</Text>
            )}

            <View style={styles.metaInfo}>
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={16} color={colors.neutral.textMuted} />
                <Text style={styles.metaText}>For: {resource.student?.name || 'Unknown'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.neutral.textMuted} />
                <Text style={styles.metaText}>
                  Shared: {new Date(resource.created_at).toLocaleDateString()}
                </Text>
              </View>
              {resource.viewed_at && (
                <View style={styles.metaRow}>
                  <Ionicons name="eye-outline" size={16} color={colors.status.success} />
                  <Text style={[styles.metaText, { color: colors.status.success }]}>
                    Viewed: {new Date(resource.viewed_at).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer Action */}
        {resource.storage_path && (
          <View style={styles.footer}>
            <Pressable
              style={[styles.footerButton, downloading && styles.footerButtonDisabled]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={20} color={colors.neutral.white} />
                  <Text style={styles.footerButtonText}>Download & Share</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  typeLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  downloadButton: {
    padding: spacing.xs,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    padding: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  errorContainer: {
    padding: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.status.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.piano.primary,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  videoContainer: {
    padding: spacing.base,
    alignItems: 'center',
  },
  videoPlayerContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.neutral.text,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  videoThumbnailContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  videoThumbnail: {
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6, // Optical centering for play icon
  },
  youtubeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
  },
  openExternalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FF0000',
    borderRadius: borderRadius.lg,
  },
  openExternalButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.text,
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.5,
  },
  placeholderContainer: {
    padding: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
  pdfContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  pdfIcon: {
    width: 140,
    height: 140,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.math.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  pdfTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  pdfSize: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
  },
  pdfHint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  viewPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.math.primary,
    borderRadius: borderRadius.lg,
  },
  viewPdfButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  detailsSection: {
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    marginTop: spacing.md,
  },
  detailsTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  detailsDescription: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  metaInfo: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  footerButtonDisabled: {
    opacity: 0.6,
  },
  footerButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default ResourceViewerModal;
