/**
 * Students & Parents Screen
 * Displays and manages students and their parent relationships
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { StudentCard } from '../../src/components/StudentCard';
import { StudentFormModal } from '../../src/components/StudentFormModal';
import { ParentFormModal } from '../../src/components/ParentFormModal';
import { ImportDataModal } from '../../src/components/ImportDataModal';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { SearchInput } from '../../src/components/ui/Input';
import { useAuthContext } from '../../src/contexts/AuthContext';
import {
  useStudents,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
} from '../../src/hooks/useStudents';
import {
  useParents,
  useCreateParent,
  useUpdateParent,
  useDeleteParent,
} from '../../src/hooks/useParents';
import {
  Student,
  Parent,
  StudentWithParent,
  CreateStudentInput,
  UpdateStudentInput,
  CreateParentInput,
  UpdateParentInput,
} from '../../src/types/database';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

type ViewMode = 'students' | 'parents';

export default function StudentsScreen() {
  // Auth context for role checking
  const { isTutor } = useAuthContext();

  // Data fetching hooks
  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
    refetch: refetchStudents,
  } = useStudents();
  const {
    data: parents,
    loading: parentsLoading,
    error: parentsError,
    refetch: refetchParents,
  } = useParents();

  // Mutation hooks
  const { mutate: createStudent, loading: createStudentLoading } = useCreateStudent();
  const { mutate: updateStudent, loading: updateStudentLoading } = useUpdateStudent();
  const { mutate: deleteStudent, loading: deleteStudentLoading } = useDeleteStudent();
  const { mutate: createParent, loading: createParentLoading } = useCreateParent();
  const { mutate: updateParent, loading: updateParentLoading } = useUpdateParent();
  const { mutate: deleteParent, loading: deleteParentLoading } = useDeleteParent();

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [parentModalVisible, setParentModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStudents(), refetchParents()]);
    setRefreshing(false);
  }, [refetchStudents, refetchParents]);

  // Filter and search students
  const filteredStudents = students.filter((student) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = student.name.toLowerCase().includes(query);
      const matchesParent = student.parent?.name?.toLowerCase().includes(query);
      if (!matchesName && !matchesParent) return false;
    }
    return true;
  });

  // Filter and search parents
  const filteredParents = parents.filter((parent) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        parent.name.toLowerCase().includes(query) ||
        parent.email.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Handlers
  const handleAddPress = () => {
    if (viewMode === 'students') {
      if (parents.length === 0) {
        Alert.alert(
          'Add Parent First',
          'You need to add at least one parent before adding a student.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add Parent',
              onPress: () => {
                setParentModalVisible(true);
              },
            },
          ]
        );
        return;
      }
      setEditingStudent(null);
      setStudentModalVisible(true);
    } else {
      setEditingParent(null);
      setParentModalVisible(true);
    }
  };

  const handleStudentPress = (studentId: string) => {
    router.push(`/student/${studentId}`);
  };

  const handleStudentLongPress = (student: StudentWithParent) => {
    Alert.alert(student.name, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Edit',
        onPress: () => {
          setEditingStudent(student);
          setStudentModalVisible(true);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteStudent(student),
      },
    ]);
  };

  const handleParentPress = (parentId: string) => {
    router.push(`/parent/${parentId}`);
  };

  const handleParentLongPress = (parent: Parent & { student_count: number }) => {
    Alert.alert(parent.name, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Edit',
        onPress: () => {
          setEditingParent(parent);
          setParentModalVisible(true);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteParent(parent),
      },
    ]);
  };

  const confirmDeleteStudent = (student: Student) => {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${student.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteStudent(student.id);
            if (success) {
              refetchStudents();
            }
          },
        },
      ]
    );
  };

  const confirmDeleteParent = (parent: Parent & { student_count: number }) => {
    const hasStudents = parent.student_count > 0;
    const message = hasStudents
      ? `Are you sure you want to delete ${parent.name}? This will also delete their ${parent.student_count} student(s). This action cannot be undone.`
      : `Are you sure you want to delete ${parent.name}? This action cannot be undone.`;

    Alert.alert('Delete Parent', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteParent(parent.id);
          if (success) {
            await Promise.all([refetchParents(), refetchStudents()]);
          }
        },
      },
    ]);
  };

  // Save handlers
  const handleSaveStudent = async (
    data: CreateStudentInput | UpdateStudentInput
  ): Promise<boolean> => {
    try {
      if (editingStudent) {
        const result = await updateStudent(editingStudent.id, data as UpdateStudentInput);
        if (result) {
          await refetchStudents();
          return true;
        }
      } else {
        const result = await createStudent(data as CreateStudentInput);
        if (result) {
          await refetchStudents();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Save student error:', error);
      Alert.alert('Error', 'Failed to save student. Please try again.');
      return false;
    }
  };

  const handleSaveParent = async (
    data: Omit<CreateParentInput, 'user_id'> | UpdateParentInput
  ): Promise<boolean> => {
    try {
      if (editingParent) {
        const result = await updateParent(editingParent.id, data as UpdateParentInput);
        if (result) {
          await refetchParents();
          return true;
        }
      } else {
        // For now, use a placeholder user_id since auth isn't implemented
        const createData: CreateParentInput = {
          ...(data as Omit<CreateParentInput, 'user_id'>),
          user_id: '00000000-0000-0000-0000-000000000000', // Placeholder
        };
        const result = await createParent(createData);
        if (result) {
          await refetchParents();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Save parent error:', error);
      Alert.alert('Error', 'Failed to save parent. Please try again.');
      return false;
    }
  };

  // Loading state
  const isLoading = studentsLoading || parentsLoading;
  const isMutating =
    createStudentLoading ||
    updateStudentLoading ||
    deleteStudentLoading ||
    createParentLoading ||
    updateParentLoading ||
    deleteParentLoading;

  // Error state
  if (studentsError || parentsError) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>Failed to load data</Text>
          <Text style={styles.errorSubtext}>
            {studentsError?.message || parentsError?.message}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.piano.primary]}
            tintColor={colors.piano.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Students & Parents</Text>
            <Text style={styles.subtitle}>
              {students.length} student{students.length !== 1 ? 's' : ''},{' '}
              {parents.length} parent{parents.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            {/* Import button - only visible to tutors */}
            {isTutor && (
              <TouchableOpacity
                style={styles.importButton}
                onPress={() => setImportModalVisible(true)}
              >
                <Ionicons name="cloud-upload-outline" size={20} color={colors.piano.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddPress}
              disabled={isMutating}
            >
              {isMutating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="add" size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder={viewMode === 'students' ? 'Search students...' : 'Search parents...'}
          containerStyle={styles.searchContainer}
        />

        {/* View Mode Toggle */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[styles.viewModeTab, viewMode === 'students' && styles.viewModeTabActive]}
            onPress={() => setViewMode('students')}
          >
            <Ionicons
              name="people"
              size={18}
              color={viewMode === 'students' ? colors.piano.primary : colors.neutral.textMuted}
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'students' && styles.viewModeTextActive,
              ]}
            >
              Students ({students.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeTab, viewMode === 'parents' && styles.viewModeTabActive]}
            onPress={() => setViewMode('parents')}
          >
            <Ionicons
              name="person"
              size={18}
              color={viewMode === 'parents' ? colors.piano.primary : colors.neutral.textMuted}
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'parents' && styles.viewModeTextActive,
              ]}
            >
              Parents ({parents.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.piano.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : viewMode === 'students' ? (
          // Students List
          <View style={styles.section}>
            {filteredStudents.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title={searchQuery ? 'No students found' : 'No students yet'}
                description={
                  searchQuery
                    ? 'Try a different search term'
                    : 'Tap the + button to add your first student'
                }
              />
            ) : (
              filteredStudents.map((student) => (
                <TouchableOpacity
                  key={student.id}
                  onLongPress={() => handleStudentLongPress(student)}
                  activeOpacity={0.7}
                >
                  <StudentCard
                    name={student.name}
                    grade={parseInt(student.grade_level) || 0}
                    subjects={student.subjects || []}
                    parentName={student.parent?.name || 'Unknown'}
                    onPress={() => handleStudentPress(student.id)}
                  />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          // Parents List
          <View style={styles.section}>
            {filteredParents.length === 0 ? (
              <EmptyState
                icon="person-outline"
                title={searchQuery ? 'No parents found' : 'No parents yet'}
                description={
                  searchQuery
                    ? 'Try a different search term'
                    : 'Tap the + button to add your first parent'
                }
              />
            ) : (
              filteredParents.map((parent) => (
                <TouchableOpacity
                  key={parent.id}
                  style={styles.parentCard}
                  onPress={() => handleParentPress(parent.id)}
                  onLongPress={() => handleParentLongPress(parent)}
                >
                  <View style={styles.parentAvatar}>
                    <Text style={styles.parentAvatarText}>
                      {parent.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.parentInfo}>
                    <Text style={styles.parentName}>{parent.name}</Text>
                    <Text style={styles.parentEmail}>{parent.email}</Text>
                    <Text style={styles.parentStudentCount}>
                      {parent.student_count} student
                      {parent.student_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.neutral.textMuted}
                  />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Student Form Modal */}
      <StudentFormModal
        visible={studentModalVisible}
        onClose={() => {
          setStudentModalVisible(false);
          setEditingStudent(null);
        }}
        onSave={handleSaveStudent}
        student={editingStudent}
        parents={parents}
        loading={createStudentLoading || updateStudentLoading}
      />

      {/* Parent Form Modal */}
      <ParentFormModal
        visible={parentModalVisible}
        onClose={() => {
          setParentModalVisible(false);
          setEditingParent(null);
        }}
        onSave={handleSaveParent}
        parent={editingParent}
        loading={createParentLoading || updateParentLoading}
      />

      {/* Import Data Modal - Tutor only */}
      {isTutor && (
        <ImportDataModal
          visible={importModalVisible}
          onClose={() => {
            // Refetch data when modal closes to ensure we have latest data
            refetchStudents();
            refetchParents();
            setImportModalVisible(false);
          }}
          onSuccess={async () => {
            // Refetch both students and parents after successful import
            await Promise.all([refetchStudents(), refetchParents()]);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: spacing.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  importButton: {
    backgroundColor: colors.neutral.surface,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.piano.primary,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  addButton: {
    backgroundColor: colors.piano.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.piano.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  searchContainer: {
    marginBottom: spacing.md,
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  viewModeTabActive: {
    backgroundColor: colors.piano.subtle,
  },
  viewModeText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    fontWeight: typography.weights.medium,
  },
  viewModeTextActive: {
    color: colors.piano.primary,
  },
  section: {
    gap: spacing.md,
  },
  loadingContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral.textMuted,
    fontSize: typography.sizes.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  errorText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  errorSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  retryText: {
    color: colors.piano.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  parentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  parentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.math.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentAvatarText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.math.primary,
  },
  parentInfo: {
    flex: 1,
    marginLeft: spacing.md,
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
  parentStudentCount: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 4,
  },
});
