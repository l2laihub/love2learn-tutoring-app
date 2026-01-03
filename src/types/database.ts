/**
 * Database types for Love2Learn tutoring app
 * Generated from Supabase schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// User role type - tutor has admin access, parent has limited access
export type UserRole = 'parent' | 'tutor';

export type Database = {
  public: {
    Tables: {
      parents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          phone: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email: string;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      students: {
        Row: {
          id: string;
          parent_id: string;
          name: string;
          age: number;
          grade_level: string;
          subjects: ('piano' | 'math')[];
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          name: string;
          age: number;
          grade_level: string;
          subjects?: ('piano' | 'math')[];
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          name?: string;
          age?: number;
          grade_level?: string;
          subjects?: ('piano' | 'math')[];
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'students_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'parents';
            referencedColumns: ['id'];
          }
        ];
      };
      subjects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon: string | null;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      lessons: {
        Row: {
          id: string;
          subject_id: string;
          title: string;
          description: string | null;
          content: Json;
          difficulty_level: number;
          estimated_duration_minutes: number;
          grade_level: string;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          title: string;
          description?: string | null;
          content: Json;
          difficulty_level?: number;
          estimated_duration_minutes?: number;
          grade_level: string;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          title?: string;
          description?: string | null;
          content?: Json;
          difficulty_level?: number;
          estimated_duration_minutes?: number;
          grade_level?: string;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lessons_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          }
        ];
      };
      student_progress: {
        Row: {
          id: string;
          student_id: string;
          lesson_id: string;
          status: 'not_started' | 'in_progress' | 'completed';
          score: number | null;
          time_spent_seconds: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          lesson_id: string;
          status?: 'not_started' | 'in_progress' | 'completed';
          score?: number | null;
          time_spent_seconds?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          lesson_id?: string;
          status?: 'not_started' | 'in_progress' | 'completed';
          score?: number | null;
          time_spent_seconds?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_progress_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_progress_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: false;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          }
        ];
      };
      achievements: {
        Row: {
          id: string;
          name: string;
          description: string;
          icon: string;
          points: number;
          criteria: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          icon: string;
          points?: number;
          criteria: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          icon?: string;
          points?: number;
          criteria?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      student_achievements: {
        Row: {
          id: string;
          student_id: string;
          achievement_id: string;
          earned_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          achievement_id: string;
          earned_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          achievement_id?: string;
          earned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_achievements_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_achievements_achievement_id_fkey';
            columns: ['achievement_id'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_sessions: {
        Row: {
          id: string;
          student_id: string;
          lesson_id: string | null;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          lesson_id?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          lesson_id?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_sessions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_sessions_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: false;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: 'user' | 'assistant' | 'system';
          content?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'chat_sessions';
            referencedColumns: ['id'];
          }
        ];
      };
      // Tutoring-specific tables
      scheduled_lessons: {
        Row: {
          id: string;
          student_id: string;
          subject: 'piano' | 'math';
          scheduled_at: string;
          duration_min: number;
          status: 'scheduled' | 'completed' | 'cancelled';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          subject: 'piano' | 'math';
          scheduled_at: string;
          duration_min: number;
          status?: 'scheduled' | 'completed' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          subject?: 'piano' | 'math';
          scheduled_at?: string;
          duration_min?: number;
          status?: 'scheduled' | 'completed' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scheduled_lessons_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          parent_id: string;
          month: string;
          amount_due: number;
          amount_paid: number;
          status: 'unpaid' | 'partial' | 'paid';
          paid_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          month: string;
          amount_due: number;
          amount_paid?: number;
          status?: 'unpaid' | 'partial' | 'paid';
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          month?: string;
          amount_due?: number;
          amount_paid?: number;
          status?: 'unpaid' | 'partial' | 'paid';
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'parents';
            referencedColumns: ['id'];
          }
        ];
      };
      assignments: {
        Row: {
          id: string;
          student_id: string;
          worksheet_type: 'piano_naming' | 'piano_drawing' | 'math';
          config: Json;
          pdf_url: string | null;
          assigned_at: string;
          due_date: string | null;
          status: 'assigned' | 'completed';
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          worksheet_type: 'piano_naming' | 'piano_drawing' | 'math';
          config: Json;
          pdf_url?: string | null;
          assigned_at?: string;
          due_date?: string | null;
          status?: 'assigned' | 'completed';
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          worksheet_type?: 'piano_naming' | 'piano_drawing' | 'math';
          config?: Json;
          pdf_url?: string | null;
          assigned_at?: string;
          due_date?: string | null;
          status?: 'assigned' | 'completed';
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      progress_status: 'not_started' | 'in_progress' | 'completed';
      message_role: 'user' | 'assistant' | 'system';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Convenience type aliases
export type Parent = Tables<'parents'>;
export type Student = Tables<'students'>;
export type Subject = Tables<'subjects'>;
export type Lesson = Tables<'lessons'>;
export type StudentProgress = Tables<'student_progress'>;
export type Achievement = Tables<'achievements'>;
export type StudentAchievement = Tables<'student_achievements'>;
export type ChatSession = Tables<'chat_sessions'>;
export type ChatMessage = Tables<'chat_messages'>;

// Insert types
export type InsertParent = InsertTables<'parents'>;
export type InsertStudent = InsertTables<'students'>;
export type InsertStudentProgress = InsertTables<'student_progress'>;
export type InsertChatSession = InsertTables<'chat_sessions'>;
export type InsertChatMessage = InsertTables<'chat_messages'>;

// ============================================================================
// Tutoring-specific types (for scheduled lessons, payments, assignments)
// These extend the base schema for the tutoring business features
// ============================================================================

// Tutoring lesson status
export type TutoringLessonStatus = 'scheduled' | 'completed' | 'cancelled';

// Payment status
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

// Assignment status
export type AssignmentStatus = 'assigned' | 'completed';

// Worksheet types
export type WorksheetType = 'piano_naming' | 'piano_drawing' | 'math';

// Lesson duration options (in minutes)
export type LessonDuration = 30 | 45 | 60;

// Piano levels
export type PianoLevel = 'beginner' | 'intermediate' | 'advanced';

// Subject type for tutoring (piano or math)
export type TutoringSubject = 'piano' | 'math';

// Grade levels (K=0, 1-6)
export type GradeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Piano worksheet configuration
export interface PianoWorksheetConfig {
  type: 'note_naming' | 'note_drawing';
  clef: 'treble' | 'bass' | 'grand';
  difficulty: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
  problemCount: 10 | 15 | 20;
  accidentals: 'none' | 'sharps' | 'flats' | 'mixed';
  theme?: 'space' | 'animals' | 'ocean';
}

// Math worksheet configuration
export interface MathWorksheetConfig {
  grade: GradeLevel;
  topic: string;
  problemCount: 10 | 15 | 20 | 25;
  includeWordProblems: boolean;
  includeVisualAids: boolean;
}

export type WorksheetConfig = PianoWorksheetConfig | MathWorksheetConfig;

// Scheduled tutoring lesson (distinct from content lessons)
export interface ScheduledLesson {
  id: string;
  student_id: string;
  subject: TutoringSubject;
  scheduled_at: string;
  duration_min: number; // Typically 30, 45, or 60
  status: TutoringLessonStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Payment record
export interface Payment {
  id: string;
  parent_id: string;
  month: string; // First of month as ISO string
  amount_due: number;
  amount_paid: number;
  status: PaymentStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Worksheet assignment
export interface Assignment {
  id: string;
  student_id: string;
  worksheet_type: WorksheetType;
  config: Json; // Stored as JSON in DB, cast to WorksheetConfig when needed
  pdf_url: string | null;
  assigned_at: string;
  due_date: string | null;
  status: AssignmentStatus;
  completed_at: string | null;
  created_at: string;
}

// Extended types with relations
export interface StudentWithParent extends Student {
  parent: Parent;
}

export interface ParentWithStudents extends Parent {
  students: Student[];
  student_count?: number;
}

export interface ScheduledLessonWithStudent extends ScheduledLesson {
  student: StudentWithParent;
}

export interface AssignmentWithStudent extends Assignment {
  student: Student;
}

export interface PaymentWithParent extends Payment {
  parent: ParentWithStudents;
}

// Input types for creating/updating entities
export interface CreateStudentInput {
  parent_id: string;
  name: string;
  age: number;
  grade_level: string;
  avatar_url?: string | null;
}

export interface UpdateStudentInput {
  parent_id?: string;
  name?: string;
  age?: number;
  grade_level?: string;
  avatar_url?: string | null;
}

export interface CreateParentInput {
  user_id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface UpdateParentInput {
  name?: string;
  email?: string;
  phone?: string | null;
}

export interface CreateScheduledLessonInput {
  student_id: string;
  subject: TutoringSubject;
  scheduled_at: string;
  duration_min: LessonDuration;
  notes?: string | null;
}

export interface UpdateScheduledLessonInput {
  student_id?: string;
  subject?: TutoringSubject;
  scheduled_at?: string;
  duration_min?: number;
  status?: TutoringLessonStatus;
  notes?: string | null;
  updated_at?: string;
}

export interface CreatePaymentInput {
  parent_id: string;
  month: string;
  amount_due: number;
  amount_paid?: number;
  status?: PaymentStatus;
  notes?: string | null;
}

export interface UpdatePaymentInput {
  amount_due?: number;
  amount_paid?: number;
  status?: PaymentStatus;
  paid_at?: string | null;
  notes?: string | null;
}

export interface CreateAssignmentInput {
  student_id: string;
  worksheet_type: WorksheetType;
  config: Json; // WorksheetConfig stored as JSON
  pdf_url?: string | null;
  due_date?: string | null;
}

export interface UpdateAssignmentInput {
  pdf_url?: string | null;
  due_date?: string | null;
  status?: AssignmentStatus;
  completed_at?: string | null;
}

// Hook state types
export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface ListQueryState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface MutationState<T, TInput = unknown> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  mutate: (input: TInput) => Promise<T | null>;
  reset: () => void;
}
