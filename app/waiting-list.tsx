/**
 * Waiting List Screen (tutor)
 * Manage inquiries from prospective parents. Surfaces the public share link.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../src/contexts/AuthContext';
import {
  useWaitingList,
  useUpdateWaitingListEntry,
  useDeleteWaitingListEntry,
} from '../src/hooks/useWaitingList';
import { WaitingListCard } from '../src/components/waiting-list/WaitingListCard';
import { WaitingListEntry, WaitingListStatus } from '../src/types/database';
import { colors, spacing, typography, borderRadius } from '../src/theme';

type TabKey = 'new' | 'active' | 'closed';

const TAB_STATUSES: Record<TabKey, WaitingListStatus[]> = {
  new: ['new'],
  active: ['contacted', 'waitlisted'],
  closed: ['converted', 'declined'],
};

// Public app host used to build the share link. Falls back to the known prod host.
const APP_HOST =
  process.env.EXPO_PUBLIC_APP_URL || 'https://app.lovetolearn.site';

export default function WaitingListScreen() {
  const { parent } = useAuthContext();
  const [tab, setTab] = useState<TabKey>('new');
  const { data, loading, error, refetch } = useWaitingList({
    statuses: TAB_STATUSES[tab],
  });
  const { updateEntry } = useUpdateWaitingListEntry();
  const { deleteEntry } = useDeleteWaitingListEntry();

  const [notesEntry, setNotesEntry] = useState<WaitingListEntry | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const shareUrl = parent?.id ? `${APP_HOST}/inquire/${parent.id}` : '';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    if (Platform.OS === 'web') {
      // Alert on web is unreliable; rely on the toast-free confirmation.
      console.log('Inquiry link copied');
    }
    Alert.alert('Copied', 'Your inquiry link was copied to the clipboard.');
  }, [shareUrl]);

  const advance = useCallback(
    async (entry: WaitingListEntry, next: WaitingListStatus) => {
      const ok = await updateEntry(entry.id, { status: next });
      if (ok) refetch();
    },
    [updateEntry, refetch]
  );

  const openNotes = useCallback((entry: WaitingListEntry) => {
    setNotesEntry(entry);
    setNotesDraft(entry.tutor_notes || '');
  }, []);

  const saveNotes = useCallback(async () => {
    if (!notesEntry) return;
    const ok = await updateEntry(notesEntry.id, { tutor_notes: notesDraft.trim() || null });
    setNotesEntry(null);
    if (ok) refetch();
  }, [notesEntry, notesDraft, updateEntry, refetch]);

  const remove = useCallback(
    (entry: WaitingListEntry) => {
      Alert.alert('Remove inquiry', `Remove ${entry.parent_name} from the list?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteEntry(entry.id);
            if (ok) refetch();
          },
        },
      ]);
    },
    [deleteEntry, refetch]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Waiting List' }} />

      {/* Share link */}
      <View style={styles.shareCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shareTitle}>Your inquiry link</Text>
          <Text style={styles.shareUrl} numberOfLines={1}>
            {shareUrl || '—'}
          </Text>
        </View>
        <Pressable style={styles.copyBtn} onPress={copyLink} disabled={!shareUrl}>
          <Ionicons name="copy-outline" size={18} color={colors.neutral.white} />
          <Text style={styles.copyText}>Copy</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(Object.keys(TAB_STATUSES) as TabKey[]).map((key) => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'new' ? 'New' : key === 'active' ? 'Active' : 'Closed'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator
            style={{ marginTop: spacing.xl }}
            color={colors.primary.main}
          />
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={48} color="#E53935" />
            <Text style={styles.emptyText}>{error.message}</Text>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="hourglass-outline" size={48} color={colors.neutral.textSecondary} />
            <Text style={styles.emptyTitle}>No inquiries here</Text>
            <Text style={styles.emptyText}>
              Share your inquiry link so new parents can reach you.
            </Text>
          </View>
        ) : (
          data.map((entry) => (
            <WaitingListCard
              key={entry.id}
              entry={entry}
              onAdvance={advance}
              onEditNotes={openNotes}
              onDelete={remove}
            />
          ))
        )}
      </ScrollView>

      {/* Notes modal */}
      <Modal visible={!!notesEntry} transparent animationType="fade" onRequestClose={() => setNotesEntry(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder="Private notes about this inquiry"
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setNotesEntry(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={saveNotes}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.background },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  shareTitle: { fontSize: typography.sizes.xs, color: colors.neutral.textSecondary },
  shareUrl: { fontSize: typography.sizes.base, color: colors.neutral.text, marginTop: 2 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  copyText: { color: colors.neutral.white, fontWeight: typography.weights.semibold },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.white,
  },
  tabActive: { backgroundColor: colors.primary.main },
  tabText: { fontSize: typography.sizes.base, color: colors.neutral.text },
  tabTextActive: { color: colors.neutral.white, fontWeight: typography.weights.semibold },
  list: { padding: spacing.md, flexGrow: 1 },
  empty: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm },
  emptyTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.neutral.text },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: { backgroundColor: colors.neutral.white, borderRadius: borderRadius.lg, padding: spacing.lg },
  modalTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.neutral.text, marginBottom: spacing.md },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.neutral.text,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  modalCancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  modalCancelText: { color: colors.neutral.textSecondary, fontWeight: typography.weights.semibold },
  modalSave: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  modalSaveText: { color: colors.neutral.white, fontWeight: typography.weights.semibold },
});
