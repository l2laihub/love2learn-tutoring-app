/**
 * MessageThreadList Component
 * FlatList of message thread cards
 */

import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../../theme';
import { ThreadWithPreview } from '../../types/messages';
import { MessageThreadCard } from './MessageThreadCard';

interface MessageThreadListProps {
  threads: ThreadWithPreview[];
  loading: boolean;
  error: Error | null;
  onRefresh: () => Promise<void>;
  ListHeaderComponent?: React.ReactElement;
  // Selection mode props
  isSelectionMode?: boolean;
  selectedThreadIds?: Set<string>;
  onToggleSelect?: (threadId: string) => void;
}

export function MessageThreadList({
  threads,
  loading,
  error,
  onRefresh,
  ListHeaderComponent,
  isSelectionMode = false,
  selectedThreadIds,
  onToggleSelect,
}: MessageThreadListProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const handleThreadPress = (threadId: string) => {
    router.push(`/messages/${threadId}`);
  };

  const renderItem = ({ item }: { item: ThreadWithPreview }) => (
    <MessageThreadCard
      thread={item}
      onPress={() => handleThreadPress(item.id)}
      isSelectionMode={isSelectionMode}
      isSelected={selectedThreadIds?.has(item.id)}
      onToggleSelect={onToggleSelect}
    />
  );

  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load messages</Text>
          <Text style={styles.errorSubtext}>{error.message}</Text>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptySubtext}>
          Messages and announcements will appear here
        </Text>
      </View>
    );
  };

  return (
    <FlatList
      data={threads}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={renderEmptyComponent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary.main]}
          tintColor={colors.primary.main}
        />
      }
      contentContainerStyle={threads.length === 0 ? styles.emptyContainer : undefined}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.neutral.textMuted,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent.main,
    marginBottom: spacing.xs,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
});
