/**
 * Admin Agreements Screen
 * View and manage parent agreements with signature viewing
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAdminAgreements, AgreementWithParent } from '../../src/hooks/useAdmin';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

type StatusFilter = 'all' | 'signed' | 'pending' | 'expired' | 'revoked';

interface FilterButtonProps {
  label: string;
  value: StatusFilter;
  currentFilter: StatusFilter;
  count?: number;
  onPress: (value: StatusFilter) => void;
}

function FilterButton({ label, value, currentFilter, count, onPress }: FilterButtonProps) {
  const isActive = currentFilter === value;
  return (
    <TouchableOpacity
      style={[styles.filterButton, isActive && styles.filterButtonActive]}
      onPress={() => onPress(value)}
    >
      <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
        {label}
        {count !== undefined && ` (${count})`}
      </Text>
    </TouchableOpacity>
  );
}

interface AgreementCardProps {
  agreement: AgreementWithParent;
  onPress: () => void;
}

function AgreementCard({ agreement, onPress }: AgreementCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed':
        return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'pending':
        return { bg: '#FFF8E1', text: '#F57C00' };
      case 'expired':
        return { bg: '#FFEBEE', text: '#C62828' };
      case 'revoked':
        return { bg: '#ECEFF1', text: '#546E7A' };
      default:
        return { bg: colors.neutral.background, text: colors.neutral.textMuted };
    }
  };

  const statusColors = getStatusColor(agreement.status);
  const formattedDate = agreement.signatureTimestamp
    ? new Date(agreement.signatureTimestamp).toLocaleDateString()
    : new Date(agreement.createdAt).toLocaleDateString();

  return (
    <TouchableOpacity style={styles.agreementCard} onPress={onPress}>
      <View style={styles.agreementHeader}>
        <View style={styles.agreementInfo}>
          <Text style={styles.parentName}>{agreement.parentName}</Text>
          <Text style={styles.parentEmail}>{agreement.parentEmail}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.agreementDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="document-text-outline" size={16} color={colors.neutral.textMuted} />
          <Text style={styles.detailText}>Version {agreement.agreementVersion}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.neutral.textMuted} />
          <Text style={styles.detailText}>
            {agreement.status === 'signed' ? 'Signed ' : 'Created '}
            {formattedDate}
          </Text>
        </View>
        {agreement.signedByName && (
          <View style={styles.detailRow}>
            <Ionicons name="create-outline" size={16} color={colors.neutral.textMuted} />
            <Text style={styles.detailText}>Signed by: {agreement.signedByName}</Text>
          </View>
        )}
      </View>

      <View style={styles.viewButton}>
        <Text style={styles.viewButtonText}>View Details</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary.main} />
      </View>
    </TouchableOpacity>
  );
}

interface AgreementDetailModalProps {
  visible: boolean;
  agreement: AgreementWithParent | null;
  onClose: () => void;
}

function AgreementDetailModal({ visible, agreement, onClose }: AgreementDetailModalProps) {
  if (!agreement) return null;

  const formattedSignDate = agreement.signatureTimestamp
    ? new Date(agreement.signatureTimestamp).toLocaleString()
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Agreement Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
          {/* Parent Info */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Parent Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{agreement.parentName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{agreement.parentEmail}</Text>
            </View>
          </View>

          {/* Agreement Info */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Agreement Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[
                styles.infoValue,
                { color: agreement.status === 'signed' ? '#2E7D32' : '#F57C00' }
              ]}>
                {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>{agreement.agreementVersion}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>
                {agreement.agreementType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>
                {new Date(agreement.createdAt).toLocaleString()}
              </Text>
            </View>
            {formattedSignDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Signed</Text>
                <Text style={styles.infoValue}>{formattedSignDate}</Text>
              </View>
            )}
            {agreement.signedByName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Signed By</Text>
                <Text style={styles.infoValue}>{agreement.signedByName}</Text>
              </View>
            )}
          </View>

          {/* Signature */}
          {agreement.signatureData && (
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Digital Signature</Text>
              <View style={styles.signatureContainer}>
                {/* Check if signature data is valid (starts with data:image/) */}
                {agreement.signatureData.startsWith('data:image/') ? (
                  Platform.OS === 'web' ? (
                    <img
                      src={agreement.signatureData}
                      alt="Signature"
                      style={{ width: '100%', height: 150, objectFit: 'contain' }}
                    />
                  ) : (
                    <Image
                      source={{ uri: agreement.signatureData }}
                      style={styles.signatureImage}
                      resizeMode="contain"
                    />
                  )
                ) : (
                  // Invalid signature data - show fallback message
                  <View style={styles.invalidSignature}>
                    <Ionicons name="create-outline" size={32} color={colors.neutral.textMuted} />
                    <Text style={styles.invalidSignatureText}>
                      Signature captured (display unavailable)
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.signatureNote}>
                This digital signature was captured on {formattedSignDate}
              </Text>
            </View>
          )}

          {/* No signature message */}
          {!agreement.signatureData && agreement.status === 'pending' && (
            <View style={styles.pendingMessage}>
              <Ionicons name="time-outline" size={32} color="#F57C00" />
              <Text style={styles.pendingMessageText}>
                Waiting for parent to sign this agreement
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function AdminAgreements() {
  const { agreements, loading, error, refetch } = useAdminAgreements();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementWithParent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch(statusFilter === 'all' ? undefined : statusFilter);
    setRefreshing(false);
  };

  const handleFilterChange = useCallback((filter: StatusFilter) => {
    setStatusFilter(filter);
    refetch(filter === 'all' ? undefined : filter);
  }, [refetch]);

  const handleAgreementPress = (agreement: AgreementWithParent) => {
    setSelectedAgreement(agreement);
    setModalVisible(true);
  };

  const filteredAgreements = statusFilter === 'all'
    ? agreements
    : agreements.filter(a => a.status === statusFilter);

  // Count by status
  const counts = {
    all: agreements.length,
    signed: agreements.filter(a => a.status === 'signed').length,
    pending: agreements.filter(a => a.status === 'pending').length,
    expired: agreements.filter(a => a.status === 'expired').length,
    revoked: agreements.filter(a => a.status === 'revoked').length,
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading agreements...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filters}>
            <FilterButton
              label="All"
              value="all"
              currentFilter={statusFilter}
              count={counts.all}
              onPress={handleFilterChange}
            />
            <FilterButton
              label="Signed"
              value="signed"
              currentFilter={statusFilter}
              count={counts.signed}
              onPress={handleFilterChange}
            />
            <FilterButton
              label="Pending"
              value="pending"
              currentFilter={statusFilter}
              count={counts.pending}
              onPress={handleFilterChange}
            />
            <FilterButton
              label="Expired"
              value="expired"
              currentFilter={statusFilter}
              count={counts.expired}
              onPress={handleFilterChange}
            />
            <FilterButton
              label="Revoked"
              value="revoked"
              currentFilter={statusFilter}
              count={counts.revoked}
              onPress={handleFilterChange}
            />
          </View>
        </ScrollView>
      </View>

      {/* Error State */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color="#C62828" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Agreements List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredAgreements.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={colors.neutral.textMuted} />
            <Text style={styles.emptyStateTitle}>No Agreements</Text>
            <Text style={styles.emptyStateText}>
              {statusFilter === 'all'
                ? 'No parent agreements have been created yet.'
                : `No ${statusFilter} agreements found.`}
            </Text>
          </View>
        ) : (
          filteredAgreements.map(agreement => (
            <AgreementCard
              key={agreement.id}
              agreement={agreement}
              onPress={() => handleAgreementPress(agreement)}
            />
          ))
        )}
      </ScrollView>

      {/* Detail Modal */}
      <AgreementDetailModal
        visible={modalVisible}
        agreement={selectedAgreement}
        onClose={() => {
          setModalVisible(false);
          setSelectedAgreement(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  filtersContainer: {
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  filters: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  filterButtonActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  filterButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  filterButtonTextActive: {
    color: colors.neutral.white,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: '#C62828',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
  },
  emptyStateTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  agreementCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  agreementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  agreementInfo: {
    flex: 1,
  },
  parentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  parentEmail: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  agreementDetails: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    gap: spacing.xs,
  },
  viewButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary.main,
    fontWeight: typography.weights.medium,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  modalSection: {
    marginBottom: spacing.xl,
  },
  modalSectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  infoValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  signatureContainer: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  signatureImage: {
    width: '100%',
    height: 150,
  },
  invalidSignature: {
    width: '100%',
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
  },
  invalidSignatureText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  signatureNote: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  pendingMessage: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.lg,
  },
  pendingMessageText: {
    fontSize: typography.sizes.base,
    color: '#F57C00',
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
