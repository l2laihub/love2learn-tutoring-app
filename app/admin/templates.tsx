/**
 * Admin Agreement Templates Screen
 * Create and edit agreement templates
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAgreementTemplates, AgreementTemplate } from '../../src/hooks/useAdmin';
import { useResponsive } from '../../src/hooks/useResponsive';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

// Layout constants for responsive design
const layoutConstants = {
  contentMaxWidth: 1200,
};

interface TemplateCardProps {
  template: AgreementTemplate;
  onEdit: () => void;
}

function TemplateCard({ template, onEdit }: TemplateCardProps) {
  const formattedDate = new Date(template.updatedAt).toLocaleDateString();

  return (
    <View style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateVersion}>Version {template.version}</Text>
        </View>
        <View style={styles.templateBadges}>
          {template.isActive && (
            <View style={[styles.badge, styles.badgeActive]}>
              <Text style={styles.badgeTextActive}>Active</Text>
            </View>
          )}
          {template.isDefault && (
            <View style={[styles.badge, styles.badgeDefault]}>
              <Text style={styles.badgeTextDefault}>Default</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.templateMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="document-text-outline" size={14} color={colors.neutral.textMuted} />
          <Text style={styles.metaText}>
            {template.agreementType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.neutral.textMuted} />
          <Text style={styles.metaText}>Updated {formattedDate}</Text>
        </View>
      </View>

      <Text style={styles.templatePreview} numberOfLines={3}>
        {template.content.substring(0, 200)}...
      </Text>

      <TouchableOpacity style={styles.editButton} onPress={onEdit}>
        <Ionicons name="create-outline" size={18} color={colors.primary.main} />
        <Text style={styles.editButtonText}>Edit Template</Text>
      </TouchableOpacity>
    </View>
  );
}

interface TemplateEditorModalProps {
  visible: boolean;
  template: AgreementTemplate | null;
  onClose: () => void;
  onSave: (template: {
    name: string;
    version: string;
    content: string;
    setActive?: boolean;
    setDefault?: boolean;
  }, templateId?: string) => Promise<string | null>;
  saving: boolean;
}

function TemplateEditorModal({ visible, template, onClose, onSave, saving }: TemplateEditorModalProps) {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [content, setContent] = useState('');
  const [setActive, setSetActive] = useState(false);
  const [setDefault, setSetDefault] = useState(false);

  const isEditing = template !== null;

  useEffect(() => {
    if (template) {
      setName(template.name);
      setVersion(template.version);
      setContent(template.content);
      setSetActive(template.isActive);
      setSetDefault(template.isDefault);
    } else {
      setName('');
      setVersion('1.0');
      setContent('');
      setSetActive(false);
      setSetDefault(false);
    }
  }, [template, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a template name');
      } else {
        Alert.alert('Error', 'Please enter a template name');
      }
      return;
    }

    if (!version.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a version number');
      } else {
        Alert.alert('Error', 'Please enter a version number');
      }
      return;
    }

    if (!content.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter the agreement content');
      } else {
        Alert.alert('Error', 'Please enter the agreement content');
      }
      return;
    }

    const result = await onSave(
      {
        name: name.trim(),
        version: version.trim(),
        content: content.trim(),
        setActive,
        setDefault,
      },
      template?.id
    );

    if (result) {
      if (Platform.OS === 'web') {
        window.alert(`Template ${isEditing ? 'updated' : 'created'} successfully!`);
      } else {
        Alert.alert('Success', `Template ${isEditing ? 'updated' : 'created'} successfully!`);
      }
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboard}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} disabled={saving}>
              <Ionicons name="close" size={24} color={colors.neutral.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isEditing ? 'Edit Template' : 'New Template'}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentInner}
            keyboardShouldPersistTaps="handled"
          >
            {/* Template Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Template Name *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Tutoring Services Agreement"
                placeholderTextColor={colors.neutral.textMuted}
                editable={!saving}
              />
            </View>

            {/* Version */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Version *</Text>
              <TextInput
                style={styles.textInput}
                value={version}
                onChangeText={setVersion}
                placeholder="e.g., 1.0"
                placeholderTextColor={colors.neutral.textMuted}
                editable={!saving}
              />
              <Text style={styles.inputHint}>
                Increment the version when making significant changes
              </Text>
            </View>

            {/* Options */}
            <View style={styles.optionsGroup}>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setSetActive(!setActive)}
                disabled={saving}
              >
                <Ionicons
                  name={setActive ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={setActive ? colors.primary.main : colors.neutral.textMuted}
                />
                <View style={styles.optionContent}>
                  <Text style={styles.optionLabel}>Set as Active</Text>
                  <Text style={styles.optionHint}>
                    Use this template for new agreements
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setSetDefault(!setDefault)}
                disabled={saving}
              >
                <Ionicons
                  name={setDefault ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={setDefault ? colors.primary.main : colors.neutral.textMuted}
                />
                <View style={styles.optionContent}>
                  <Text style={styles.optionLabel}>Set as Default</Text>
                  <Text style={styles.optionHint}>
                    Make this the default template for its type
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Agreement Content *</Text>
              <TextInput
                style={[styles.textInput, styles.contentInput]}
                value={content}
                onChangeText={setContent}
                placeholder="Enter the full agreement text here..."
                placeholderTextColor={colors.neutral.textMuted}
                multiline
                textAlignVertical="top"
                editable={!saving}
              />
              <Text style={styles.inputHint}>
                {content.length} characters • Use clear section headings (e.g., "1. SERVICES")
              </Text>
            </View>

            {/* Tips */}
            <View style={styles.tipsCard}>
              <Ionicons name="bulb-outline" size={20} color="#F57C00" />
              <View style={styles.tipsContent}>
                <Text style={styles.tipsTitle}>Writing Tips</Text>
                <Text style={styles.tipsText}>
                  • Use numbered sections for easy reference{'\n'}
                  • Keep language clear and professional{'\n'}
                  • Include all necessary legal provisions{'\n'}
                  • Review with legal counsel if needed
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default function AdminTemplates() {
  const { templates, loading, error, saving, refetch, saveTemplate } = useAgreementTemplates();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgreementTemplate | null>(null);
  const responsive = useResponsive();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setModalVisible(true);
  };

  const handleEdit = (template: AgreementTemplate) => {
    setSelectedTemplate(template);
    setModalVisible(true);
  };

  const handleSave = async (
    template: {
      name: string;
      version: string;
      content: string;
      setActive?: boolean;
      setDefault?: boolean;
    },
    templateId?: string
  ) => {
    return await saveTemplate(template, templateId);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedTemplate(null);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header Actions */}
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
          <Ionicons name="add-circle" size={20} color={colors.neutral.white} />
          <Text style={styles.createButtonText}>New Template</Text>
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color="#C62828" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Templates List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            padding: responsive.contentPadding,
            maxWidth: layoutConstants.contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {templates.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={colors.neutral.textMuted} />
            <Text style={styles.emptyStateTitle}>No Templates</Text>
            <Text style={styles.emptyStateText}>
              Create your first agreement template to get started.
            </Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={handleCreateNew}>
              <Ionicons name="add" size={20} color={colors.neutral.white} />
              <Text style={styles.emptyStateButtonText}>Create Template</Text>
            </TouchableOpacity>
          </View>
        ) : (
          templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => handleEdit(template)}
            />
          ))
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#3D9CA8" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>About Templates</Text>
            <Text style={styles.infoText}>
              Templates define the content that parents see when signing agreements.
              Only the active, default template is used for new agreements.
              Keep older versions for reference but set only one as active.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Editor Modal */}
      <TemplateEditorModal
        visible={modalVisible}
        template={selectedTemplate}
        onClose={handleCloseModal}
        onSave={handleSave}
        saving={saving}
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
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  createButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.white,
    fontWeight: typography.weights.medium,
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
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  emptyStateButtonText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.white,
    fontWeight: typography.weights.medium,
  },
  templateCard: {
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
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  templateVersion: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  templateBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeActive: {
    backgroundColor: '#E8F5E9',
  },
  badgeDefault: {
    backgroundColor: '#E3F2FD',
  },
  badgeTextActive: {
    fontSize: typography.sizes.xs,
    color: '#2E7D32',
    fontWeight: typography.weights.medium,
  },
  badgeTextDefault: {
    fontSize: typography.sizes.xs,
    color: '#1976D2',
    fontWeight: typography.weights.medium,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  templatePreview: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    gap: spacing.xs,
  },
  editButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary.main,
    fontWeight: typography.weights.medium,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F5F7',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: '#2D7A84',
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: '#4A6572',
    lineHeight: 20,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  modalKeyboard: {
    flex: 1,
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
  saveButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.white,
    fontWeight: typography.weights.semibold,
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  contentInput: {
    minHeight: 300,
    maxHeight: 400,
  },
  inputHint: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
  optionsGroup: {
    marginBottom: spacing.lg,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  optionHint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  tipsContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  tipsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: '#F57C00',
    marginBottom: spacing.xs,
  },
  tipsText: {
    fontSize: typography.sizes.sm,
    color: '#8D6E63',
    lineHeight: 20,
  },
});
