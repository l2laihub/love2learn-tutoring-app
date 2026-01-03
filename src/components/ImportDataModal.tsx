/**
 * ImportDataModal Component
 * Modal for importing students and parents from Google Sheets
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useImportData, ImportRow, ImportProgress } from '../hooks/useImportData';
import { colors, spacing, typography, borderRadius } from '../theme';

interface ImportDataModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportDataModal({ visible, onClose, onSuccess }: ImportDataModalProps) {
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');

  const {
    loading,
    parsing,
    error,
    preview,
    result,
    progress,
    fetchPreview,
    importData,
    reset,
  } = useImportData();

  const handleClose = () => {
    setSheetsUrl('');
    setStep('input');
    reset();
    onClose();
  };

  const handleFetchPreview = async () => {
    const rows = await fetchPreview(sheetsUrl);
    if (rows.length > 0) {
      setStep('preview');
    }
  };

  const handleImport = async () => {
    const importResult = await importData(preview);
    setStep('result');
    if (importResult.success || importResult.studentsCreated > 0 || importResult.parentsCreated > 0) {
      onSuccess();
    }
  };

  const handleDone = () => {
    handleClose();
  };

  const renderInputStep = () => (
    <>
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Import from Google Sheets</Text>
        <Text style={styles.instructionsText}>
          Create a Google Sheet with these columns:
        </Text>
        <View style={styles.columnsBox}>
          <Text style={styles.columnText}>Parent Name | Parent Email | Parent Phone | Student Name | Student Age | Student Grade | Subjects</Text>
        </View>
        <Text style={styles.instructionsSubtext}>
          Subjects column accepts: "Piano", "Math", or "Both"
        </Text>
        <Text style={styles.instructionsNote}>
          Make sure your spreadsheet is set to "Anyone with the link can view"
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Google Sheets URL</Text>
        <TextInput
          style={styles.input}
          value={sheetsUrl}
          onChangeText={setSheetsUrl}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, (!sheetsUrl || parsing) && styles.buttonDisabled]}
          onPress={handleFetchPreview}
          disabled={!sheetsUrl || parsing}
        >
          {parsing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Preview Data</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderPreviewStep = () => (
    <>
      <View style={styles.previewHeader}>
        <Text style={styles.previewTitle}>Preview Import</Text>
        <Text style={styles.previewSubtitle}>
          Found {preview.length} record{preview.length !== 1 ? 's' : ''} to import
        </Text>
      </View>

      <ScrollView style={styles.previewList} nestedScrollEnabled>
        {preview.map((row, index) => (
          <View key={index} style={styles.previewRow}>
            <View style={styles.previewRowHeader}>
              <Ionicons name="person" size={16} color={colors.math.primary} />
              <Text style={styles.previewParentName}>{row.parentName}</Text>
            </View>
            <Text style={styles.previewEmail}>{row.parentEmail}</Text>
            <View style={styles.previewStudentRow}>
              <Ionicons name="school-outline" size={14} color={colors.piano.primary} />
              <Text style={styles.previewStudentText}>
                {row.studentName} (Age {row.studentAge}, Grade {row.studentGrade})
              </Text>
            </View>
            <View style={styles.previewSubjectsRow}>
              {row.subjects.map((subject) => (
                <View
                  key={subject}
                  style={[
                    styles.subjectBadge,
                    subject === 'piano' ? styles.pianoBadge : styles.mathBadge,
                  ]}
                >
                  <Text style={styles.subjectBadgeText}>
                    {subject.charAt(0).toUpperCase() + subject.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {loading && progress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              Importing {progress.current} of {progress.total}...
            </Text>
            <Text style={styles.progressPercentage}>
              {Math.round((progress.current / progress.total) * 100)}%
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(progress.current / progress.total) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressCurrentItem} numberOfLines={1}>
            {progress.currentItem}
          </Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.cancelButton, loading && styles.buttonDisabled]}
          onPress={() => setStep('input')}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingButtonContent}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.primaryButtonText}>
                {progress ? ` ${progress.current}/${progress.total}` : ' Importing...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>Import {preview.length} Records</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderResultStep = () => {
    if (!result) return null;

    const hasCreated = result.parentsCreated > 0 || result.studentsCreated > 0;

    return (
      <>
        <View style={styles.resultHeader}>
          <Ionicons
            name={hasCreated ? 'checkmark-circle' : 'alert-circle'}
            size={48}
            color={hasCreated ? colors.status.success : colors.status.error}
          />
          <Text style={styles.resultTitle}>
            {hasCreated ? 'Import Complete!' : 'Import Failed'}
          </Text>
        </View>

        <View style={styles.resultStats}>
          <View style={styles.resultStatRow}>
            <Ionicons name="person-add" size={20} color={colors.math.primary} />
            <Text style={styles.resultStatText}>
              {result.parentsCreated} parent{result.parentsCreated !== 1 ? 's' : ''} created
            </Text>
          </View>
          <View style={styles.resultStatRow}>
            <Ionicons name="school" size={20} color={colors.piano.primary} />
            <Text style={styles.resultStatText}>
              {result.studentsCreated} student{result.studentsCreated !== 1 ? 's' : ''} created
            </Text>
          </View>
        </View>

        {result.skipped.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={styles.resultSectionTitle}>Skipped (already exist):</Text>
            <ScrollView style={styles.resultList} nestedScrollEnabled>
              {result.skipped.map((msg, i) => (
                <Text key={i} style={styles.resultSkippedText}>• {msg}</Text>
              ))}
            </ScrollView>
          </View>
        )}

        {result.errors.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={[styles.resultSectionTitle, { color: colors.status.error }]}>
              Errors:
            </Text>
            <ScrollView style={styles.resultList} nestedScrollEnabled>
              {result.errors.map((msg, i) => (
                <Text key={i} style={styles.resultErrorText}>• {msg}</Text>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Import Data</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {step === 'input' && renderInputStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'result' && renderResultStep()}
        </ScrollView>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  instructionsContainer: {
    marginBottom: spacing.xl,
  },
  instructionsTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  instructionsText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  columnsBox: {
    backgroundColor: colors.neutral.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
  },
  columnText: {
    fontSize: typography.sizes.sm,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.neutral.text,
  },
  instructionsSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  instructionsNote: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    marginLeft: spacing.sm,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  primaryButton: {
    flex: 2,
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  previewHeader: {
    marginBottom: spacing.lg,
  },
  previewTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  previewSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  previewList: {
    maxHeight: 300,
    marginBottom: spacing.md,
  },
  previewRow: {
    backgroundColor: colors.neutral.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  previewRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  previewParentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  previewEmail: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginLeft: 20,
    marginTop: 2,
  },
  previewStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  previewStudentText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  previewSubjectsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginLeft: 20,
  },
  subjectBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  pianoBadge: {
    backgroundColor: colors.piano.subtle,
  },
  mathBadge: {
    backgroundColor: colors.math.subtle,
  },
  subjectBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  resultTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  resultStats: {
    backgroundColor: colors.neutral.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  resultStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  resultStatText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  resultSection: {
    marginBottom: spacing.md,
  },
  resultSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  resultList: {
    maxHeight: 120,
  },
  resultSkippedText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginBottom: 2,
  },
  resultErrorText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    marginBottom: 2,
  },
  doneButton: {
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  doneButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: '#FFFFFF',
  },
  progressContainer: {
    backgroundColor: colors.neutral.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.piano.primary,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  progressPercentage: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.piano.primary,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.neutral.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.piano.primary,
    borderRadius: 4,
  },
  progressCurrentItem: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
