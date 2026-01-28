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

// Parent notification preferences
export interface ParentNotificationPreferences {
  lesson_reminders: boolean;
  lesson_reminders_hours_before?: number;
  worksheet_assigned: boolean;
  payment_due: boolean;
  lesson_notes: boolean;
}

// Parent preferences stored as JSONB
export interface ParentPreferences {
  notifications: ParentNotificationPreferences;
  contact_preference: 'email' | 'phone' | 'text';
}

export type Database = {
  public: {
    Tables: {
      parents: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          email: string;
          phone: string | null;
          role: UserRole;
          avatar_url: string | null;
          onboarding_completed_at: string | null;
          preferences: ParentPreferences | null;
          invitation_token: string | null;
          invitation_sent_at: string | null;
          invitation_expires_at: string | null;
          invitation_accepted_at: string | null;
          requires_agreement: boolean | null;
          agreement_signed_at: string | null;
          billing_mode: 'invoice' | 'prepaid';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          email: string;
          phone?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          onboarding_completed_at?: string | null;
          preferences?: ParentPreferences | null;
          invitation_token?: string | null;
          invitation_sent_at?: string | null;
          invitation_expires_at?: string | null;
          invitation_accepted_at?: string | null;
          requires_agreement?: boolean | null;
          agreement_signed_at?: string | null;
          billing_mode?: 'invoice' | 'prepaid';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          email?: string;
          phone?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          onboarding_completed_at?: string | null;
          preferences?: ParentPreferences | null;
          invitation_token?: string | null;
          invitation_sent_at?: string | null;
          invitation_expires_at?: string | null;
          invitation_accepted_at?: string | null;
          requires_agreement?: boolean | null;
          agreement_signed_at?: string | null;
          billing_mode?: 'invoice' | 'prepaid';
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
      parent_agreements: {
        Row: {
          id: string;
          parent_id: string;
          agreement_version: string;
          agreement_type: string;
          agreement_content: string;
          signature_data: string | null;
          signature_timestamp: string | null;
          signed_by_name: string | null;
          signed_by_email: string | null;
          ip_address: string | null;
          user_agent: string | null;
          device_info: Json | null;
          status: 'pending' | 'signed' | 'expired' | 'revoked';
          created_at: string;
          updated_at: string;
          expires_at: string | null;
          pdf_storage_path: string | null;
          pdf_generated_at: string | null;
        };
        Insert: {
          id?: string;
          parent_id: string;
          agreement_version?: string;
          agreement_type?: string;
          agreement_content: string;
          signature_data?: string | null;
          signature_timestamp?: string | null;
          signed_by_name?: string | null;
          signed_by_email?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          device_info?: Json | null;
          status?: 'pending' | 'signed' | 'expired' | 'revoked';
          created_at?: string;
          updated_at?: string;
          expires_at?: string | null;
          pdf_storage_path?: string | null;
          pdf_generated_at?: string | null;
        };
        Update: {
          id?: string;
          parent_id?: string;
          agreement_version?: string;
          agreement_type?: string;
          agreement_content?: string;
          signature_data?: string | null;
          signature_timestamp?: string | null;
          signed_by_name?: string | null;
          signed_by_email?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          device_info?: Json | null;
          status?: 'pending' | 'signed' | 'expired' | 'revoked';
          created_at?: string;
          updated_at?: string;
          expires_at?: string | null;
          pdf_storage_path?: string | null;
          pdf_generated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'parent_agreements_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'parents';
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
          subjects: string[];
          avatar_url: string | null;
          hourly_rate: number;
          subject_rates: Json;
          birthday: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          name: string;
          age: number;
          grade_level: string;
          subjects?: string[];
          avatar_url?: string | null;
          hourly_rate?: number;
          subject_rates?: Json;
          birthday?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          name?: string;
          age?: number;
          grade_level?: string;
          subjects?: string[];
          avatar_url?: string | null;
          hourly_rate?: number;
          subject_rates?: Json;
          birthday?: string | null;
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
      lesson_sessions: {
        Row: {
          id: string;
          scheduled_at: string;
          duration_min: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scheduled_at: string;
          duration_min: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          scheduled_at?: string;
          duration_min?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scheduled_lessons: {
        Row: {
          id: string;
          student_id: string;
          subject: 'piano' | 'math' | 'reading' | 'speech' | 'english';
          scheduled_at: string;
          duration_min: number;
          status: 'scheduled' | 'completed' | 'cancelled';
          notes: string | null;
          session_id: string | null;
          override_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          subject: 'piano' | 'math' | 'reading' | 'speech' | 'english';
          scheduled_at: string;
          duration_min: number;
          status?: 'scheduled' | 'completed' | 'cancelled';
          notes?: string | null;
          session_id?: string | null;
          override_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          subject?: 'piano' | 'math' | 'reading' | 'speech' | 'english';
          scheduled_at?: string;
          duration_min?: number;
          status?: 'scheduled' | 'completed' | 'cancelled';
          notes?: string | null;
          session_id?: string | null;
          override_amount?: number | null;
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
          },
          {
            foreignKeyName: 'scheduled_lessons_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'lesson_sessions';
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
          payment_type: 'invoice' | 'prepaid';
          sessions_prepaid: number;
          sessions_used: number;
          sessions_rolled_over: number;
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
          payment_type?: 'invoice' | 'prepaid';
          sessions_prepaid?: number;
          sessions_used?: number;
          sessions_rolled_over?: number;
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
          payment_type?: 'invoice' | 'prepaid';
          sessions_prepaid?: number;
          sessions_used?: number;
          sessions_rolled_over?: number;
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
      payment_lessons: {
        Row: {
          id: string;
          payment_id: string;
          lesson_id: string;
          amount: number;
          paid: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          lesson_id: string;
          amount: number;
          paid?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          lesson_id?: string;
          amount?: number;
          paid?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_lessons_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_lessons_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: false;
            referencedRelation: 'scheduled_lessons';
            referencedColumns: ['id'];
          }
        ];
      };
      tutor_settings: {
        Row: {
          id: string;
          tutor_id: string;
          default_rate: number;
          default_base_duration: number;
          subject_rates: Json;
          combined_session_rate: number;
          reminder_settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          default_rate?: number;
          default_base_duration?: number;
          subject_rates?: Json;
          combined_session_rate?: number;
          reminder_settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tutor_id?: string;
          default_rate?: number;
          default_base_duration?: number;
          subject_rates?: Json;
          combined_session_rate?: number;
          reminder_settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tutor_settings_tutor_id_fkey';
            columns: ['tutor_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      payment_reminders: {
        Row: {
          id: string;
          payment_id: string;
          parent_id: string;
          reminder_type: 'friendly' | 'due_date' | 'past_due_3' | 'past_due_7' | 'past_due_14' | 'manual';
          email_sent: boolean;
          email_id: string | null;
          notification_id: string | null;
          message: string | null;
          sent_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          parent_id: string;
          reminder_type: 'friendly' | 'due_date' | 'past_due_3' | 'past_due_7' | 'past_due_14' | 'manual';
          email_sent?: boolean;
          email_id?: string | null;
          notification_id?: string | null;
          message?: string | null;
          sent_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          parent_id?: string;
          reminder_type?: 'friendly' | 'due_date' | 'past_due_3' | 'past_due_7' | 'past_due_14' | 'manual';
          email_sent?: boolean;
          email_id?: string | null;
          notification_id?: string | null;
          message?: string | null;
          sent_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_reminders_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_reminders_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'parents';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      // Parent Invitation Functions
      generate_parent_invitation: {
        Args: { parent_id: string };
        Returns: string;
      };
      validate_invitation_token: {
        Args: { token: string };
        Returns: {
          parent_id: string;
          email: string;
          name: string;
          is_valid: boolean;
          error_message: string | null;
        }[];
      };
      accept_parent_invitation: {
        Args: { token: string; auth_user_id: string };
        Returns: boolean;
      };
      // Parent Agreement Functions
      create_parent_agreement: {
        Args: {
          p_parent_id: string;
          p_agreement_content: string;
          p_agreement_version?: string;
          p_agreement_type?: string;
          p_expires_in_days?: number;
        };
        Returns: string;
      };
      sign_parent_agreement: {
        Args: {
          p_agreement_id: string;
          p_signature_data: string;
          p_signed_by_name: string;
          p_signed_by_email: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
          p_device_info?: Record<string, unknown> | null;
        };
        Returns: boolean;
      };
      has_valid_agreement: {
        Args: {
          p_parent_id: string;
          p_agreement_type?: string;
        };
        Returns: boolean;
      };
      get_parent_agreement: {
        Args: {
          p_parent_id: string;
          p_agreement_type?: string;
        };
        Returns: {
          agreement_id: string;
          agreement_version: string;
          status: string;
          signed_at: string | null;
          signed_by_name: string | null;
          expires_at: string | null;
        }[];
      };
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

// Payment type (invoice vs prepaid)
export type PaymentType = 'invoice' | 'prepaid';

// Billing mode for parents
export type BillingMode = 'invoice' | 'prepaid';

// Assignment status
export type AssignmentStatus = 'assigned' | 'completed';

// Worksheet types
export type WorksheetType = 'piano_naming' | 'piano_drawing' | 'math';

// Resource types for shared resources
export type ResourceType = 'worksheet' | 'pdf' | 'image' | 'video';

// Lesson duration in minutes (supports custom durations from 15-240 minutes)
export type LessonDuration = number;

// Lesson request status
export type LessonRequestStatus = 'pending' | 'approved' | 'rejected' | 'scheduled';

// Lesson request type
export type LessonRequestType = 'reschedule' | 'dropin';

// Tutor availability slot
export interface TutorAvailability {
  id: string;
  tutor_id: string;
  day_of_week: number | null; // 0=Sunday, 6=Saturday
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  specific_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Tutor break slot (within availability windows)
export interface TutorBreak {
  id: string;
  tutor_id: string;
  day_of_week: number | null; // 0=Sunday, 6=Saturday
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  specific_date: string | null;
  notes: string | null; // Free-form notes (e.g., "lunch", "personal")
  created_at: string;
  updated_at: string;
}

// Lesson request from parent
export interface LessonRequest {
  id: string;
  parent_id: string;
  student_id: string;
  subject: string;
  preferred_date: string;
  preferred_time: string | null;
  preferred_duration: number;
  notes: string | null;
  status: LessonRequestStatus;
  request_type: LessonRequestType; // 'reschedule' for changing existing lesson, 'dropin' for new session
  tutor_response: string | null;
  scheduled_lesson_id: string | null;
  request_group_id: string | null; // Groups multiple requests for combined session reschedules
  original_lesson_id: string | null; // References the original lesson being rescheduled
  created_at: string;
  updated_at: string;
}

// Lesson request with student info
export interface LessonRequestWithStudent extends LessonRequest {
  student: Student;
  original_lesson?: {
    id: string;
    scheduled_at: string;
  } | null;
}

// Input types for tutor availability
export interface CreateTutorAvailabilityInput {
  tutor_id: string;
  day_of_week?: number | null;
  start_time: string;
  end_time: string;
  is_recurring?: boolean;
  specific_date?: string | null;
  notes?: string | null;
}

export interface UpdateTutorAvailabilityInput {
  day_of_week?: number | null;
  start_time?: string;
  end_time?: string;
  is_recurring?: boolean;
  specific_date?: string | null;
  notes?: string | null;
}

// Input types for tutor breaks
export interface CreateTutorBreakInput {
  tutor_id: string;
  day_of_week?: number | null;
  start_time: string;
  end_time: string;
  is_recurring?: boolean;
  specific_date?: string | null;
  notes?: string | null;
}

export interface UpdateTutorBreakInput {
  day_of_week?: number | null;
  start_time?: string;
  end_time?: string;
  is_recurring?: boolean;
  specific_date?: string | null;
  notes?: string | null;
}

// Input types for lesson requests
export interface CreateLessonRequestInput {
  parent_id: string;
  student_id: string;
  subject: string;
  preferred_date: string;
  preferred_time?: string | null;
  preferred_duration?: number;
  notes?: string | null;
  request_group_id?: string | null; // For linking combined session requests
  request_type?: LessonRequestType; // Defaults to 'reschedule' if not specified
  original_lesson_id?: string | null; // Original lesson being rescheduled (will be deleted on approval)
}

export interface UpdateLessonRequestInput {
  status?: LessonRequestStatus;
  tutor_response?: string | null;
  scheduled_lesson_id?: string | null;
}

// Piano levels
export type PianoLevel = 'beginner' | 'intermediate' | 'advanced';

// Subject type for tutoring (all supported subjects)
export type TutoringSubject = 'piano' | 'math' | 'reading' | 'speech' | 'english';

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

// Lesson session - groups related lessons together (e.g., siblings taking combined classes)
export interface LessonSession {
  id: string;
  scheduled_at: string;
  duration_min: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Scheduled tutoring lesson (distinct from content lessons)
export interface ScheduledLesson {
  id: string;
  student_id: string;
  subject: TutoringSubject;
  scheduled_at: string;
  duration_min: number; // Typically 30, 45, or 60
  status: TutoringLessonStatus;
  notes: string | null;
  session_id: string | null; // Links to lesson_sessions for grouped lessons
  override_amount: number | null; // Manual price override for edge cases
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
  // Prepaid fields
  payment_type: PaymentType;
  sessions_prepaid: number; // Total sessions covered (includes rollover)
  sessions_used: number; // Sessions consumed from prepayment
  sessions_rolled_over: number; // Sessions rolled over from previous month
  created_at: string;
  updated_at: string;
}

// Prepaid status summary for display
export interface PrepaidStatus {
  sessionsTotal: number; // sessions_prepaid
  sessionsUsed: number; // sessions_used
  sessionsRemaining: number; // sessions_prepaid - sessions_used
  sessionsRolledOver: number; // sessions_rolled_over
  usagePercentage: number; // (sessions_used / sessions_prepaid) * 100
  isPaid: boolean; // status === 'paid'
}

// ============================================================================
// Payment Reminder Types
// For tracking and sending payment reminder emails to parents
// ============================================================================

// Payment reminder type enum
export type PaymentReminderType =
  | 'friendly'      // Friendly reminder (e.g., 3 days before due)
  | 'due_date'      // On due date reminder
  | 'past_due_3'    // 3 days past due
  | 'past_due_7'    // 7 days past due
  | 'past_due_14'   // 14 days past due
  | 'manual';       // Manual reminder sent by tutor

// Payment reminder record
export interface PaymentReminder {
  id: string;
  payment_id: string;
  parent_id: string;
  reminder_type: PaymentReminderType;
  email_sent: boolean;
  email_id: string | null;
  notification_id: string | null;
  message: string | null;
  sent_at: string;
  created_at: string;
}

// Payment reminder with parent info
export interface PaymentReminderWithParent extends PaymentReminder {
  parent: Parent;
}

// Reminder settings for automation (stored in tutor_settings.reminder_settings)
export interface ReminderSettings {
  enabled: boolean;
  due_day_of_month: number;         // Day of month when payment is due (e.g., 7)
  friendly_reminder_days_before: number; // Days before due date for friendly reminder
  past_due_intervals: number[];     // Days after due date for past-due reminders (e.g., [3, 7, 14])
  send_email: boolean;              // Whether to send email reminders
  send_notification: boolean;       // Whether to send in-app notifications
}

// Input for sending a payment reminder
export interface SendPaymentReminderInput {
  payment_id: string;
  reminder_type: PaymentReminderType;
  custom_message?: string;
  lesson_ids?: string[]; // Optional: specific payment_lesson IDs to include in the reminder
}

// Response from sending a payment reminder
export interface SendPaymentReminderResponse {
  success: boolean;
  message: string;
  emailId?: string;
  emailSent?: boolean;
  notificationId?: string;
  reminderId?: string;
  duplicate?: boolean;
}

// Reminder history summary for display
export interface ReminderHistorySummary {
  totalReminders: number;
  lastReminderSent: string | null;
  lastReminderType: PaymentReminderType | null;
  remindersByType: Record<PaymentReminderType, number>;
}

// Helper function to get reminder type display info
export function getReminderTypeInfo(type: PaymentReminderType): {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  icon: string;
} {
  switch (type) {
    case 'friendly':
      return {
        label: 'Friendly Reminder',
        description: 'Sent before due date',
        color: '#7CB342',
        bgColor: '#F1F8E9',
        icon: 'happy-outline',
      };
    case 'due_date':
      return {
        label: 'Due Date',
        description: 'Sent on due date',
        color: '#FF9800',
        bgColor: '#FFF3E0',
        icon: 'calendar-outline',
      };
    case 'past_due_3':
      return {
        label: '3 Days Overdue',
        description: 'Sent 3 days after due',
        color: '#F57C00',
        bgColor: '#FFF3E0',
        icon: 'alert-outline',
      };
    case 'past_due_7':
      return {
        label: '7 Days Overdue',
        description: 'Sent 7 days after due',
        color: '#E53935',
        bgColor: '#FFEBEE',
        icon: 'warning-outline',
      };
    case 'past_due_14':
      return {
        label: '14 Days Overdue',
        description: 'Sent 14 days after due',
        color: '#C62828',
        bgColor: '#FFEBEE',
        icon: 'alert-circle-outline',
      };
    case 'manual':
      return {
        label: 'Manual Reminder',
        description: 'Sent by tutor',
        color: '#3D9CA8',
        bgColor: '#E0F7FA',
        icon: 'mail-outline',
      };
    default:
      return {
        label: 'Reminder',
        description: 'Payment reminder',
        color: '#9E9E9E',
        bgColor: '#F5F5F5',
        icon: 'mail-outline',
      };
  }
}

// Tutor settings for rate configuration
export interface TutorSettings {
  id: string;
  tutor_id: string;
  default_rate: number;           // Default rate amount
  default_base_duration: number;  // Default base duration in minutes (e.g., 60)
  subject_rates: SubjectRates;    // Per-subject rate overrides
  combined_session_rate: number;  // Flat rate per student for combined sessions
  reminder_settings: ReminderSettings; // Payment reminder automation settings
  created_at: string;
  updated_at: string;
}

// Input types for tutor settings
export interface UpdateTutorSettingsInput {
  default_rate?: number;
  default_base_duration?: number;
  subject_rates?: SubjectRates;
  combined_session_rate?: number;
}

// Worksheet assignment
export interface Assignment {
  id: string;
  student_id: string;
  worksheet_type: WorksheetType;
  config: Json; // Stored as JSON in DB, cast to WorksheetConfig when needed
  pdf_url: string | null;
  storage_path: string | null; // Cloud storage path
  assigned_at: string;
  due_date: string | null;
  status: AssignmentStatus;
  completed_at: string | null;
  created_at: string;
}

// Shared resource (worksheets, PDFs, images, videos shared with parents)
export interface SharedResource {
  id: string;
  student_id: string;
  parent_id: string;
  tutor_id: string;
  resource_type: ResourceType;
  title: string;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  assignment_id: string | null;
  lesson_id: string | null;
  created_at: string;
  viewed_at: string | null;
  is_visible_to_parent: boolean;
}

// Shared resource with related entities
export interface SharedResourceWithStudent extends SharedResource {
  student: Student;
}

export interface SharedResourceWithDetails extends SharedResource {
  student: Student;
  parent: Parent;
  assignment?: Assignment | null;
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

// Lesson session with all its lessons
export interface LessonSessionWithLessons extends LessonSession {
  lessons: ScheduledLessonWithStudent[];
}

// Grouped lesson for calendar display - represents either a single lesson or a session
export interface GroupedLesson {
  // If session_id is set, this represents a grouped session
  session_id: string | null;
  // All lessons in this group (1 for standalone, multiple for sessions)
  lessons: ScheduledLessonWithStudent[];
  // Display properties
  scheduled_at: string; // Session start time
  end_time: string; // Computed end time
  duration_min: number; // Total duration
  // Derived display strings
  student_names: string[]; // e.g., ['Lauren Vu', 'Lian Vu']
  subjects: TutoringSubject[]; // e.g., ['piano', 'reading']
  status: TutoringLessonStatus; // Derived from individual lessons
}

export interface AssignmentWithStudent extends Assignment {
  student: Student;
}

export interface PaymentWithParent extends Payment {
  parent: ParentWithStudents;
}

// Payment lesson - links a payment to a specific lesson with calculated amount
export interface PaymentLesson {
  id: string;
  payment_id: string;
  lesson_id: string;
  amount: number;
  paid: boolean;
  created_at: string;
}

// Payment lesson with the full lesson details
export interface PaymentLessonWithDetails extends PaymentLesson {
  lesson: ScheduledLessonWithStudent;
}

// Payment with parent and linked lessons
export interface PaymentWithDetails extends PaymentWithParent {
  payment_lessons?: PaymentLessonWithDetails[];
}

// Duration-based pricing tiers (explicit prices per duration)
export interface DurationPrices {
  15?: number;
  30?: number;
  45?: number;
  60?: number;
  90?: number;
  120?: number;
}

// Subject rate with base duration (e.g., $35 for 30 minutes)
// Now supports optional duration_prices for explicit tier pricing
export interface SubjectRateConfig {
  rate: number;                    // Amount in dollars (used for linear calc fallback)
  base_duration: number;           // Base duration in minutes (e.g., 30 or 60)
  duration_prices?: DurationPrices; // Optional explicit prices per duration tier
}

// Subject rates type - each subject can have a rate with base duration
export interface SubjectRates {
  piano?: SubjectRateConfig;
  math?: SubjectRateConfig;
  reading?: SubjectRateConfig;
  speech?: SubjectRateConfig;
  english?: SubjectRateConfig;
}

// Helper to get price for a specific duration from SubjectRateConfig
export function getDurationPrice(
  config: SubjectRateConfig,
  durationMin: number
): { price: number; isExplicit: boolean } {
  // Check for explicit duration price first
  // JSON from database has string keys, so we must use string key for lookup
  const durationPricesRaw = config.duration_prices;
  if (durationPricesRaw && typeof durationPricesRaw === 'object') {
    const durationKey = String(durationMin);
    const explicitPrice = (durationPricesRaw as Record<string, number>)[durationKey];
    if (typeof explicitPrice === 'number' && explicitPrice > 0) {
      return { price: explicitPrice, isExplicit: true };
    }
  }
  // Fall back to linear calculation
  const linearPrice = (durationMin / config.base_duration) * config.rate;
  return { price: linearPrice, isExplicit: false };
}

// Input types for creating/updating entities
export interface CreateStudentInput {
  parent_id: string;
  name: string;
  age: number;
  grade_level: string;
  subjects?: string[];
  avatar_url?: string | null;
  hourly_rate?: number;
  subject_rates?: SubjectRates;
}

export interface UpdateStudentInput {
  parent_id?: string;
  name?: string;
  age?: number;
  grade_level?: string;
  subjects?: string[];
  avatar_url?: string | null;
  hourly_rate?: number;
  subject_rates?: SubjectRates;
}

export interface CreateParentInput {
  user_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
}

export interface UpdateParentInput {
  name?: string;
  email?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

export interface CreateLessonSessionInput {
  scheduled_at: string;
  duration_min: number;
  notes?: string | null;
}

export interface CreateScheduledLessonInput {
  student_id: string;
  subject: TutoringSubject;
  scheduled_at: string;
  duration_min: LessonDuration;
  notes?: string | null;
  session_id?: string | null;
}

export interface UpdateScheduledLessonInput {
  student_id?: string;
  subject?: TutoringSubject;
  scheduled_at?: string;
  duration_min?: number;
  status?: TutoringLessonStatus;
  notes?: string | null;
  override_amount?: number | null;
  updated_at?: string;
}

export interface CreatePaymentInput {
  parent_id: string;
  month: string;
  amount_due: number;
  amount_paid?: number;
  status?: PaymentStatus;
  notes?: string | null;
  // Prepaid fields
  payment_type?: PaymentType;
  sessions_prepaid?: number;
  sessions_used?: number;
  sessions_rolled_over?: number;
}

export interface UpdatePaymentInput {
  amount_due?: number;
  amount_paid?: number;
  status?: PaymentStatus;
  paid_at?: string | null;
  notes?: string | null;
  // Prepaid fields
  payment_type?: PaymentType;
  sessions_prepaid?: number;
  sessions_used?: number;
  sessions_rolled_over?: number;
}

// Input for creating a prepaid payment
export interface CreatePrepaidPaymentInput {
  parent_id: string;
  month: string;
  sessions_count: number; // Number of sessions for this month
  amount: number; // Amount charged for the prepaid sessions
  sessions_rolled_over?: number; // Sessions rolled over from previous month
  notes?: string | null;
}

// Input for updating parent billing mode
export interface UpdateParentBillingModeInput {
  billing_mode: BillingMode;
}

export interface CreateAssignmentInput {
  student_id: string;
  worksheet_type: WorksheetType;
  config: Json; // WorksheetConfig stored as JSON
  pdf_url?: string | null;
  storage_path?: string | null;
  due_date?: string | null;
}

export interface UpdateAssignmentInput {
  pdf_url?: string | null;
  storage_path?: string | null;
  due_date?: string | null;
  status?: AssignmentStatus;
  completed_at?: string | null;
}

// Shared resource input types
export interface CreateSharedResourceInput {
  student_id: string;
  parent_id: string;
  tutor_id: string;
  resource_type: ResourceType;
  title: string;
  description?: string | null;
  storage_path?: string | null;
  external_url?: string | null;
  thumbnail_url?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  assignment_id?: string | null;
  lesson_id?: string | null;
}

export interface UpdateSharedResourceInput {
  title?: string;
  description?: string | null;
  thumbnail_url?: string | null;
  is_visible_to_parent?: boolean;
  viewed_at?: string | null;
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

// ============================================================================
// Group Session Enrollment Types
// For parents to sign up for existing scheduled group sessions
// ============================================================================

// Enrollment status enum
export type EnrollmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// Group session settings - configuration for sessions open for enrollment
export interface GroupSessionSettings {
  id: string;
  session_id: string;
  is_open_for_enrollment: boolean;
  max_students: number;
  enrollment_deadline_hours: number;
  allowed_subjects: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Session enrollment - request from parent to join a group session
export interface SessionEnrollment {
  id: string;
  session_id: string;
  student_id: string;
  parent_id: string;
  subject: string;
  duration_min: number;
  status: EnrollmentStatus;
  notes: string | null;
  tutor_response: string | null;
  scheduled_lesson_id: string | null;
  created_at: string;
  updated_at: string;
}

// Enrollment with student info (for display)
export interface SessionEnrollmentWithStudent extends SessionEnrollment {
  student: Student;
}

// Enrollment with full details (for tutor view)
export interface SessionEnrollmentWithDetails extends SessionEnrollment {
  student: Student;
  parent: Parent;
  session?: LessonSession;
}

// Available group session for parents to browse
export interface AvailableGroupSession {
  session_id: string;
  session: LessonSession;
  settings: GroupSessionSettings;
  current_students: number; // Students already in the session
  pending_enrollments: number; // Pending enrollment requests
  available_slots: number; // max_students - current_students - pending_enrollments
  lessons: ScheduledLessonWithStudent[]; // Existing lessons in the session
  enrollment_deadline: string; // Computed datetime when enrollment closes
  is_enrollment_open: boolean; // Whether enrollment is still open
}

// Input types for creating/updating

export interface CreateGroupSessionSettingsInput {
  session_id: string;
  is_open_for_enrollment?: boolean;
  max_students?: number;
  enrollment_deadline_hours?: number;
  allowed_subjects?: string[] | null;
  notes?: string | null;
}

export interface UpdateGroupSessionSettingsInput {
  is_open_for_enrollment?: boolean;
  max_students?: number;
  enrollment_deadline_hours?: number;
  allowed_subjects?: string[] | null;
  notes?: string | null;
}

export interface CreateSessionEnrollmentInput {
  session_id: string;
  student_id: string;
  parent_id: string;
  subject: string;
  duration_min: number;
  notes?: string | null;
}

export interface UpdateSessionEnrollmentInput {
  status?: EnrollmentStatus;
  tutor_response?: string | null;
  scheduled_lesson_id?: string | null;
}

// Helper function to get enrollment status display info
export function getEnrollmentStatusInfo(status: EnrollmentStatus): {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
} {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        color: '#FFC107',
        bgColor: '#FFF8E1',
        icon: 'time-outline',
      };
    case 'approved':
      return {
        label: 'Approved',
        color: '#7CB342',
        bgColor: '#F1F8E9',
        icon: 'checkmark-circle-outline',
      };
    case 'rejected':
      return {
        label: 'Declined',
        color: '#E53935',
        bgColor: '#FFEBEE',
        icon: 'close-circle-outline',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        color: '#9E9E9E',
        bgColor: '#F5F5F5',
        icon: 'ban-outline',
      };
    default:
      return {
        label: 'Unknown',
        color: '#9E9E9E',
        bgColor: '#F5F5F5',
        icon: 'help-circle-outline',
      };
  }
}
