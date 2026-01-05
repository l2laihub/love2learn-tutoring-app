/**
 * Love2Learn Tutoring App - React Hooks
 *
 * Centralized exports for all data fetching hooks
 */

// Student hooks
export {
  useStudents,
  useStudent,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  useStudentsByParent,
} from './useStudents';

// Parent hooks
export {
  useParents,
  useParent,
  useCreateParent,
  useUpdateParent,
  useDeleteParent,
  useParentByUserId,
  useSearchParents,
} from './useParents';

// Lesson hooks
export {
  useLessons,
  useTodaysLessons,
  useUpcomingLessons,
  useLesson,
  useCreateLesson,
  useUpdateLesson,
  useCancelLesson,
  useCompleteLesson,
  useWeekLessons,
} from './useLessons';
export type { LessonsFilterOptions } from './useLessons';

// Payment hooks
export {
  usePayments,
  useAllPayments,
  usePayment,
  usePaymentsByParent,
  useCreatePayment,
  useUpdatePayment,
  useMarkPaymentPaid,
  useOverduePayments,
  usePaymentSummary,
} from './usePayments';

// Assignment hooks
export {
  useAssignments,
  usePendingAssignments,
  useCompletedAssignments,
  useAssignmentsDueSoon,
  useAssignment,
  useCreateAssignment,
  useUpdateAssignment,
  useCompleteAssignment,
  useDeleteAssignment,
  useAssignmentStats,
  useOverdueAssignments,
} from './useAssignments';
export type { AssignmentsFilterOptions } from './useAssignments';

// Parent Agreement hooks
export {
  useParentAgreement,
  useAgreementCheck,
} from './useParentAgreement';
export type { Agreement, SignAgreementParams, CreateAgreementParams } from './useParentAgreement';

// Responsive hooks
export {
  useResponsive,
  breakpoints,
  getGridItemWidth,
  getResponsiveValue,
} from './useResponsive';
export type { ResponsiveInfo, Breakpoint } from './useResponsive';

// Tutor Availability hooks
export {
  useTutorAvailability,
  useAvailabilitySlot,
  useCreateAvailability,
  useUpdateAvailability,
  useDeleteAvailability,
  useWeeklyAvailability,
  useCheckAvailability,
  useAvailableSlotsForDate,
  DAY_NAMES,
  formatTimeDisplay,
} from './useTutorAvailability';
export type {
  UpdateTutorAvailabilityInput,
  AvailabilityFilterOptions,
} from './useTutorAvailability';
