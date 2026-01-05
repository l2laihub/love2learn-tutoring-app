/**
 * Resources Screen
 * Parent view for shared resources (worksheets, PDFs, images, videos)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useParentByUserId } from '../../src/hooks/useParents';
import { useStudentsByParent } from '../../src/hooks/useStudents';
import {
  useParentSharedResources,
  useUnviewedResourceCount,
  useMarkResourceViewed,
} from '../../src/hooks/useSharedResources';
import { SharedResourceCard, SharedResourceList } from '../../src/components/SharedResourceCard';
import { SessionMediaGallery } from '../../src/components/SessionMediaGallery';
import { ResourceViewerModal } from '../../src/components/ResourceViewerModal';
import { SharedResourceWithStudent, ResourceType } from '../../src/types/database';

type ViewMode = 'list' | 'gallery';
type ResourceFilter = 'all' | 'worksheet' | 'pdf' | 'image' | 'video';

const FILTER_OPTIONS: { value: ResourceFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'apps' },
  { value: 'worksheet', label: 'Worksheets', icon: 'document-text' },
  { value: 'pdf', label: 'PDFs', icon: 'document' },
  { value: 'image', label: 'Images', icon: 'image' },
  { value: 'video', label: 'Videos', icon: 'videocam' },
];

export default function ResourcesScreen() {
  const { user } = useAuthContext();
  const { data: parent, loading: parentLoading } = useParentByUserId(user?.id || null);
  const { data: children } = useStudentsByParent(parent?.id || null);

  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('all');
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedResource, setSelectedResource] = useState<SharedResourceWithStudent | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  // Debug log
  React.useEffect(() => {
    console.log('[ResourcesScreen] Parent data:', { userId: user?.id, parentId: parent?.id, parentName: parent?.name });
  }, [user?.id, parent?.id, parent?.name]);

  // Fetch resources
  const resourceType = resourceFilter === 'all' ? undefined : (resourceFilter as ResourceType);
  const { data: resources, loading: resourcesLoading, error: resourcesError, refetch } = useParentSharedResources(
    parent?.id || null,
    resourceType
  );
  const { count: unviewedCount } = useUnviewedResourceCount(parent?.id || null);
  const { mutate: markViewed } = useMarkResourceViewed();

  // Filter by child
  const filteredResources = React.useMemo(() => {
    if (!selectedChild) return resources;
    return resources.filter((r) => r.student_id === selectedChild);
  }, [resources, selectedChild]);

  // Separate resources by type for gallery view
  const imageResources = React.useMemo(
    () => filteredResources.filter((r) => r.resource_type === 'image'),
    [filteredResources]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleResourcePress = useCallback(
    (resource: SharedResourceWithStudent) => {
      setSelectedResource(resource);
      setShowViewer(true);
    },
    []
  );

  const handleCloseViewer = useCallback(() => {
    setShowViewer(false);
    setSelectedResource(null);
  }, []);

  const handleMarkViewed = useCallback(
    async (id: string) => {
      await markViewed(id);
    },
    [markViewed]
  );

  if (parentLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.piano.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Shared Resources</Text>
          {unviewedCount > 0 && (
            <View style={styles.unviewedBadge}>
              <Text style={styles.unviewedBadgeText}>{unviewedCount} New</Text>
            </View>
          )}
        </View>

        {/* Child Filter (if multiple children) */}
        {children && children.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.childFilter}
            contentContainerStyle={styles.childFilterContent}
          >
            <Pressable
              style={[styles.filterChip, selectedChild === null && styles.filterChipActive]}
              onPress={() => setSelectedChild(null)}
            >
              <Text
                style={[styles.filterChipText, selectedChild === null && styles.filterChipTextActive]}
              >
                All Kids
              </Text>
            </Pressable>
            {children.map((child) => (
              <Pressable
                key={child.id}
                style={[styles.filterChip, selectedChild === child.id && styles.filterChipActive]}
                onPress={() => setSelectedChild(child.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedChild === child.id && styles.filterChipTextActive,
                  ]}
                >
                  {child.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Resource Type Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeFilter}
          contentContainerStyle={styles.typeFilterContent}
        >
          {FILTER_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.typeChip, resourceFilter === option.value && styles.typeChipActive]}
              onPress={() => setResourceFilter(option.value)}
            >
              <Ionicons
                name={option.icon as any}
                size={16}
                color={
                  resourceFilter === option.value ? colors.piano.primary : colors.neutral.textMuted
                }
              />
              <Text
                style={[
                  styles.typeChipText,
                  resourceFilter === option.value && styles.typeChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* View Toggle (only for images) */}
        {resourceFilter === 'image' && (
          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons
                name="list"
                size={18}
                color={viewMode === 'list' ? colors.piano.primary : colors.neutral.textMuted}
              />
            </Pressable>
            <Pressable
              style={[styles.viewToggleButton, viewMode === 'gallery' && styles.viewToggleButtonActive]}
              onPress={() => setViewMode('gallery')}
            >
              <Ionicons
                name="grid"
                size={18}
                color={viewMode === 'gallery' ? colors.piano.primary : colors.neutral.textMuted}
              />
            </Pressable>
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {resourcesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.piano.primary} />
            <Text style={styles.loadingText}>Loading resources...</Text>
          </View>
        ) : resourcesError ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="alert-circle-outline" size={64} color={colors.status.error} />
            </View>
            <Text style={styles.emptyTitle}>Error Loading Resources</Text>
            <Text style={styles.emptySubtitle}>
              {resourcesError.message || 'Unable to load shared resources. Please try again.'}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => refetch()}>
              <Ionicons name="refresh" size={18} color={colors.neutral.white} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredResources.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="folder-open-outline" size={64} color={colors.neutral.border} />
            </View>
            <Text style={styles.emptyTitle}>No Resources Yet</Text>
            <Text style={styles.emptySubtitle}>
              {resourceFilter !== 'all'
                ? `No ${resourceFilter}s have been shared yet.`
                : 'Your tutor will share worksheets, images, and videos here.'}
            </Text>
          </View>
        ) : resourceFilter === 'image' && viewMode === 'gallery' ? (
          /* Gallery View for Images */
          <SessionMediaGallery
            resources={imageResources}
            onImagePress={handleResourcePress}
            emptyMessage="No images shared yet"
          />
        ) : (
          /* List View */
          <SharedResourceList
            resources={filteredResources}
            onResourcePress={handleResourcePress}
            onMarkViewed={handleMarkViewed}
            compact={false}
            emptyMessage="No resources found"
          />
        )}
      </ScrollView>

      {/* Resource Viewer Modal */}
      <ResourceViewerModal
        visible={showViewer}
        resource={selectedResource}
        onClose={handleCloseViewer}
        onMarkViewed={handleMarkViewed}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  unviewedBadge: {
    backgroundColor: colors.status.info,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  unviewedBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  childFilter: {
    marginBottom: spacing.sm,
  },
  childFilterContent: {
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  filterChipActive: {
    backgroundColor: colors.piano.primary,
    borderColor: colors.piano.primary,
  },
  filterChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  filterChipTextActive: {
    color: colors.neutral.white,
  },
  typeFilter: {
    marginBottom: spacing.sm,
  },
  typeFilterContent: {
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.background,
  },
  typeChipActive: {
    backgroundColor: colors.piano.subtle,
  },
  typeChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textMuted,
  },
  typeChipTextActive: {
    color: colors.piano.primary,
  },
  viewToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: 2,
  },
  viewToggleButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  viewToggleButtonActive: {
    backgroundColor: colors.neutral.white,
    ...shadows.sm,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'] * 2,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'] * 2,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.piano.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
    ...shadows.md,
  },
  retryButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});
