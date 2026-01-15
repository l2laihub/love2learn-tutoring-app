/**
 * Students & Parents Screen
 * Displays and manages students and their parent relationships
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { StudentCard } from '../../src/components/StudentCard';
import { StudentFormModal } from '../../src/components/StudentFormModal';
import { ParentFormModal } from '../../src/components/ParentFormModal';
import { ImportDataModal } from '../../src/components/ImportDataModal';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { SearchInput } from '../../src/components/ui/Input';
import { AvatarDisplay } from '../../src/components/AvatarUpload';
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
import { useSendParentInvitation } from '../../src/hooks/useParentInvitation';
import {
  Student,
  Parent,
  StudentWithParent,
  CreateStudentInput,
  UpdateStudentInput,
  CreateParentInput,
  UpdateParentInput,
} from '../../src/types/database';
import { colors, spacing, typography, borderRadius, getSubjectColor, Subject } from '../../src/theme';
import { useResponsive } from '../../src/hooks/useResponsive';

// Subject configuration for filters
const ALL_SUBJECTS: Subject[] = ['piano', 'math', 'reading', 'speech', 'english'];
const subjectEmojis: Record<Subject, string> = {
  piano: '🎹',
  math: '➗',
  reading: '📚',
  speech: '🗣️',
  english: '📝',
};
const subjectNames: Record<Subject, string> = {
  piano: 'Piano',
  math: 'Math',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

type DisplayMode = 'list' | 'grouped';

type ViewMode = 'students' | 'parents';

// Layout constants for responsive design
const layoutConstants = {
  contentMaxWidth: 1200,
};

export default function StudentsScreen() {
  // Auth context for role checking
  const { isTutor } = useAuthContext();
  const responsive = useResponsive();

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

  // Invitation hook
  const { sendInvitation } = useSendParentInvitation();
  const [sendingInviteForParentId, setSendingInviteForParentId] = useState<string | null>(null);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list');

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

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

  // Get active subjects (subjects that have at least one student)
  const activeSubjects = useMemo(() => {
    const subjectSet = new Set<Subject>();
    students.forEach(student => {
      (student.subjects || []).forEach(subject => {
        if (ALL_SUBJECTS.includes(subject as Subject)) {
          subjectSet.add(subject as Subject);
        }
      });
    });
    return ALL_SUBJECTS.filter(s => subjectSet.has(s));
  }, [students]);

  // Toggle subject filter
  const toggleSubjectFilter = useCallback((subject: Subject) => {
    setSelectedSubjects(prev =>
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedSubjects([]);
    setSearchQuery('');
  }, []);

  // Filter and search students (moved up for dependency)
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = student.name.toLowerCase().includes(query);
        const matchesParent = student.parent?.name?.toLowerCase().includes(query);
        if (!matchesName && !matchesParent) return false;
      }

      // Subject filter
      if (selectedSubjects.length > 0) {
        const studentSubjects = student.subjects || [];
        const hasMatchingSubject = selectedSubjects.some(subject =>
          studentSubjects.includes(subject)
        );
        if (!hasMatchingSubject) return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedSubjects]);

  // Clear selection when filters change (selection is scoped to current filter)
  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [searchQuery, selectedSubjects]);

  // Selection handlers
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => !prev);
    setSelectedStudentIds(new Set());
  }, []);

  const toggleStudentSelection = useCallback((studentId: string) => {
    setSelectedStudentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    const allIds = new Set(filteredStudents.map(s => s.id));
    setSelectedStudentIds(allIds);
  }, [filteredStudents]);

  const clearSelection = useCallback(() => {
    setSelectedStudentIds(new Set());
  }, []);

  // Get selected students and their parent emails
  const selectedStudents = useMemo(() => {
    return filteredStudents.filter(s => selectedStudentIds.has(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const selectedParentEmails = useMemo(() => {
    const emailSet = new Set<string>();
    selectedStudents.forEach(student => {
      if (student.parent?.email) {
        emailSet.add(student.parent.email);
      }
    });
    return Array.from(emailSet);
  }, [selectedStudents]);

  // Email action handlers
  const handleCopyEmails = useCallback(async () => {
    if (selectedParentEmails.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('No parent emails found for selected students.');
      } else {
        Alert.alert('No Emails', 'No parent emails found for selected students.');
      }
      return;
    }
    const emailString = selectedParentEmails.join(', ');
    await Clipboard.setStringAsync(emailString);
    const message = `${selectedParentEmails.length} email${selectedParentEmails.length > 1 ? 's' : ''} copied to clipboard.`;
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Copied!', message);
    }
  }, [selectedParentEmails]);

  const handleOpenEmailClient = useCallback(async () => {
    if (selectedParentEmails.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('No parent emails found for selected students.');
      } else {
        Alert.alert('No Emails', 'No parent emails found for selected students.');
      }
      return;
    }
    // Use BCC to protect privacy
    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(selectedParentEmails.join(','))}`;

    if (Platform.OS === 'web') {
      // On web, directly open the mailto link
      window.open(mailtoUrl, '_self');
    } else {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert('Error', 'Unable to open email client. Emails have been copied to clipboard instead.');
        await Clipboard.setStringAsync(selectedParentEmails.join(', '));
      }
    }
  }, [selectedParentEmails]);

  const showEmailOptions = useCallback(() => {
    if (selectedParentEmails.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('No parent emails found for selected students.');
      } else {
        Alert.alert('No Emails', 'No parent emails found for selected students.');
      }
      return;
    }

    if (Platform.OS === 'web') {
      // On web, show a simple confirm dialog with options
      const choice = window.confirm(
        `You have ${selectedParentEmails.length} parent email${selectedParentEmails.length > 1 ? 's' : ''}.\n\n` +
        `Click OK to copy emails to clipboard, or Cancel to open email client.`
      );
      if (choice) {
        handleCopyEmails();
      } else {
        handleOpenEmailClient();
      }
    } else {
      // On native, use Alert with buttons
      Alert.alert(
        `Email ${selectedParentEmails.length} Parent${selectedParentEmails.length > 1 ? 's' : ''}`,
        'Choose an action:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Copy Emails', onPress: handleCopyEmails },
          { text: 'Open Email App', onPress: handleOpenEmailClient },
        ]
      );
    }
  }, [selectedParentEmails, handleCopyEmails, handleOpenEmailClient]);

  // Group students by subject for grouped view
  const groupedStudents = useMemo(() => {
    const groups: Record<Subject, StudentWithParent[]> = {} as Record<Subject, StudentWithParent[]>;

    // Initialize groups for active subjects only
    activeSubjects.forEach(subject => {
      groups[subject] = [];
    });

    // Distribute students to their subject groups
    filteredStudents.forEach(student => {
      const studentSubjects = student.subjects || [];
      studentSubjects.forEach(subject => {
        if (groups[subject as Subject]) {
          // Avoid duplicates
          if (!groups[subject as Subject].find(s => s.id === student.id)) {
            groups[subject as Subject].push(student);
          }
        }
      });
    });

    // Filter out empty groups and sort by count
    return Object.entries(groups)
      .filter(([_, students]) => students.length > 0)
      .sort((a, b) => b[1].length - a[1].length) as [Subject, StudentWithParent[]][];
  }, [filteredStudents, activeSubjects]);

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

  const handleParentLongPress = (parent: Parent) => {
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

  // Handle sending invitation to parent
  const handleSendInvitation = async (parent: Parent) => {
    console.log('[handleSendInvitation] Called for parent:', parent.id, parent.name);

    // Check if parent already has an account
    if (parent.user_id) {
      console.log('[handleSendInvitation] Parent already has account');
      if (Platform.OS === 'web') {
        window.alert(`${parent.name} already has an account.`);
      } else {
        Alert.alert('Already Registered', `${parent.name} already has an account.`);
      }
      return;
    }

    // Confirm before sending
    const isResend = parent.invitation_sent_at != null;
    const actionText = isResend ? 'Resend' : 'Send';

    console.log('[handleSendInvitation] Showing confirmation dialog');

    // Helper to perform the actual send
    const performSend = async () => {
      console.log('[handleSendInvitation] User confirmed, sending invitation...');
      setSendingInviteForParentId(parent.id);
      try {
        const result = await sendInvitation(parent.id);
        console.log('[handleSendInvitation] Result:', result);
        if (result.success) {
          if (Platform.OS === 'web') {
            window.alert(`Invitation sent to ${parent.email}. The link will expire in 7 days.`);
          } else {
            Alert.alert(
              'Invitation Sent',
              `An invitation has been sent to ${parent.email}. The link will expire in 7 days.`
            );
          }
          refetchParents();
        } else {
          if (Platform.OS === 'web') {
            window.alert(result.error || 'An error occurred while sending the invitation.');
          } else {
            Alert.alert(
              'Failed to Send',
              result.error || 'An error occurred while sending the invitation.'
            );
          }
        }
      } finally {
        setSendingInviteForParentId(null);
      }
    };

    // Handle web vs native confirmation
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `${actionText} an invitation email to ${parent.name} at ${parent.email}?`
      );
      if (confirmed) {
        await performSend();
      }
    } else {
      Alert.alert(
        `${actionText} Invitation`,
        `${actionText} an invitation email to ${parent.name} at ${parent.email}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: actionText,
            onPress: performSend,
          },
        ]
      );
    }
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

  const confirmDeleteParent = (parent: Parent) => {
    // Find the parent with students to get student count
    const parentWithStudents = parents.find(p => p.id === parent.id);
    const studentCount = parentWithStudents?.students?.length ?? 0;
    const hasStudents = studentCount > 0;
    const message = hasStudents
      ? `Are you sure you want to delete ${parent.name}? This will also delete their ${studentCount} student(s). This action cannot be undone.`
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
        // Create parent without user_id - it will be set when parent accepts invitation
        const createData: CreateParentInput = {
          ...(data as Omit<CreateParentInput, 'user_id'>),
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
        contentContainerStyle={[
          styles.content,
          {
            padding: responsive.contentPadding,
            maxWidth: layoutConstants.contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        refreshControl={
          !isSearchFocused ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.piano.primary]}
              tintColor={colors.piano.primary}
            />
          ) : undefined
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
            {/* Selection mode toggle - only visible for students view */}
            {viewMode === 'students' && filteredStudents.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.selectionModeButton,
                  selectionMode && styles.selectionModeButtonActive,
                ]}
                onPress={toggleSelectionMode}
              >
                <Ionicons
                  name={selectionMode ? 'close' : 'checkbox-outline'}
                  size={20}
                  color={selectionMode ? colors.neutral.white : colors.piano.primary}
                />
              </TouchableOpacity>
            )}
            {/* Import button - only visible to tutors */}
            {isTutor && !selectionMode && (
              <TouchableOpacity
                style={styles.importButton}
                onPress={() => setImportModalVisible(true)}
              >
                <Ionicons name="cloud-upload-outline" size={20} color={colors.piano.primary} />
              </TouchableOpacity>
            )}
            {!selectionMode && (
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
            )}
          </View>
        </View>

        {/* Search */}
        <View
          style={styles.searchWrapper}
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
        >
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder={viewMode === 'students' ? 'Search students...' : 'Search parents...'}
            containerStyle={styles.searchContainer}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
        </View>

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

        {/* Subject Filters - Only show for students view */}
        {viewMode === 'students' && activeSubjects.length > 0 && (
          <View style={styles.filtersSection}>
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersLabel}>Filter by Subject</Text>
              <View style={styles.displayModeToggle}>
                <TouchableOpacity
                  style={[styles.displayModeButton, displayMode === 'list' && styles.displayModeButtonActive]}
                  onPress={() => setDisplayMode('list')}
                >
                  <Ionicons
                    name="list"
                    size={16}
                    color={displayMode === 'list' ? colors.piano.primary : colors.neutral.textMuted}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.displayModeButton, displayMode === 'grouped' && styles.displayModeButtonActive]}
                  onPress={() => setDisplayMode('grouped')}
                >
                  <Ionicons
                    name="grid"
                    size={16}
                    color={displayMode === 'grouped' ? colors.piano.primary : colors.neutral.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsContainer}
            >
              {/* All filter chip */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedSubjects.length === 0 && styles.filterChipActive,
                ]}
                onPress={clearFilters}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedSubjects.length === 0 && styles.filterChipTextActive,
                ]}>
                  All ({students.length})
                </Text>
              </TouchableOpacity>

              {/* Subject filter chips */}
              {activeSubjects.map((subject) => {
                const isSelected = selectedSubjects.includes(subject);
                const subjectColor = getSubjectColor(subject);
                const count = students.filter(s => (s.subjects || []).includes(subject)).length;

                return (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.filterChip,
                      isSelected && { backgroundColor: subjectColor.primary },
                    ]}
                    onPress={() => toggleSubjectFilter(subject)}
                  >
                    <Text style={styles.filterChipEmoji}>{subjectEmojis[subject]}</Text>
                    <Text style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}>
                      {subjectNames[subject]} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Active filter indicator */}
            {(selectedSubjects.length > 0 || searchQuery) && (
              <View style={styles.activeFiltersRow}>
                <Text style={styles.activeFiltersText}>
                  Showing {filteredStudents.length} of {students.length} students
                </Text>
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={styles.clearFiltersText}>Clear filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.piano.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : viewMode === 'students' ? (
          // Students Display
          <View style={styles.section}>
            {filteredStudents.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title={searchQuery || selectedSubjects.length > 0 ? 'No students found' : 'No students yet'}
                description={
                  searchQuery || selectedSubjects.length > 0
                    ? 'Try adjusting your filters'
                    : 'Tap the + button to add your first student'
                }
              />
            ) : displayMode === 'list' ? (
              // List View
              filteredStudents.map((student) => {
                const isSelected = selectedStudentIds.has(student.id);

                // When in selection mode, wrap with selection UI
                if (selectionMode) {
                  return (
                    <TouchableOpacity
                      key={student.id}
                      onPress={() => toggleStudentSelection(student.id)}
                      activeOpacity={0.7}
                      style={[
                        styles.selectableCardWrapper,
                        isSelected && styles.selectableCardSelected,
                      ]}
                    >
                      <View style={styles.checkboxContainer}>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
                          )}
                        </View>
                      </View>
                      <View style={styles.selectableCardContent}>
                        <StudentCard
                          name={student.name}
                          grade={parseInt(student.grade_level) || 0}
                          subjects={student.subjects || []}
                          parentName={student.parent?.name || 'Unknown'}
                          avatarUrl={student.avatar_url}
                          onPress={() => toggleStudentSelection(student.id)}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                }

                // Normal mode - just render the card
                return (
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
                      avatarUrl={student.avatar_url}
                      onPress={() => handleStudentPress(student.id)}
                    />
                  </TouchableOpacity>
                );
              })
            ) : (
              // Grouped View
              groupedStudents.map(([subject, subjectStudents]) => {
                const subjectColor = getSubjectColor(subject);
                return (
                  <View key={subject} style={styles.subjectGroup}>
                    <View style={[styles.subjectGroupHeader, { borderLeftColor: subjectColor.primary }]}>
                      <Text style={styles.subjectGroupEmoji}>{subjectEmojis[subject]}</Text>
                      <Text style={[styles.subjectGroupTitle, { color: subjectColor.primary }]}>
                        {subjectNames[subject]}
                      </Text>
                      <View style={[styles.subjectGroupBadge, { backgroundColor: subjectColor.subtle }]}>
                        <Text style={[styles.subjectGroupCount, { color: subjectColor.primary }]}>
                          {subjectStudents.length}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.subjectGroupStudents}>
                      {subjectStudents.map((student) => {
                        const isSelected = selectedStudentIds.has(student.id);

                        // When in selection mode, wrap with selection UI
                        if (selectionMode) {
                          return (
                            <TouchableOpacity
                              key={`${subject}-${student.id}`}
                              onPress={() => toggleStudentSelection(student.id)}
                              activeOpacity={0.7}
                              style={[
                                styles.selectableCardWrapper,
                                isSelected && styles.selectableCardSelected,
                              ]}
                            >
                              <View style={styles.checkboxContainer}>
                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                  {isSelected && (
                                    <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
                                  )}
                                </View>
                              </View>
                              <View style={styles.selectableCardContent}>
                                <StudentCard
                                  name={student.name}
                                  grade={parseInt(student.grade_level) || 0}
                                  subjects={student.subjects || []}
                                  parentName={student.parent?.name || 'Unknown'}
                                  avatarUrl={student.avatar_url}
                                  onPress={() => toggleStudentSelection(student.id)}
                                />
                              </View>
                            </TouchableOpacity>
                          );
                        }

                        // Normal mode - just render the card
                        return (
                          <TouchableOpacity
                            key={`${subject}-${student.id}`}
                            onLongPress={() => handleStudentLongPress(student)}
                            activeOpacity={0.7}
                          >
                            <StudentCard
                              name={student.name}
                              grade={parseInt(student.grade_level) || 0}
                              subjects={student.subjects || []}
                              parentName={student.parent?.name || 'Unknown'}
                              avatarUrl={student.avatar_url}
                              onPress={() => handleStudentPress(student.id)}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })
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
              filteredParents.map((parent) => {
                // Determine invitation status
                const hasAccount = parent.user_id != null;
                const invitationSent = parent.invitation_sent_at != null;
                const invitationExpired = parent.invitation_expires_at
                  ? new Date(parent.invitation_expires_at) < new Date()
                  : false;
                const invitationAccepted = parent.invitation_accepted_at != null;

                // Determine agreement status
                const agreementSigned = parent.agreement_signed_at != null;
                const requiresAgreement = parent.requires_agreement !== false;

                // Get status display
                let statusText = '';
                let statusColor: string = colors.neutral.textMuted;
                let statusBgColor: string = colors.neutral.surface;

                // Agreement status (shown as secondary badge for active accounts)
                let agreementStatusText = '';
                let agreementStatusColor: string = colors.neutral.textMuted;
                let agreementStatusBgColor: string = colors.neutral.background;

                if (hasAccount || invitationAccepted) {
                  statusText = 'Account Active';
                  statusColor = colors.status.success;
                  statusBgColor = '#E8F5E9';

                  // Set agreement status for active accounts
                  if (agreementSigned) {
                    agreementStatusText = 'Agreement Signed';
                    agreementStatusColor = colors.status.success;
                    agreementStatusBgColor = '#E8F5E9';
                  } else if (requiresAgreement) {
                    agreementStatusText = 'Pending Agreement';
                    agreementStatusColor = colors.status.warning;
                    agreementStatusBgColor = '#FFF8E1';
                  }
                } else if (invitationSent && !invitationExpired) {
                  const expiresAt = new Date(parent.invitation_expires_at!);
                  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  statusText = `Invited (${daysLeft}d left)`;
                  statusColor = colors.status.warning;
                  statusBgColor = '#FFF8E1';
                } else if (invitationSent && invitationExpired) {
                  statusText = 'Invitation Expired';
                  statusColor = colors.status.error;
                  statusBgColor = '#FFEBEE';
                } else {
                  statusText = 'Not Invited';
                  statusColor = colors.neutral.textMuted;
                  statusBgColor = colors.neutral.background;
                }

                const showInviteButton = !hasAccount && !invitationAccepted;
                const inviteButtonText = invitationSent ? 'Resend' : 'Invite';
                const isSendingThisParent = sendingInviteForParentId === parent.id;

                return (
                  <TouchableOpacity
                    key={parent.id}
                    style={styles.parentCard}
                    onPress={() => handleParentPress(parent.id)}
                    onLongPress={() => handleParentLongPress(parent)}
                  >
                    <AvatarDisplay
                      avatarUrl={parent.avatar_url}
                      name={parent.name}
                      size={48}
                    />
                    <View style={styles.parentInfo}>
                      <Text style={styles.parentName}>{parent.name}</Text>
                      <Text style={styles.parentEmail}>{parent.email}</Text>
                      <View style={styles.parentMetaRow}>
                        <Text style={styles.parentStudentCount}>
                          {parent.students?.length ?? 0} student
                          {(parent.students?.length ?? 0) !== 1 ? 's' : ''}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
                          <Text style={[styles.statusText, { color: statusColor }]}>
                            {statusText}
                          </Text>
                        </View>
                        {agreementStatusText && (
                          <View style={[styles.statusBadge, { backgroundColor: agreementStatusBgColor, marginLeft: 4 }]}>
                            <Ionicons
                              name={agreementSigned ? 'document-text' : 'document-text-outline'}
                              size={10}
                              color={agreementStatusColor}
                              style={{ marginRight: 3 }}
                            />
                            <Text style={[styles.statusText, { color: agreementStatusColor }]}>
                              {agreementSigned ? 'Signed' : 'Pending'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {showInviteButton ? (
                      <TouchableOpacity
                        style={[
                          styles.inviteButton,
                          isSendingThisParent && styles.inviteButtonDisabled,
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleSendInvitation(parent);
                        }}
                        disabled={isSendingThisParent || sendingInviteForParentId !== null}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        {isSendingThisParent ? (
                          <ActivityIndicator size="small" color={colors.piano.primary} />
                        ) : (
                          <>
                            <Ionicons name="mail-outline" size={16} color={colors.piano.primary} />
                            <Text style={styles.inviteButtonText}>{inviteButtonText}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={colors.neutral.textMuted}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Selection Toolbar */}
      {selectionMode && viewMode === 'students' && (
        <View style={styles.selectionToolbar}>
          <View style={styles.selectionInfo}>
            <Text style={styles.selectionCount}>
              {selectedStudentIds.size} selected
            </Text>
            <Text style={styles.selectionEmailCount}>
              ({selectedParentEmails.length} email{selectedParentEmails.length !== 1 ? 's' : ''})
            </Text>
          </View>
          <View style={styles.selectionActions}>
            {selectedStudentIds.size < filteredStudents.length ? (
              <TouchableOpacity
                style={styles.selectionActionButton}
                onPress={selectAllFiltered}
              >
                <Ionicons name="checkbox" size={20} color={colors.piano.primary} />
                <Text style={styles.selectionActionText}>Select All</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.selectionActionButton}
                onPress={clearSelection}
              >
                <Ionicons name="square-outline" size={20} color={colors.neutral.textMuted} />
                <Text style={[styles.selectionActionText, { color: colors.neutral.textMuted }]}>Deselect</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.emailButton,
                selectedStudentIds.size === 0 && styles.emailButtonDisabled,
              ]}
              onPress={showEmailOptions}
              disabled={selectedStudentIds.size === 0}
            >
              <Ionicons
                name="mail"
                size={20}
                color={selectedStudentIds.size === 0 ? colors.neutral.textMuted : colors.neutral.white}
              />
              <Text style={[
                styles.emailButtonText,
                selectedStudentIds.size === 0 && styles.emailButtonTextDisabled,
              ]}>
                Email Parents
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  searchWrapper: {
    zIndex: 1,
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
  },
  parentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.piano.subtle,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.piano.primary,
  },
  inviteButtonDisabled: {
    opacity: 0.5,
  },
  inviteButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
  },
  // Filter styles
  filtersSection: {
    marginBottom: spacing.lg,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  filtersLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  displayModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.md,
    padding: 2,
  },
  displayModeButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  displayModeButtonActive: {
    backgroundColor: colors.piano.subtle,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  filterChipActive: {
    backgroundColor: colors.piano.primary,
    borderColor: colors.piano.primary,
  },
  filterChipEmoji: {
    fontSize: 14,
  },
  filterChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  filterChipTextActive: {
    color: colors.neutral.white,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
  activeFiltersText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  clearFiltersText: {
    fontSize: typography.sizes.xs,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  // Grouped view styles
  subjectGroup: {
    marginBottom: spacing.lg,
  },
  subjectGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  subjectGroupEmoji: {
    fontSize: 20,
  },
  subjectGroupTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  subjectGroupBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  subjectGroupCount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  subjectGroupStudents: {
    gap: spacing.sm,
  },
  // Selection mode styles
  selectionModeButton: {
    backgroundColor: colors.neutral.surface,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.piano.primary,
  },
  selectionModeButtonActive: {
    backgroundColor: colors.piano.primary,
    borderColor: colors.piano.primary,
  },
  selectableCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  selectableCardSelected: {
    backgroundColor: colors.piano.subtle,
  },
  selectableCardContent: {
    flex: 1,
  },
  checkboxContainer: {
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
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
  // Selection toolbar styles
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectionCount: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  selectionEmailCount: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectionActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  selectionActionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  emailButtonDisabled: {
    backgroundColor: colors.neutral.border,
  },
  emailButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  emailButtonTextDisabled: {
    color: colors.neutral.textMuted,
  },
});
