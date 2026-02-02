export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string | null
          criteria: Json
          description: string
          icon: string
          id: string
          name: string
          points: number | null
        }
        Insert: {
          created_at?: string | null
          criteria?: Json
          description: string
          icon: string
          id?: string
          name: string
          points?: number | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json
          description?: string
          icon?: string
          id?: string
          name?: string
          points?: number | null
        }
        Relationships: []
      }
      assignments: {
        Row: {
          assigned_at: string | null
          completed_at: string | null
          completed_by: string | null
          config: Json
          created_at: string | null
          due_date: string | null
          id: string
          pdf_url: string | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          student_id: string
          worksheet_type: Database["public"]["Enums"]["worksheet_type"]
        }
        Insert: {
          assigned_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          config?: Json
          created_at?: string | null
          due_date?: string | null
          id?: string
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          student_id: string
          worksheet_type: Database["public"]["Enums"]["worksheet_type"]
        }
        Update: {
          assigned_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          config?: Json
          created_at?: string | null
          due_date?: string | null
          id?: string
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          student_id?: string
          worksheet_type?: Database["public"]["Enums"]["worksheet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "assignments_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: Database["public"]["Enums"]["message_role"]
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: Database["public"]["Enums"]["message_role"]
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: Database["public"]["Enums"]["message_role"]
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          lesson_id: string | null
          student_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          student_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          student_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_requests: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          parent_id: string
          preferred_date: string
          preferred_duration: number | null
          preferred_time: string | null
          request_group_id: string | null
          scheduled_lesson_id: string | null
          status: Database["public"]["Enums"]["lesson_request_status"] | null
          student_id: string
          subject: string
          tutor_response: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_id: string
          preferred_date: string
          preferred_duration?: number | null
          preferred_time?: string | null
          request_group_id?: string | null
          scheduled_lesson_id?: string | null
          status?: Database["public"]["Enums"]["lesson_request_status"] | null
          student_id: string
          subject: string
          tutor_response?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_id?: string
          preferred_date?: string
          preferred_duration?: number | null
          preferred_time?: string | null
          request_group_id?: string | null
          scheduled_lesson_id?: string | null
          status?: Database["public"]["Enums"]["lesson_request_status"] | null
          student_id?: string
          subject?: string
          tutor_response?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_requests_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_requests_scheduled_lesson_id_fkey"
            columns: ["scheduled_lesson_id"]
            isOneToOne: false
            referencedRelation: "scheduled_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_sessions: {
        Row: {
          created_at: string | null
          duration_min: number
          id: string
          notes: string | null
          scheduled_at: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          scheduled_at: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          scheduled_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content: Json
          created_at: string | null
          description: string | null
          difficulty_level: number | null
          estimated_duration_minutes: number | null
          grade_level: string
          id: string
          order_index: number | null
          subject_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: Json
          created_at?: string | null
          description?: string | null
          difficulty_level?: number | null
          estimated_duration_minutes?: number | null
          grade_level: string
          id?: string
          order_index?: number | null
          subject_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          description?: string | null
          difficulty_level?: number | null
          estimated_duration_minutes?: number | null
          grade_level?: string
          id?: string
          order_index?: number | null
          subject_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string | null
          email: string
          id: string
          invitation_accepted_at: string | null
          invitation_expires_at: string | null
          invitation_sent_at: string | null
          invitation_token: string | null
          name: string
          onboarding_completed_at: string | null
          phone: string | null
          preferences: Json | null
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          invitation_accepted_at?: string | null
          invitation_expires_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          name: string
          onboarding_completed_at?: string | null
          phone?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invitation_accepted_at?: string | null
          invitation_expires_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          name?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_lessons: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          lesson_id: string
          payment_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          id?: string
          lesson_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          lesson_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "scheduled_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_lessons_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string | null
          id: string
          month: string
          notes: string | null
          paid_at: string | null
          parent_id: string
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string | null
          id?: string
          month: string
          notes?: string | null
          paid_at?: string | null
          parent_id: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string | null
          id?: string
          month?: string
          notes?: string | null
          paid_at?: string | null
          parent_id?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_lessons: {
        Row: {
          created_at: string | null
          duration_min: number
          id: string
          notes: string | null
          override_amount: number | null
          scheduled_at: string
          session_id: string | null
          status: Database["public"]["Enums"]["lesson_status"] | null
          student_id: string
          subject: Database["public"]["Enums"]["tutoring_subject"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          override_amount?: number | null
          scheduled_at: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["lesson_status"] | null
          student_id: string
          subject: Database["public"]["Enums"]["tutoring_subject"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          override_amount?: number | null
          scheduled_at?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["lesson_status"] | null
          student_id?: string
          subject?: Database["public"]["Enums"]["tutoring_subject"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_lessons_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lesson_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_achievements: {
        Row: {
          achievement_id: string
          earned_at: string | null
          id: string
          student_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string | null
          id?: string
          student_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string | null
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string
          score: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["progress_status"] | null
          student_id: string
          time_spent_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id: string
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["progress_status"] | null
          student_id: string
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["progress_status"] | null
          student_id?: string
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          age: number
          avatar_url: string | null
          created_at: string | null
          grade_level: string
          hourly_rate: number | null
          id: string
          name: string
          parent_id: string
          subject_rates: Json | null
          subjects: string[] | null
          updated_at: string | null
        }
        Insert: {
          age: number
          avatar_url?: string | null
          created_at?: string | null
          grade_level: string
          hourly_rate?: number | null
          id?: string
          name: string
          parent_id: string
          subject_rates?: Json | null
          subjects?: string[] | null
          updated_at?: string | null
        }
        Update: {
          age?: number
          avatar_url?: string | null
          created_at?: string | null
          grade_level?: string
          hourly_rate?: number | null
          id?: string
          name?: string
          parent_id?: string
          subject_rates?: Json | null
          subjects?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      tutor_availability: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          end_time: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          specific_date: string | null
          start_time: string
          tutor_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          specific_date?: string | null
          start_time: string
          tutor_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          specific_date?: string | null
          start_time?: string
          tutor_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_availability_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_settings: {
        Row: {
          combined_session_rate: number
          created_at: string | null
          default_base_duration: number
          default_rate: number
          id: string
          subject_rates: Json
          tutor_id: string | null
          updated_at: string | null
        }
        Insert: {
          combined_session_rate?: number
          created_at?: string | null
          default_base_duration?: number
          default_rate?: number
          id?: string
          subject_rates?: Json
          tutor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          combined_session_rate?: number
          created_at?: string | null
          default_base_duration?: number
          default_rate?: number
          id?: string
          subject_rates?: Json
          tutor_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_parent_invitation: {
        Args: { auth_user_id: string; token: string }
        Returns: boolean
      }
      complete_parent_onboarding: {
        Args: {
          p_name?: string
          p_phone?: string
          p_preferences?: Json
          p_user_id: string
        }
        Returns: boolean
      }
      generate_parent_invitation: {
        Args: { parent_id: string }
        Returns: string
      }
      get_busy_slots_for_date: {
        Args: { check_date: string }
        Returns: {
          end_time: string
          start_time: string
        }[]
      }
      get_parent_id: { Args: never; Returns: string }
      is_tutor: { Args: never; Returns: boolean }
      parent_needs_onboarding: { Args: { p_user_id: string }; Returns: boolean }
      validate_invitation_token: {
        Args: { token: string }
        Returns: {
          parent_id: string
          email: string
          name: string
          tutor_id: string | null
          tutor_business_name: string | null
          tutor_name: string | null
          tutor_subscription_active: boolean
          is_valid: boolean
          error_message: string | null
        }[]
      }
      get_parent_tutor_info: {
        Args: { p_parent_id: string }
        Returns: {
          tutor_id: string | null
          tutor_name: string | null
          business_name: string | null
          subscription_active: boolean
        }[]
      }
      get_my_tutor_info: {
        Args: Record<string, never>
        Returns: {
          tutor_id: string | null
          tutor_name: string | null
          business_name: string | null
          subscription_active: boolean
        }[]
      }
    }
    Enums: {
      assignment_status: "assigned" | "completed"
      lesson_request_status: "pending" | "approved" | "rejected" | "scheduled"
      lesson_status: "scheduled" | "completed" | "cancelled"
      message_role: "user" | "assistant" | "system"
      payment_status: "unpaid" | "partial" | "paid"
      progress_status: "not_started" | "in_progress" | "completed"
      tutoring_subject: "piano" | "math" | "reading" | "speech" | "english"
      worksheet_type: "piano_naming" | "piano_drawing" | "math"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      assignment_status: ["assigned", "completed"],
      lesson_request_status: ["pending", "approved", "rejected", "scheduled"],
      lesson_status: ["scheduled", "completed", "cancelled"],
      message_role: ["user", "assistant", "system"],
      payment_status: ["unpaid", "partial", "paid"],
      progress_status: ["not_started", "in_progress", "completed"],
      tutoring_subject: ["piano", "math", "reading", "speech", "english"],
      worksheet_type: ["piano_naming", "piano_drawing", "math"],
    },
  },
} as const

