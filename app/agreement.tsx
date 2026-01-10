/**
 * Parent Agreement View Screen
 * Allows parents to view their signed service agreement
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../src/contexts/AuthContext';
import { useParentAgreement, Agreement } from '../src/hooks/useParentAgreement';
import AgreementContent from '../src/components/AgreementContent';
import { colors, spacing, typography, borderRadius } from '../src/theme';

export default function AgreementScreen() {
  const { parent } = useAuthContext();
  const { getAgreement, loading } = useParentAgreement();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAgreement() {
      if (!parent?.id) {
        console.log('Agreement screen: No parent ID available');
        return;
      }

      console.log('Agreement screen: Loading agreement for parent:', parent.id);

      try {
        const data = await getAgreement(parent.id);
        console.log('Agreement screen: Data received:', data ? `Found (status: ${data.status})` : 'Not found');
        setAgreement(data);
      } catch (err) {
        console.error('Agreement screen: Error loading agreement:', err);
        setLoadError('Failed to load agreement');
      }
    }

    loadAgreement();
  }, [parent?.id, getAgreement]);

  const formattedSignDate = agreement?.signatureTimestamp
    ? new Date(agreement.signatureTimestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Service Agreement',
          headerStyle: { backgroundColor: colors.primary.main },
          headerTintColor: colors.neutral.white,
          headerBackTitle: 'Back',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={styles.loadingText}>Loading agreement...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={colors.status.error} />
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : !agreement ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={colors.neutral.textMuted} />
            <Text style={styles.emptyTitle}>No Agreement Found</Text>
            <Text style={styles.emptyText}>
              You don't have a signed service agreement yet.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Status Banner */}
            <View style={[
              styles.statusBanner,
              agreement.status === 'signed' ? styles.statusSigned : styles.statusPending,
            ]}>
              <Ionicons
                name={agreement.status === 'signed' ? 'checkmark-circle' : 'time'}
                size={24}
                color={agreement.status === 'signed' ? colors.status.success : colors.status.warning}
              />
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>
                  {agreement.status === 'signed' ? 'Agreement Signed' : 'Pending Signature'}
                </Text>
                {formattedSignDate && (
                  <Text style={styles.statusDate}>Signed on {formattedSignDate}</Text>
                )}
              </View>
            </View>

            {/* Agreement Details */}
            <View style={styles.detailsCard}>
              <Text style={styles.cardTitle}>Agreement Details</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Version</Text>
                <Text style={styles.detailValue}>{agreement.agreementVersion}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>
                  {agreement.agreementType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </View>

              {agreement.signedByName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Signed By</Text>
                  <Text style={styles.detailValue}>{agreement.signedByName}</Text>
                </View>
              )}

              {agreement.signedByEmail && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{agreement.signedByEmail}</Text>
                </View>
              )}
            </View>

            {/* Signature Section */}
            {agreement.signatureData && (
              <View style={styles.signatureCard}>
                <Text style={styles.cardTitle}>Your Signature</Text>
                <View style={styles.signatureContainer}>
                  {agreement.signatureData.startsWith('data:image/') ? (
                    Platform.OS === 'web' ? (
                      <img
                        src={agreement.signatureData}
                        alt="Your signature"
                        style={{ width: '100%', height: 120, objectFit: 'contain' }}
                      />
                    ) : agreement.signatureData.startsWith('data:image/svg') ? (
                      // SVG data URLs don't render well in RN Image, show fallback with confirmation
                      <View style={styles.signatureOnFile}>
                        <Ionicons name="checkmark-circle" size={32} color={colors.status.success} />
                        <Text style={styles.signatureOnFileText}>
                          Digital signature on file
                        </Text>
                        <Text style={styles.signatureOnFileNote}>
                          Signed by {agreement.signedByName}
                        </Text>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: agreement.signatureData }}
                        style={styles.signatureImage}
                        resizeMode="contain"
                      />
                    )
                  ) : (
                    <View style={styles.invalidSignature}>
                      <Ionicons name="create-outline" size={32} color={colors.neutral.textMuted} />
                      <Text style={styles.invalidSignatureText}>
                        Signature on file
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Agreement Content */}
            <View style={styles.contentCard}>
              <Text style={styles.cardTitle}>Agreement Terms</Text>
              <View style={styles.agreementContent}>
                <AgreementContent
                  tutorName="Love to Learn Academy"
                  showVersion={true}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  statusSigned: {
    backgroundColor: colors.status.successBg,
  },
  statusPending: {
    backgroundColor: colors.status.warningBg,
  },
  statusInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  statusTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  statusDate: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  signatureCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  signatureContainer: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  signatureImage: {
    width: '100%',
    height: 120,
  },
  signatureOnFile: {
    width: '100%',
    paddingVertical: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureOnFileText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.status.success,
    marginTop: spacing.sm,
  },
  signatureOnFileNote: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  invalidSignature: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invalidSignatureText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
  },
  contentCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  agreementContent: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: spacing.md,
    backgroundColor: colors.neutral.background,
  },
});
