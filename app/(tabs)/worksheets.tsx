/**
 * Worksheets Screen
 * AI-powered worksheet generation for piano and math lessons
 * Tutors: Generate worksheets, view assigned, and manage shared resource library
 * Parents: View assigned worksheets
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useStudents } from '../../src/hooks/useStudents';
import { useTutor } from '../../src/hooks/useParents';
import { useAssignments, useCreateAssignment, useCompleteAssignment, useDeleteAssignment } from '../../src/hooks/useAssignments';
import { useSharedResources, useCreateSharedResource, useDeleteSharedResourceWithFile } from '../../src/hooks/useSharedResources';
import { WorksheetGeneratorModal, WorksheetConfig } from '../../src/components/WorksheetGeneratorModal';
import { UploadWorksheetModal } from '../../src/components/UploadWorksheetModal';
import { ImageShareModal } from '../../src/components/ImageShareModal';
import { YouTubeShareModal } from '../../src/components/YouTubeShareModal';
import { SharedResourceList } from '../../src/components/SharedResourceCard';
import { ResourceViewerModal } from '../../src/components/ResourceViewerModal';
import { TutoringSubject, PianoWorksheetConfig, AssignmentWithStudent, CreateSharedResourceInput, SharedResourceWithStudent, ResourceType } from '../../src/types/database';
import { generatePianoWorksheet, generatePianoWorksheetFromConfig } from '../../src/services/pianoWorksheetGenerator';

type TabType = 'generate' | 'assigned' | 'library';

// Filter options for parent view
type FilterOption = 'all' | 'pending' | 'completed';

// Library resource filter
type ResourceFilter = 'all' | 'worksheet' | 'pdf' | 'image' | 'video';

const RESOURCE_FILTER_OPTIONS: { value: ResourceFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'apps' },
  { value: 'worksheet', label: 'Worksheets', icon: 'document-text' },
  { value: 'pdf', label: 'PDFs', icon: 'document' },
  { value: 'image', label: 'Images', icon: 'image' },
  { value: 'video', label: 'Videos', icon: 'videocam' },
];

// Piano quick templates
const PIANO_TEMPLATES = [
  { id: 'note-naming', label: 'Note Naming', icon: '🎵', clef: 'treble', difficulty: 'beginner' },
  { id: 'note-drawing', label: 'Note Drawing', icon: '✏️', clef: 'treble', difficulty: 'beginner' },
  { id: 'bass-clef', label: 'Bass Clef', icon: '🎹', clef: 'bass', difficulty: 'elementary' },
  { id: 'grand-staff', label: 'Grand Staff', icon: '🎼', clef: 'grand', difficulty: 'intermediate' },
];

// Math quick templates
const MATH_TEMPLATES = [
  { id: 'addition', label: 'Addition', icon: '➕', topic: 'addition', grade: 1 },
  { id: 'subtraction', label: 'Subtraction', icon: '➖', topic: 'subtraction', grade: 1 },
  { id: 'multiplication', label: 'Multiplication', icon: '✖️', topic: 'multiplication', grade: 3 },
  { id: 'division', label: 'Division', icon: '➗', topic: 'division', grade: 3 },
];

export default function WorksheetsScreen() {
  const { role: userRole, parent } = useAuthContext();
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: tutor } = useTutor();
  const { data: assignments, loading: assignmentsLoading, refetch: refetchAssignments } = useAssignments();
  const { mutate: createAssignment } = useCreateAssignment();
  const { mutate: completeAssignment, loading: completingAssignment } = useCompleteAssignment();
  const { mutate: deleteAssignment, loading: deletingAssignment } = useDeleteAssignment();
  const { mutate: createSharedResource } = useCreateSharedResource();
  const { mutate: deleteResource, loading: deletingResource } = useDeleteSharedResourceWithFile();

  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [showGenerator, setShowGenerator] = useState(false);
  const [presetSubject, setPresetSubject] = useState<TutoringSubject | undefined>();
  const [statusFilter, setStatusFilter] = useState<FilterOption>('all');
  const [selectedChild, setSelectedChild] = useState<string | null>(null);

  // Admin Assigned tab filter states
  const [adminStatusFilter, setAdminStatusFilter] = useState<FilterOption>('all');
  const [adminStudentFilter, setAdminStudentFilter] = useState<string | null>(null);
  const [adminTypeFilter, setAdminTypeFilter] = useState<'all' | 'piano_naming' | 'piano_drawing' | 'math'>('all');
  const [showAdminStudentPicker, setShowAdminStudentPicker] = useState(false);

  // Sharing modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);

  // Library tab states
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('all');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<SharedResourceWithStudent | null>(null);
  const [showResourceViewer, setShowResourceViewer] = useState(false);
  const [refreshingLibrary, setRefreshingLibrary] = useState(false);
  const [showStudentPicker, setShowStudentPicker] = useState(false);

  // Multi-select states for bulk delete (Library)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  // Multi-select states for bulk delete (Assignments)
  const [isAssignmentSelectMode, setIsAssignmentSelectMode] = useState(false);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);

  const isTutor = userRole === 'tutor';

  // Get tutor ID for sharing resources
  const tutorId = tutor?.id;

  // Fetch shared resources for library tab
  const resourceType = resourceFilter === 'all' ? undefined : (resourceFilter as ResourceType);
  const {
    data: sharedResources,
    loading: resourcesLoading,
    error: resourcesError,
    refetch: refetchResources,
  } = useSharedResources(tutorId ? { tutorId, resourceType } : {});

  // For parents, always start on assigned tab
  React.useEffect(() => {
    if (!isTutor) {
      setActiveTab('assigned');
    }
  }, [isTutor]);

  // Get unique children for parent filter (from assignments)
  const childrenFromAssignments = React.useMemo(() => {
    const uniqueStudents = new Map<string, { id: string; name: string }>();
    assignments.forEach(a => {
      if (a.student) {
        uniqueStudents.set(a.student.id, { id: a.student.id, name: a.student.name });
      }
    });
    return Array.from(uniqueStudents.values());
  }, [assignments]);

  // Filtered assignments for parent view
  const filteredAssignments = React.useMemo(() => {
    let filtered = assignments;

    // Filter by status
    if (statusFilter === 'pending') {
      filtered = filtered.filter(a => a.status !== 'completed');
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(a => a.status === 'completed');
    }

    // Filter by child
    if (selectedChild) {
      filtered = filtered.filter(a => a.student_id === selectedChild);
    }

    return filtered;
  }, [assignments, statusFilter, selectedChild]);

  // Filtered assignments for admin/tutor view
  const adminFilteredAssignments = React.useMemo(() => {
    let filtered = assignments;

    // Filter by status
    if (adminStatusFilter === 'pending') {
      filtered = filtered.filter(a => a.status !== 'completed');
    } else if (adminStatusFilter === 'completed') {
      filtered = filtered.filter(a => a.status === 'completed');
    }

    // Filter by student
    if (adminStudentFilter) {
      filtered = filtered.filter(a => a.student_id === adminStudentFilter);
    }

    // Filter by worksheet type
    if (adminTypeFilter !== 'all') {
      filtered = filtered.filter(a => a.worksheet_type === adminTypeFilter);
    }

    return filtered;
  }, [assignments, adminStatusFilter, adminStudentFilter, adminTypeFilter]);

  // Assignment counts for admin filters
  const assignmentCounts = React.useMemo(() => {
    return {
      all: assignments.length,
      pending: assignments.filter(a => a.status !== 'completed').length,
      completed: assignments.filter(a => a.status === 'completed').length,
      piano_naming: assignments.filter(a => a.worksheet_type === 'piano_naming').length,
      piano_drawing: assignments.filter(a => a.worksheet_type === 'piano_drawing').length,
      math: assignments.filter(a => a.worksheet_type === 'math').length,
    };
  }, [assignments]);

  // Get admin selected student name
  const getAdminSelectedStudentName = useCallback(() => {
    if (!adminStudentFilter) return 'All Students';
    const student = students?.find((s) => s.id === adminStudentFilter);
    return student?.name || 'Unknown Student';
  }, [adminStudentFilter, students]);

  // Filtered resources for library tab
  const filteredResources = React.useMemo(() => {
    if (!selectedStudent) return sharedResources;
    return sharedResources.filter((r) => r.student_id === selectedStudent);
  }, [sharedResources, selectedStudent]);

  // Resource counts for library filters
  const resourceCounts = React.useMemo(() => {
    return {
      all: sharedResources.length,
      worksheet: sharedResources.filter((r) => r.resource_type === 'worksheet').length,
      pdf: sharedResources.filter((r) => r.resource_type === 'pdf').length,
      image: sharedResources.filter((r) => r.resource_type === 'image').length,
      video: sharedResources.filter((r) => r.resource_type === 'video').length,
    };
  }, [sharedResources]);

  // Library refresh handler
  const handleRefreshLibrary = useCallback(async () => {
    setRefreshingLibrary(true);
    await refetchResources();
    setRefreshingLibrary(false);
  }, [refetchResources]);

  // Library resource press handler
  const handleResourcePress = useCallback((resource: SharedResourceWithStudent) => {
    setSelectedResource(resource);
    setShowResourceViewer(true);
  }, []);

  // Handle delete resource (tutor only)
  const handleDeleteResource = useCallback(async (resource: SharedResourceWithStudent) => {
    const confirmMessage = `Are you sure you want to delete "${resource.title}"? This action cannot be undone.`;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;

      const success = await deleteResource(
        resource.id,
        resource.storage_path,
        resource.resource_type
      );
      if (success) {
        window.alert('Resource deleted successfully');
        refetchResources();
      } else {
        window.alert('Failed to delete resource. Please try again.');
      }
    } else {
      Alert.alert(
        'Delete Resource',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const success = await deleteResource(
                resource.id,
                resource.storage_path,
                resource.resource_type
              );
              if (success) {
                Alert.alert('Success', 'Resource deleted successfully');
                refetchResources();
              } else {
                Alert.alert('Error', 'Failed to delete resource. Please try again.');
              }
            },
          },
        ]
      );
    }
  }, [deleteResource, refetchResources]);

  // Toggle select mode
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(prev => {
      if (prev) {
        // Exiting select mode, clear selections
        setSelectedResourceIds([]);
      }
      return !prev;
    });
  }, []);

  // Handle resource selection toggle
  const handleSelectResource = useCallback((resource: SharedResourceWithStudent) => {
    setSelectedResourceIds(prev => {
      const index = prev.indexOf(resource.id);
      if (index > -1) {
        // Remove from selection
        return prev.filter(id => id !== resource.id);
      } else {
        // Add to selection
        return [...prev, resource.id];
      }
    });
  }, []);

  // Select all visible resources
  const selectAllResources = useCallback(() => {
    setSelectedResourceIds(filteredResources.map(r => r.id));
  }, [filteredResources]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    const count = selectedResourceIds.length;
    if (count === 0) {
      if (Platform.OS === 'web') {
        window.alert('Please select resources to delete.');
      } else {
        Alert.alert('No Selection', 'Please select resources to delete.');
      }
      return;
    }

    // Confirmation - handle web vs native differently
    const confirmMessage = `Are you sure you want to delete ${count} resource${count > 1 ? 's' : ''}? This action cannot be undone.`;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;

      // Proceed with deletion
      let successCount = 0;
      let failCount = 0;

      const resourcesToDelete = filteredResources.filter(r => selectedResourceIds.includes(r.id));

      for (const resource of resourcesToDelete) {
        const success = await deleteResource(
          resource.id,
          resource.storage_path,
          resource.resource_type
        );
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      // Exit select mode and clear selections
      setIsSelectMode(false);
      setSelectedResourceIds([]);

      // Refresh the list
      await refetchResources();

      // Show result
      if (failCount === 0) {
        window.alert(`${successCount} resource${successCount > 1 ? 's' : ''} deleted successfully`);
      } else {
        window.alert(`${successCount} deleted, ${failCount} failed. Please try again for failed items.`);
      }
    } else {
      // Native alert
      Alert.alert(
        'Delete Selected Resources',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete All',
            style: 'destructive',
            onPress: async () => {
              let successCount = 0;
              let failCount = 0;

              const resourcesToDelete = filteredResources.filter(r => selectedResourceIds.includes(r.id));

              for (const resource of resourcesToDelete) {
                const success = await deleteResource(
                  resource.id,
                  resource.storage_path,
                  resource.resource_type
                );
                if (success) {
                  successCount++;
                } else {
                  failCount++;
                }
              }

              // Exit select mode and clear selections
              setIsSelectMode(false);
              setSelectedResourceIds([]);

              // Refresh the list
              await refetchResources();

              // Show result
              if (failCount === 0) {
                Alert.alert('Success', `${successCount} resource${successCount > 1 ? 's' : ''} deleted successfully`);
              } else {
                Alert.alert(
                  'Partial Success',
                  `${successCount} deleted, ${failCount} failed. Please try again for failed items.`
                );
              }
            },
          },
        ]
      );
    }
  }, [selectedResourceIds, filteredResources, deleteResource, refetchResources]);

  // Toggle assignment select mode
  const toggleAssignmentSelectMode = useCallback(() => {
    setIsAssignmentSelectMode(prev => {
      if (prev) {
        // Exiting select mode, clear selections
        setSelectedAssignmentIds([]);
      }
      return !prev;
    });
  }, []);

  // Handle assignment selection toggle
  const handleSelectAssignment = useCallback((assignmentId: string) => {
    setSelectedAssignmentIds(prev => {
      const index = prev.indexOf(assignmentId);
      if (index > -1) {
        // Remove from selection
        return prev.filter(id => id !== assignmentId);
      } else {
        // Add to selection
        return [...prev, assignmentId];
      }
    });
  }, []);

  // Select all visible assignments
  const selectAllAssignments = useCallback(() => {
    setSelectedAssignmentIds(adminFilteredAssignments.map(a => a.id));
  }, [adminFilteredAssignments]);

  // Handle bulk delete assignments
  const handleBulkDeleteAssignments = useCallback(async () => {
    const count = selectedAssignmentIds.length;
    if (count === 0) {
      if (Platform.OS === 'web') {
        window.alert('Please select assignments to delete.');
      } else {
        Alert.alert('No Selection', 'Please select assignments to delete.');
      }
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${count} worksheet${count > 1 ? 's' : ''}? This action cannot be undone.`;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;

      // Proceed with deletion
      let successCount = 0;
      let failCount = 0;

      for (const assignmentId of selectedAssignmentIds) {
        const success = await deleteAssignment(assignmentId);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      // Exit select mode and clear selections
      setIsAssignmentSelectMode(false);
      setSelectedAssignmentIds([]);

      // Refresh the list
      await refetchAssignments();

      // Show result
      if (failCount === 0) {
        window.alert(`${successCount} worksheet${successCount > 1 ? 's' : ''} deleted successfully`);
      } else {
        window.alert(`${successCount} deleted, ${failCount} failed. Please try again for failed items.`);
      }
    } else {
      // Native alert
      Alert.alert(
        'Delete Selected Worksheets',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete All',
            style: 'destructive',
            onPress: async () => {
              let successCount = 0;
              let failCount = 0;

              for (const assignmentId of selectedAssignmentIds) {
                const success = await deleteAssignment(assignmentId);
                if (success) {
                  successCount++;
                } else {
                  failCount++;
                }
              }

              // Exit select mode and clear selections
              setIsAssignmentSelectMode(false);
              setSelectedAssignmentIds([]);

              // Refresh the list
              await refetchAssignments();

              // Show result
              if (failCount === 0) {
                Alert.alert('Success', `${successCount} worksheet${successCount > 1 ? 's' : ''} deleted successfully`);
              } else {
                Alert.alert(
                  'Partial Success',
                  `${successCount} deleted, ${failCount} failed. Please try again for failed items.`
                );
              }
            },
          },
        ]
      );
    }
  }, [selectedAssignmentIds, deleteAssignment, refetchAssignments]);

  // Get selected student name for dropdown display
  const getSelectedStudentName = useCallback(() => {
    if (!selectedStudent) return 'All Students';
    const student = students?.find((s) => s.id === selectedStudent);
    return student?.name || 'Unknown Student';
  }, [selectedStudent, students]);

  // Handle marking assignment as complete
  const handleMarkComplete = async (assignmentId: string) => {
    try {
      await completeAssignment(assignmentId);
      await refetchAssignments();
      Alert.alert('Success', 'Worksheet marked as completed!');
    } catch (error) {
      console.error('Error completing assignment:', error);
      Alert.alert('Error', 'Failed to mark worksheet as complete. Please try again.');
    }
  };

  // Handle deleting an assignment (admin only)
  const handleDeleteAssignment = useCallback(async (assignment: AssignmentWithStudent) => {
    const confirmMessage = `Are you sure you want to delete this ${getWorksheetTypeName(assignment.worksheet_type)} worksheet assigned to ${assignment.student?.name || 'Unknown'}?`;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;

      const success = await deleteAssignment(assignment.id);
      if (success) {
        window.alert('Assignment deleted successfully');
        refetchAssignments();
      } else {
        window.alert('Failed to delete assignment. Please try again.');
      }
    } else {
      Alert.alert(
        'Delete Assignment',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const success = await deleteAssignment(assignment.id);
              if (success) {
                Alert.alert('Success', 'Assignment deleted successfully');
                refetchAssignments();
              } else {
                Alert.alert('Error', 'Failed to delete assignment. Please try again.');
              }
            },
          },
        ]
      );
    }
  }, [deleteAssignment, refetchAssignments]);

  // Handle viewing/printing a worksheet (regenerates from stored config if needed)
  const handleViewWorksheet = useCallback(async (assignment: AssignmentWithStudent) => {
    const studentName = assignment.student?.name || 'Student';

    // If it's a piano worksheet, regenerate from stored config
    if (assignment.worksheet_type === 'piano_naming' || assignment.worksheet_type === 'piano_drawing') {
      const result = generatePianoWorksheetFromConfig(assignment.config, studentName);

      if (!result) {
        Alert.alert('Error', 'Unable to generate worksheet. Invalid configuration.');
        return;
      }

      // On web, open in a new window
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.worksheetHtml);
          printWindow.document.close();
        } else {
          Alert.alert('Error', 'Unable to open worksheet. Please allow popups for this site.');
        }
        return;
      }

      // On mobile, if we have a stored PDF URL, try to share it first
      if (assignment.pdf_url) {
        try {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(assignment.pdf_url, {
              mimeType: 'application/pdf',
              dialogTitle: 'Print Worksheet',
            });
            return;
          }
        } catch (error) {
          console.log('Stored PDF not accessible, regenerating...');
        }
      }

      // Generate PDF on the fly and share
      try {
        const printResult = await Print.printToFileAsync({
          html: result.worksheetHtml,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(printResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Print Worksheet',
          });
        }
      } catch (error) {
        console.error('Error generating worksheet PDF:', error);
        Alert.alert('Error', 'Unable to generate worksheet PDF.');
      }
    } else {
      // Math worksheet - not yet supported
      Alert.alert('Coming Soon', 'Math worksheet viewing is not yet available.');
    }
  }, []);

  const handleOpenGenerator = (subject?: TutoringSubject) => {
    setPresetSubject(subject);
    setShowGenerator(true);
  };

  const handleGenerateWorksheet = useCallback(async (config: WorksheetConfig, studentId: string) => {
    // Find student name for worksheet
    const student = students.find(s => s.id === studentId);
    const studentName = student?.name || 'Student';

    // Check if it's a piano worksheet
    if ('type' in config && (config.type === 'note_naming' || config.type === 'note_drawing')) {
      const pianoConfig = config as PianoWorksheetConfig;

      // Generate the worksheet HTML
      const result = generatePianoWorksheet(pianoConfig, studentName);
      const worksheetType = pianoConfig.type === 'note_naming' ? 'piano_naming' : 'piano_drawing';

      try {
        // Check if we're on a platform that supports printing
        const canPrint = Platform.OS !== 'web';

        if (canPrint) {
          // Generate PDF from HTML using expo-print
          const printResult = await Print.printToFileAsync({
            html: result.worksheetHtml,
          });

          // Save the assignment to database
          await createAssignment({
            student_id: studentId,
            worksheet_type: worksheetType,
            config: config as unknown as Record<string, unknown>,
            pdf_url: printResult.uri,
          });

          // Share/preview the PDF
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(printResult.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Piano Worksheet',
            });
          }

          // Refresh assignments list
          refetchAssignments();

          Alert.alert(
            'Worksheet Created!',
            `A ${pianoConfig.type.replace('_', ' ')} worksheet has been created for ${studentName}.`,
            [{ text: 'OK' }]
          );
        } else {
          // Web platform - save assignment without PDF, offer to print HTML directly
          await createAssignment({
            student_id: studentId,
            worksheet_type: worksheetType,
            config: config as unknown as Record<string, unknown>,
          });

          refetchAssignments();

          // On web, we can use window.print() to print the HTML
          Alert.alert(
            'Worksheet Created!',
            `Worksheet assigned to ${studentName}. On web, use browser print to generate PDF.`,
            [
              { text: 'OK' },
              {
                text: 'Print Now',
                onPress: () => {
                  // Open a new window with the worksheet HTML and trigger print
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(result.worksheetHtml);
                    printWindow.document.close();
                    printWindow.print();
                  }
                },
              },
            ]
          );
        }
      } catch (error) {
        console.error('Error generating worksheet:', error);

        // Still save the assignment even if PDF generation fails
        await createAssignment({
          student_id: studentId,
          worksheet_type: worksheetType,
          config: config as unknown as Record<string, unknown>,
        });

        refetchAssignments();

        Alert.alert(
          'Worksheet Assigned',
          `Worksheet assigned to ${studentName}. PDF generation encountered an issue but the assignment was saved.`,
          [{ text: 'OK' }]
        );
      }
    } else {
      // Math worksheet - for now, just save as assignment
      // Later: integrate with SheetMagic API or WebView
      await createAssignment({
        student_id: studentId,
        worksheet_type: 'math',
        config: config as unknown as Record<string, unknown>,
      });

      refetchAssignments();

      Alert.alert(
        'Math Worksheet',
        `Math worksheet configuration saved for ${studentName}. Full generation coming soon via SheetMagic integration!`,
        [{ text: 'OK' }]
      );
    }
  }, [students, createAssignment, refetchAssignments]);

  const handleQuickTemplate = (
    subject: TutoringSubject,
    _templateConfig: Record<string, unknown>
  ) => {
    // Pre-fill generator with template settings
    setPresetSubject(subject);
    setShowGenerator(true);
    // The modal will use preset subject to show appropriate initial config
  };

  // Handle PDF worksheet upload completion
  const handleUploadComplete = useCallback(async (input: CreateSharedResourceInput) => {
    try {
      await createSharedResource(input);
      // Refresh the library to show the new resource
      await refetchResources();
      if (Platform.OS === 'web') {
        window.alert('Worksheet uploaded and shared with parent!');
      } else {
        Alert.alert('Success', 'Worksheet uploaded and shared with parent!');
      }
    } catch (error) {
      console.error('Error sharing worksheet:', error);
      throw error;
    }
  }, [createSharedResource, refetchResources]);

  // Handle image share completion
  const handleImageShareComplete = useCallback(async (input: CreateSharedResourceInput) => {
    try {
      await createSharedResource(input);
      // Refresh the library to show the new resource
      await refetchResources();
      if (Platform.OS === 'web') {
        window.alert('Image shared with parent!');
      } else {
        Alert.alert('Success', 'Image shared with parent!');
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      throw error;
    }
  }, [createSharedResource, refetchResources]);

  // Handle YouTube share completion
  const handleYouTubeShareComplete = useCallback(async (input: CreateSharedResourceInput) => {
    try {
      await createSharedResource(input);
      // Refresh the library to show the new resource
      await refetchResources();
      if (Platform.OS === 'web') {
        window.alert('Video link shared with parent!');
      } else {
        Alert.alert('Success', 'Video link shared with parent!');
      }
    } catch (error) {
      console.error('Error sharing video:', error);
      throw error;
    }
  }, [createSharedResource, refetchResources]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get worksheet type display name
  const getWorksheetTypeName = (type: string) => {
    switch (type) {
      case 'piano_naming': return 'Note Naming';
      case 'piano_drawing': return 'Note Drawing';
      case 'math': return 'Math';
      default: return type;
    }
  };

  // Get icon for worksheet type
  const getWorksheetIcon = (type: string) => {
    switch (type) {
      case 'piano_naming': return '🎼';
      case 'piano_drawing': return '✏️';
      case 'math': return '➗';
      default: return '📄';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab Bar - Only show for tutors */}
      {isTutor && (
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, activeTab === 'generate' && styles.tabActive]}
            onPress={() => setActiveTab('generate')}
          >
            <Ionicons
              name="sparkles"
              size={20}
              color={activeTab === 'generate' ? colors.piano.primary : colors.neutral.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'generate' && styles.tabTextActive,
              ]}
            >
              Generate
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'assigned' && styles.tabActive]}
            onPress={() => setActiveTab('assigned')}
          >
            <Ionicons
              name="document-text"
              size={20}
              color={activeTab === 'assigned' ? colors.piano.primary : colors.neutral.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'assigned' && styles.tabTextActive,
              ]}
            >
              Assigned
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'library' && styles.tabActive]}
            onPress={() => setActiveTab('library')}
          >
            <Ionicons
              name="library"
              size={20}
              color={activeTab === 'library' ? colors.piano.primary : colors.neutral.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'library' && styles.tabTextActive,
              ]}
            >
              Library
            </Text>
            {sharedResources.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{sharedResources.length}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* Parent Header with Filters */}
      {!isTutor && (
        <View style={styles.parentHeader}>
          <Text style={styles.parentHeaderTitle}>Worksheets</Text>

          {/* Child Filter */}
          {childrenFromAssignments.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.childFilter}
              contentContainerStyle={styles.childFilterContent}
            >
              <Pressable
                style={[
                  styles.filterChip,
                  selectedChild === null && styles.filterChipActive,
                ]}
                onPress={() => setSelectedChild(null)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedChild === null && styles.filterChipTextActive,
                  ]}
                >
                  All Kids
                </Text>
              </Pressable>
              {childrenFromAssignments.map(child => (
                <Pressable
                  key={child.id}
                  style={[
                    styles.filterChip,
                    selectedChild === child.id && styles.filterChipActive,
                  ]}
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

          {/* Status Filter */}
          <View style={styles.statusFilter}>
            {(['all', 'pending', 'completed'] as FilterOption[]).map(filter => (
              <Pressable
                key={filter}
                style={[
                  styles.statusChip,
                  statusFilter === filter && styles.statusChipActive,
                ]}
                onPress={() => setStatusFilter(filter)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    statusFilter === filter && styles.statusChipTextActive,
                  ]}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'generate' ? (
          <>
            {/* Main Generate Button */}
            <Pressable
              style={styles.generateButton}
              onPress={() => handleOpenGenerator()}
            >
              <View style={styles.generateButtonGradient}>
                <View style={styles.generateButtonContent}>
                  <View style={styles.generateIconContainer}>
                    <Ionicons name="sparkles" size={32} color={colors.neutral.white} />
                  </View>
                  <Text style={styles.generateButtonTitle}>
                    Generate New Worksheet
                  </Text>
                  <Text style={styles.generateButtonSubtitle}>
                    AI-powered worksheets for piano & math
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Piano Templates */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>🎹</Text>
                <Text style={styles.sectionTitle}>Piano Worksheets</Text>
              </View>
              <View style={styles.templateGrid}>
                {PIANO_TEMPLATES.map((template) => (
                  <Pressable
                    key={template.id}
                    style={styles.templateCard}
                    onPress={() => handleQuickTemplate('piano', template)}
                  >
                    <View
                      style={[
                        styles.templateIconContainer,
                        { backgroundColor: colors.piano.subtle },
                      ]}
                    >
                      <Text style={styles.templateIcon}>{template.icon}</Text>
                    </View>
                    <Text style={styles.templateLabel}>{template.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Math Templates */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>➗</Text>
                <Text style={styles.sectionTitle}>Math Worksheets</Text>
              </View>
              <View style={styles.templateGrid}>
                {MATH_TEMPLATES.map((template) => (
                  <Pressable
                    key={template.id}
                    style={styles.templateCard}
                    onPress={() => handleQuickTemplate('math', template)}
                  >
                    <View
                      style={[
                        styles.templateIconContainer,
                        { backgroundColor: colors.math.subtle },
                      ]}
                    >
                      <Text style={styles.templateIcon}>{template.icon}</Text>
                    </View>
                    <Text style={styles.templateLabel}>{template.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Share Resources Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>📤</Text>
                <Text style={styles.sectionTitle}>Share with Parents</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Share worksheets, images, and videos with parents
              </Text>
              <View style={styles.shareActionsGrid}>
                <Pressable
                  style={styles.shareActionCard}
                  onPress={() => setShowUploadModal(true)}
                >
                  <View style={[styles.shareActionIcon, { backgroundColor: colors.math.subtle }]}>
                    <Ionicons name="document" size={24} color={colors.math.primary} />
                  </View>
                  <Text style={styles.shareActionLabel}>Upload PDF</Text>
                  <Text style={styles.shareActionDescription}>Upload worksheet files</Text>
                </Pressable>

                <Pressable
                  style={styles.shareActionCard}
                  onPress={() => setShowImageModal(true)}
                >
                  <View style={[styles.shareActionIcon, { backgroundColor: colors.status.infoBg }]}>
                    <Ionicons name="image" size={24} color={colors.status.info} />
                  </View>
                  <Text style={styles.shareActionLabel}>Share Image</Text>
                  <Text style={styles.shareActionDescription}>Photos from sessions</Text>
                </Pressable>

                <Pressable
                  style={styles.shareActionCard}
                  onPress={() => setShowYouTubeModal(true)}
                >
                  <View style={[styles.shareActionIcon, { backgroundColor: '#FFEBEE' }]}>
                    <Ionicons name="logo-youtube" size={24} color="#FF0000" />
                  </View>
                  <Text style={styles.shareActionLabel}>Share Video</Text>
                  <Text style={styles.shareActionDescription}>YouTube recordings</Text>
                </Pressable>
              </View>
            </View>

            {/* How It Works */}
            <View style={styles.howItWorks}>
              <Text style={styles.howItWorksTitle}>How It Works</Text>
              <View style={styles.stepsList}>
                <View style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Choose Subject</Text>
                    <Text style={styles.stepDescription}>
                      Select piano or math worksheet type
                    </Text>
                  </View>
                </View>
                <View style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Configure Options</Text>
                    <Text style={styles.stepDescription}>
                      Set difficulty, topics, and problem count
                    </Text>
                  </View>
                </View>
                <View style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Generate & Assign</Text>
                    <Text style={styles.stepDescription}>
                      AI creates a personalized worksheet PDF
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : activeTab === 'assigned' ? (
          /* Assigned Tab */
          <>
            {/* Admin Filters */}
            {isTutor && (
              <View style={styles.adminFiltersContainer}>
                {/* Header with count */}
                <View style={styles.adminFiltersHeader}>
                  <Text style={styles.adminFiltersTitle}>Assigned Worksheets</Text>
                  <Text style={styles.adminFiltersCount}>
                    {adminFilteredAssignments.length} of {assignments.length}
                  </Text>
                </View>

                {/* Student Filter Dropdown */}
                <View style={styles.adminFilterRow}>
                  <Text style={styles.adminFilterLabel}>Student:</Text>
                  <Pressable
                    style={styles.adminFilterDropdown}
                    onPress={() => setShowAdminStudentPicker(true)}
                  >
                    <Ionicons
                      name="person"
                      size={16}
                      color={adminStudentFilter ? colors.piano.primary : colors.neutral.textSecondary}
                    />
                    <Text
                      style={[
                        styles.adminFilterDropdownText,
                        adminStudentFilter && styles.adminFilterDropdownTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {getAdminSelectedStudentName()}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.neutral.textSecondary} />
                  </Pressable>
                  {adminStudentFilter && (
                    <Pressable
                      style={styles.adminFilterClearBtn}
                      onPress={() => setAdminStudentFilter(null)}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.neutral.textMuted} />
                    </Pressable>
                  )}
                </View>

                {/* Status Filter Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.adminFilterChips}
                  contentContainerStyle={styles.adminFilterChipsContent}
                >
                  {(['all', 'pending', 'completed'] as FilterOption[]).map((filter) => (
                    <Pressable
                      key={filter}
                      style={[
                        styles.adminFilterChip,
                        adminStatusFilter === filter && styles.adminFilterChipActive,
                      ]}
                      onPress={() => setAdminStatusFilter(filter)}
                    >
                      <Text
                        style={[
                          styles.adminFilterChipText,
                          adminStatusFilter === filter && styles.adminFilterChipTextActive,
                        ]}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </Text>
                      <View
                        style={[
                          styles.adminFilterChipBadge,
                          adminStatusFilter === filter && styles.adminFilterChipBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.adminFilterChipBadgeText,
                            adminStatusFilter === filter && styles.adminFilterChipBadgeTextActive,
                          ]}
                        >
                          {filter === 'all' ? assignmentCounts.all : filter === 'pending' ? assignmentCounts.pending : assignmentCounts.completed}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Type Filter Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.adminFilterChips}
                  contentContainerStyle={styles.adminFilterChipsContent}
                >
                  {[
                    { value: 'all' as const, label: 'All Types', icon: 'apps' },
                    { value: 'piano_naming' as const, label: 'Note Naming', icon: 'musical-notes' },
                    { value: 'piano_drawing' as const, label: 'Note Drawing', icon: 'pencil' },
                    { value: 'math' as const, label: 'Math', icon: 'calculator' },
                  ].map((type) => (
                    <Pressable
                      key={type.value}
                      style={[
                        styles.adminFilterChip,
                        adminTypeFilter === type.value && styles.adminFilterChipActive,
                      ]}
                      onPress={() => setAdminTypeFilter(type.value)}
                    >
                      <Ionicons
                        name={type.icon as any}
                        size={14}
                        color={adminTypeFilter === type.value ? colors.piano.primary : colors.neutral.textMuted}
                      />
                      <Text
                        style={[
                          styles.adminFilterChipText,
                          adminTypeFilter === type.value && styles.adminFilterChipTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                      {type.value !== 'all' && (
                        <View
                          style={[
                            styles.adminFilterChipBadge,
                            adminTypeFilter === type.value && styles.adminFilterChipBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.adminFilterChipBadgeText,
                              adminTypeFilter === type.value && styles.adminFilterChipBadgeTextActive,
                            ]}
                          >
                            {assignmentCounts[type.value]}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Clear All Filters */}
                {(adminStatusFilter !== 'all' || adminStudentFilter || adminTypeFilter !== 'all') && (
                  <Pressable
                    style={styles.clearAllFiltersBtn}
                    onPress={() => {
                      setAdminStatusFilter('all');
                      setAdminStudentFilter(null);
                      setAdminTypeFilter('all');
                    }}
                  >
                    <Ionicons name="refresh" size={14} color={colors.piano.primary} />
                    <Text style={styles.clearAllFiltersText}>Clear All Filters</Text>
                  </Pressable>
                )}

                {/* Select Mode Controls for Bulk Delete */}
                {adminFilteredAssignments.length > 0 && (
                  <View style={styles.assignmentSelectControls}>
                    {isAssignmentSelectMode ? (
                      <>
                        <Pressable style={styles.selectAllButton} onPress={selectAllAssignments}>
                          <Ionicons name="checkbox-outline" size={18} color={colors.piano.primary} />
                          <Text style={styles.selectAllText}>Select All</Text>
                        </Pressable>
                        <Text style={styles.selectedCount}>
                          {selectedAssignmentIds.length} selected
                        </Text>
                        <View style={styles.selectModeActions}>
                          <Pressable
                            style={[styles.bulkDeleteButton, selectedAssignmentIds.length === 0 && styles.bulkDeleteButtonDisabled]}
                            onPress={handleBulkDeleteAssignments}
                            disabled={selectedAssignmentIds.length === 0 || deletingAssignment}
                          >
                            {deletingAssignment ? (
                              <ActivityIndicator size="small" color={colors.status.error} />
                            ) : (
                              <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                            )}
                            <Text style={styles.bulkDeleteText}>Delete</Text>
                          </Pressable>
                          <Pressable style={styles.cancelSelectButton} onPress={toggleAssignmentSelectMode}>
                            <Text style={styles.cancelSelectText}>Cancel</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <Pressable style={styles.enterSelectButton} onPress={toggleAssignmentSelectMode}>
                        <Ionicons name="checkmark-circle-outline" size={18} color={colors.neutral.textSecondary} />
                        <Text style={styles.enterSelectText}>Select to Delete</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}

            {assignmentsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.piano.primary} />
                <Text style={styles.loadingText}>Loading worksheets...</Text>
              </View>
            ) : (isTutor ? adminFilteredAssignments : filteredAssignments).length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons
                    name="document-text-outline"
                    size={64}
                    color={colors.neutral.border}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {(isTutor && (adminStatusFilter !== 'all' || adminStudentFilter || adminTypeFilter !== 'all')) ||
                   (!isTutor && (statusFilter !== 'all' || selectedChild))
                    ? 'No Matching Worksheets'
                    : 'No Assigned Worksheets'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isTutor
                    ? (adminStatusFilter !== 'all' || adminStudentFilter || adminTypeFilter !== 'all')
                      ? 'Try adjusting your filters to see more worksheets.'
                      : 'Generate a worksheet and assign it to a student to track their progress.'
                    : !isTutor && (statusFilter !== 'all' || selectedChild)
                      ? 'Try adjusting your filters to see more worksheets.'
                      : 'Your assigned worksheets will appear here once your tutor assigns them.'}
                </Text>
                {isTutor && !(adminStatusFilter !== 'all' || adminStudentFilter || adminTypeFilter !== 'all') && (
                  <Pressable
                    style={styles.emptyButton}
                    onPress={() => {
                      setActiveTab('generate');
                    }}
                  >
                    <Ionicons
                      name="sparkles"
                      size={18}
                      color={colors.neutral.white}
                    />
                    <Text style={styles.emptyButtonText}>Generate Worksheet</Text>
                  </Pressable>
                )}
                {isTutor && (adminStatusFilter !== 'all' || adminStudentFilter || adminTypeFilter !== 'all') && (
                  <Pressable
                    style={styles.emptyButton}
                    onPress={() => {
                      setAdminStatusFilter('all');
                      setAdminStudentFilter(null);
                      setAdminTypeFilter('all');
                    }}
                  >
                    <Ionicons
                      name="refresh"
                      size={18}
                      color={colors.neutral.white}
                    />
                    <Text style={styles.emptyButtonText}>Clear Filters</Text>
                  </Pressable>
                )}
                {!isTutor && (statusFilter !== 'all' || selectedChild) && (
                  <Pressable
                    style={styles.emptyButton}
                    onPress={() => {
                      setStatusFilter('all');
                      setSelectedChild(null);
                    }}
                  >
                    <Ionicons
                      name="refresh"
                      size={18}
                      color={colors.neutral.white}
                    />
                    <Text style={styles.emptyButtonText}>Clear Filters</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.assignmentsList}>
                {(isTutor ? adminFilteredAssignments : filteredAssignments).map((assignment: AssignmentWithStudent) => {
                  const isPianoWorksheet = assignment.worksheet_type === 'piano_naming' || assignment.worksheet_type === 'piano_drawing';
                  const isSelected = selectedAssignmentIds.includes(assignment.id);

                  return (
                    <View key={assignment.id} style={styles.assignmentCardContainer}>
                      {/* Checkbox for select mode (tutor only) */}
                      {isTutor && isAssignmentSelectMode && (
                        <Pressable
                          style={styles.assignmentCheckbox}
                          onPress={() => handleSelectAssignment(assignment.id)}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={24}
                            color={isSelected ? colors.piano.primary : colors.neutral.textMuted}
                          />
                        </Pressable>
                      )}

                      <Pressable
                        style={[
                          styles.assignmentCard,
                          isAssignmentSelectMode && styles.assignmentCardSelectMode,
                          isSelected && styles.assignmentCardSelected,
                        ]}
                        onPress={() => {
                          // In select mode, toggle selection
                          if (isTutor && isAssignmentSelectMode) {
                            handleSelectAssignment(assignment.id);
                            return;
                          }

                          // Normal mode - handle viewing
                          if (Platform.OS === 'web') {
                            // For parents or non-piano worksheets on web, just view
                            if (!isTutor) {
                              if (isPianoWorksheet) {
                                handleViewWorksheet(assignment);
                              } else {
                                window.alert(`${getWorksheetTypeName(assignment.worksheet_type)}\n\nFor: ${assignment.student?.name || 'Unknown'}\nAssigned: ${formatDate(assignment.assigned_at)}`);
                              }
                            }
                            // For tutors on web, let action buttons handle it
                            return;
                          }

                          // On mobile, use Alert.alert with options
                          if (isTutor) {
                            const options: Array<{ text: string; style?: 'cancel' | 'default' | 'destructive'; onPress?: () => void }> = [
                              { text: 'Close', style: 'cancel' },
                            ];

                            if (isPianoWorksheet) {
                              options.push({
                                text: 'View / Print',
                                style: 'default',
                                onPress: () => handleViewWorksheet(assignment),
                              });
                            }

                            options.push({
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => handleDeleteAssignment(assignment),
                            });

                            Alert.alert(
                              getWorksheetTypeName(assignment.worksheet_type),
                              `Assigned to: ${assignment.student?.name || 'Unknown'}\nStatus: ${assignment.status}\nAssigned: ${formatDate(assignment.assigned_at)}`,
                              options
                            );
                          } else {
                            // Parent: show action options
                            const options: Array<{ text: string; style?: 'cancel' | 'default' | 'destructive'; onPress?: () => void }> = [
                              { text: 'Close', style: 'cancel' },
                            ];

                            if (isPianoWorksheet) {
                              options.push({
                                text: 'View / Print',
                                style: 'default',
                                onPress: () => handleViewWorksheet(assignment),
                              });
                            }

                            if (assignment.status !== 'completed') {
                              options.push({
                                text: 'Mark as Done',
                                style: 'default',
                                onPress: () => handleMarkComplete(assignment.id),
                              });
                            }

                            Alert.alert(
                              getWorksheetTypeName(assignment.worksheet_type),
                              `For: ${assignment.student?.name || 'Unknown'}\nAssigned: ${formatDate(assignment.assigned_at)}${assignment.due_date ? `\nDue: ${formatDate(assignment.due_date)}` : ''}`,
                              options
                            );
                          }
                        }}
                      >
                        <View
                          style={[
                            styles.assignmentIcon,
                            {
                              backgroundColor: assignment.worksheet_type.startsWith('piano')
                                ? colors.piano.subtle
                                : colors.math.subtle,
                            },
                          ]}
                        >
                          <Text style={styles.assignmentEmoji}>
                            {getWorksheetIcon(assignment.worksheet_type)}
                          </Text>
                        </View>
                        <View style={styles.assignmentInfo}>
                          <Text style={styles.assignmentTitle}>
                            {getWorksheetTypeName(assignment.worksheet_type)}
                          </Text>
                          <Text style={styles.assignmentStudent}>
                            {assignment.student?.name || 'Unknown Student'}
                          </Text>
                          <Text style={styles.assignmentDate}>
                            Assigned {formatDate(assignment.assigned_at)}
                          </Text>
                        </View>

                        {/* Action buttons for tutor on web (not in select mode) */}
                        {isTutor && Platform.OS === 'web' && !isAssignmentSelectMode ? (
                          <View style={styles.assignmentActions}>
                            {isPianoWorksheet && (
                              <Pressable
                                style={styles.assignmentActionBtn}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleViewWorksheet(assignment);
                                }}
                              >
                                <Ionicons name="eye-outline" size={20} color={colors.piano.primary} />
                              </Pressable>
                            )}
                            <Pressable
                              style={[styles.assignmentActionBtn, styles.assignmentActionBtnDelete]}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleDeleteAssignment(assignment);
                              }}
                            >
                              <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                            </Pressable>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.statusBadge,
                              assignment.status === 'completed'
                                ? styles.statusCompleted
                                : styles.statusPending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,
                                assignment.status === 'completed'
                                  ? styles.statusTextCompleted
                                  : styles.statusTextPending,
                              ]}
                            >
                              {assignment.status === 'completed' ? 'Done' : 'Pending'}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : activeTab === 'library' ? (
          /* Library Tab - Tutor only */
          <>
            {/* Library Header with filters */}
            <View style={styles.libraryHeader}>
              <Text style={styles.libraryTitle}>Resource Library</Text>
              <Text style={styles.librarySubtitle}>
                {resourceCounts.all} resources shared with students
              </Text>
            </View>

            {/* Student Filter - Dropdown Picker */}
            {students && students.length > 0 && (
              <View style={styles.studentFilterContainer}>
                <Text style={styles.studentFilterLabel}>Filter by Student:</Text>
                <Pressable
                  style={styles.studentPickerButton}
                  onPress={() => setShowStudentPicker(true)}
                >
                  <Ionicons
                    name="person"
                    size={18}
                    color={selectedStudent ? colors.piano.primary : colors.neutral.textSecondary}
                  />
                  <Text
                    style={[
                      styles.studentPickerText,
                      selectedStudent && styles.studentPickerTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {getSelectedStudentName()}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={colors.neutral.textSecondary}
                  />
                </Pressable>
                {selectedStudent && (
                  <Pressable
                    style={styles.clearFilterButton}
                    onPress={() => setSelectedStudent(null)}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.neutral.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Resource Type Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeFilter}
              contentContainerStyle={styles.typeFilterContent}
            >
              {RESOURCE_FILTER_OPTIONS.map((option) => (
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
                  <View
                    style={[
                      styles.typeChipCount,
                      resourceFilter === option.value && styles.typeChipCountActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipCountText,
                        resourceFilter === option.value && styles.typeChipCountTextActive,
                      ]}
                    >
                      {resourceCounts[option.value]}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            {/* Select Mode Controls */}
            {filteredResources.length > 0 && (
              <View style={styles.selectModeControls}>
                {isSelectMode ? (
                  <>
                    <Pressable style={styles.selectAllButton} onPress={selectAllResources}>
                      <Ionicons name="checkbox-outline" size={18} color={colors.piano.primary} />
                      <Text style={styles.selectAllText}>Select All</Text>
                    </Pressable>
                    <Text style={styles.selectedCount}>
                      {selectedResourceIds.length} selected
                    </Text>
                    <View style={styles.selectModeActions}>
                      <Pressable
                        style={[styles.bulkDeleteButton, selectedResourceIds.length === 0 && styles.bulkDeleteButtonDisabled]}
                        onPress={handleBulkDelete}
                        disabled={selectedResourceIds.length === 0 || deletingResource}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                        <Text style={styles.bulkDeleteText}>Delete</Text>
                      </Pressable>
                      <Pressable style={styles.cancelSelectButton} onPress={toggleSelectMode}>
                        <Text style={styles.cancelSelectText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable style={styles.enterSelectButton} onPress={toggleSelectMode}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.neutral.textSecondary} />
                    <Text style={styles.enterSelectText}>Select</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Resources List */}
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
                  {resourcesError.message || 'Unable to load resources. Please try again.'}
                </Text>
                <Pressable style={styles.emptyButton} onPress={() => refetchResources()}>
                  <Ionicons name="refresh" size={18} color={colors.neutral.white} />
                  <Text style={styles.emptyButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : filteredResources.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="library-outline" size={64} color={colors.neutral.border} />
                </View>
                <Text style={styles.emptyTitle}>No Resources Yet</Text>
                <Text style={styles.emptySubtitle}>
                  {resourceFilter !== 'all'
                    ? `No ${resourceFilter}s have been shared yet.`
                    : 'Share worksheets, images, and videos with your students using the share options in the Generate tab.'}
                </Text>
                <Pressable style={styles.emptyButton} onPress={() => setActiveTab('generate')}>
                  <Ionicons name="sparkles" size={18} color={colors.neutral.white} />
                  <Text style={styles.emptyButtonText}>Generate & Share</Text>
                </Pressable>
              </View>
            ) : (
              <SharedResourceList
                resources={filteredResources}
                onResourcePress={handleResourcePress}
                onDelete={handleDeleteResource}
                showDeleteButton={!isSelectMode}
                compact={false}
                emptyMessage="No resources found"
                isSelectable={isSelectMode}
                selectedIds={selectedResourceIds}
                onSelect={handleSelectResource}
              />
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Worksheet Generator Modal */}
      <WorksheetGeneratorModal
        visible={showGenerator}
        onClose={() => {
          setShowGenerator(false);
          setPresetSubject(undefined);
        }}
        onGenerate={handleGenerateWorksheet}
        students={students}
        studentsLoading={studentsLoading}
        presetSubject={presetSubject}
      />

      {/* Upload Worksheet Modal */}
      {tutorId && (
        <UploadWorksheetModal
          visible={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
          students={students}
          studentsLoading={studentsLoading}
          tutorId={tutorId}
        />
      )}

      {/* Image Share Modal */}
      {tutorId && (
        <ImageShareModal
          visible={showImageModal}
          onClose={() => setShowImageModal(false)}
          onUploadComplete={handleImageShareComplete}
          students={students}
          studentsLoading={studentsLoading}
          tutorId={tutorId}
        />
      )}

      {/* YouTube Share Modal */}
      {tutorId && (
        <YouTubeShareModal
          visible={showYouTubeModal}
          onClose={() => setShowYouTubeModal(false)}
          onShare={handleYouTubeShareComplete}
          students={students}
          studentsLoading={studentsLoading}
          tutorId={tutorId}
        />
      )}

      {/* Resource Viewer Modal */}
      <ResourceViewerModal
        visible={showResourceViewer}
        resource={selectedResource}
        onClose={() => {
          setShowResourceViewer(false);
          setSelectedResource(null);
        }}
      />

      {/* Student Picker Modal */}
      <Modal
        visible={showStudentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStudentPicker(false)}
      >
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setShowStudentPicker(false)}
        >
          <Pressable style={styles.pickerContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Student</Text>
              <Pressable
                style={styles.pickerCloseButton}
                onPress={() => setShowStudentPicker(false)}
              >
                <Ionicons name="close" size={24} color={colors.neutral.text} />
              </Pressable>
            </View>

            <FlatList
              data={[{ id: null, name: 'All Students' }, ...(students || [])]}
              keyExtractor={(item) => item.id || 'all'}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.pickerItem,
                    (item.id === null && selectedStudent === null) ||
                    item.id === selectedStudent
                      ? styles.pickerItemActive
                      : null,
                  ]}
                  onPress={() => {
                    setSelectedStudent(item.id);
                    setShowStudentPicker(false);
                  }}
                >
                  <View style={styles.pickerItemLeft}>
                    <View
                      style={[
                        styles.pickerItemAvatar,
                        (item.id === null && selectedStudent === null) ||
                        item.id === selectedStudent
                          ? styles.pickerItemAvatarActive
                          : null,
                      ]}
                    >
                      <Ionicons
                        name={item.id === null ? 'people' : 'person'}
                        size={18}
                        color={
                          (item.id === null && selectedStudent === null) ||
                          item.id === selectedStudent
                            ? colors.piano.primary
                            : colors.neutral.textSecondary
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.pickerItemText,
                        (item.id === null && selectedStudent === null) ||
                        item.id === selectedStudent
                          ? styles.pickerItemTextActive
                          : null,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </View>
                  {((item.id === null && selectedStudent === null) ||
                    item.id === selectedStudent) && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.piano.primary}
                    />
                  )}
                </Pressable>
              )}
              style={styles.pickerList}
              contentContainerStyle={styles.pickerListContent}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Admin Student Picker Modal for Assigned Tab */}
      <Modal
        visible={showAdminStudentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdminStudentPicker(false)}
      >
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setShowAdminStudentPicker(false)}
        >
          <Pressable style={styles.pickerContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Filter by Student</Text>
              <Pressable
                style={styles.pickerCloseButton}
                onPress={() => setShowAdminStudentPicker(false)}
              >
                <Ionicons name="close" size={24} color={colors.neutral.text} />
              </Pressable>
            </View>

            <FlatList
              data={[{ id: null, name: 'All Students' }, ...(students || [])]}
              keyExtractor={(item) => item.id || 'all'}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.pickerItem,
                    (item.id === null && adminStudentFilter === null) ||
                    item.id === adminStudentFilter
                      ? styles.pickerItemActive
                      : null,
                  ]}
                  onPress={() => {
                    setAdminStudentFilter(item.id);
                    setShowAdminStudentPicker(false);
                  }}
                >
                  <View style={styles.pickerItemLeft}>
                    <View
                      style={[
                        styles.pickerItemAvatar,
                        (item.id === null && adminStudentFilter === null) ||
                        item.id === adminStudentFilter
                          ? styles.pickerItemAvatarActive
                          : null,
                      ]}
                    >
                      <Ionicons
                        name={item.id === null ? 'people' : 'person'}
                        size={18}
                        color={
                          (item.id === null && adminStudentFilter === null) ||
                          item.id === adminStudentFilter
                            ? colors.piano.primary
                            : colors.neutral.textSecondary
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.pickerItemText,
                        (item.id === null && adminStudentFilter === null) ||
                        item.id === adminStudentFilter
                          ? styles.pickerItemTextActive
                          : null,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </View>
                  {((item.id === null && adminStudentFilter === null) ||
                    item.id === adminStudentFilter) && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.piano.primary}
                    />
                  )}
                </Pressable>
              )}
              style={styles.pickerList}
              contentContainerStyle={styles.pickerListContent}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.piano.primary,
  },
  tabText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textMuted,
  },
  tabTextActive: {
    color: colors.piano.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  generateButton: {
    marginBottom: spacing.xl,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  generateButtonGradient: {
    backgroundColor: colors.piano.primary,
    padding: spacing.xl,
  },
  generateButtonContent: {
    alignItems: 'center',
  },
  generateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  generateButtonTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
    marginBottom: spacing.xs,
  },
  generateButtonSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.white,
    opacity: 0.9,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  templateCard: {
    width: '48%',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  templateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  templateIcon: {
    fontSize: 24,
  },
  templateLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    textAlign: 'center',
  },
  howItWorks: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  howItWorksTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  stepsList: {
    gap: spacing.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.piano.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.piano.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: typography.sizes.sm,
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
    marginBottom: spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.piano.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  emptyButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  // Loading state
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
  // Assignments list
  assignmentsList: {
    gap: spacing.sm,
  },
  assignmentCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  assignmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  assignmentEmoji: {
    fontSize: 24,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  assignmentStudent: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  assignmentDate: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusPending: {
    backgroundColor: colors.status.warningBg,
  },
  statusCompleted: {
    backgroundColor: colors.status.successBg,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  statusTextPending: {
    color: colors.status.warning,
  },
  statusTextCompleted: {
    color: colors.status.success,
  },
  // Parent view styles
  parentHeader: {
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  parentHeaderTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
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
  statusFilter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.background,
  },
  statusChipActive: {
    backgroundColor: colors.piano.subtle,
  },
  statusChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textMuted,
  },
  statusChipTextActive: {
    color: colors.piano.primary,
  },
  // Admin filters styles
  adminFiltersContainer: {
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    marginBottom: spacing.sm,
  },
  adminFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  adminFiltersTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  adminFiltersCount: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  adminFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  adminFilterLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    minWidth: 60,
  },
  adminFilterDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  adminFilterDropdownText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  adminFilterDropdownTextActive: {
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  adminFilterClearBtn: {
    padding: spacing.xs,
  },
  adminFilterChips: {
    marginBottom: spacing.xs,
  },
  adminFilterChipsContent: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  adminFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    gap: spacing.xs,
  },
  adminFilterChipActive: {
    backgroundColor: colors.piano.subtle,
    borderColor: colors.piano.primary,
  },
  adminFilterChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textMuted,
  },
  adminFilterChipTextActive: {
    color: colors.piano.primary,
  },
  adminFilterChipBadge: {
    backgroundColor: colors.neutral.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    minWidth: 20,
    alignItems: 'center',
  },
  adminFilterChipBadgeActive: {
    backgroundColor: colors.piano.primary,
  },
  adminFilterChipBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textMuted,
  },
  adminFilterChipBadgeTextActive: {
    color: colors.neutral.white,
  },
  clearAllFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  clearAllFiltersText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  // Share section styles
  sectionSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
  },
  shareActionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareActionCard: {
    flex: 1,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  shareActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  shareActionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  shareActionDescription: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
  // Tab badge styles
  tabBadge: {
    backgroundColor: colors.primary.main,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  // Library tab styles
  libraryHeader: {
    marginBottom: spacing.md,
  },
  libraryTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  librarySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  // Student filter dropdown styles
  studentFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  studentFilterLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  studentPickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    ...shadows.sm,
  },
  studentPickerText: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  studentPickerTextActive: {
    color: colors.piano.primary,
    fontWeight: typography.weights.semibold,
  },
  clearFilterButton: {
    padding: spacing.xs,
  },
  // Student picker modal styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    ...shadows.lg,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  pickerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  pickerCloseButton: {
    padding: spacing.xs,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerListContent: {
    paddingVertical: spacing.sm,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pickerItemActive: {
    backgroundColor: colors.piano.subtle,
  },
  pickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  pickerItemAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemAvatarActive: {
    backgroundColor: colors.piano.subtle,
    borderWidth: 1,
    borderColor: colors.piano.primary,
  },
  pickerItemText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    flex: 1,
  },
  pickerItemTextActive: {
    color: colors.piano.primary,
    fontWeight: typography.weights.semibold,
  },
  typeFilter: {
    marginBottom: spacing.md,
  },
  typeFilterContent: {
    paddingHorizontal: 0,
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral.white,
    gap: spacing.xs,
    ...shadows.sm,
  },
  typeChipActive: {
    backgroundColor: colors.piano.subtle,
    borderWidth: 1,
    borderColor: colors.piano.primary,
  },
  typeChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  typeChipTextActive: {
    color: colors.piano.primary,
  },
  typeChipCount: {
    backgroundColor: colors.neutral.background,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  typeChipCountActive: {
    backgroundColor: colors.piano.primary,
  },
  typeChipCountText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textMuted,
  },
  typeChipCountTextActive: {
    color: colors.neutral.white,
  },
  // Select mode styles
  selectModeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    paddingTop: spacing.md,
  },
  enterSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  enterSelectText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  selectAllText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  selectedCount: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  selectModeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bulkDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  bulkDeleteButtonDisabled: {
    opacity: 0.5,
  },
  bulkDeleteText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    fontWeight: typography.weights.medium,
  },
  cancelSelectButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  cancelSelectText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  // Assignment select mode styles
  assignmentSelectControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    marginTop: spacing.sm,
  },
  assignmentCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  assignmentCheckbox: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  assignmentCardSelectMode: {
    // Additional styles when in select mode (card already has flex: 1)
  },
  assignmentCardSelected: {
    backgroundColor: colors.piano.subtle,
    borderWidth: 1,
    borderColor: colors.piano.primary,
  },
  assignmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  assignmentActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.piano.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignmentActionBtnDelete: {
    backgroundColor: colors.status.errorBg,
  },
});
