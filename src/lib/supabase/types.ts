export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
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
      availability_slots: {
        Row: {
          created_at: string
          end_at: string
          extended_properties: Json | null
          id: string
          member_id: string
          recurring_rule_id: string | null
          service_id: string
          start_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          extended_properties?: Json | null
          id?: string
          member_id: string
          recurring_rule_id?: string | null
          service_id: string
          start_at: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_at?: string
          extended_properties?: Json | null
          id?: string
          member_id?: string
          recurring_rule_id?: string | null
          service_id?: string
          start_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_recurring_rule_fk"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_template_assignments: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          member_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          id?: string
          member_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          member_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_template_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_template_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "availability_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_template_windows: {
        Row: {
          end_time: string
          id: string
          start_time: string
          template_id: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          start_time: string
          template_id: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          start_time?: string
          template_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_template_windows_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "availability_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_templates: {
        Row: {
          created_at: string
          id: string
          member_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_templates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          extended_properties: Json | null
          id: string
          purchase_id: string
          service_id: string
          slot_id: string
          status: string
          tenant_id: string
          tenant_notes: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          extended_properties?: Json | null
          id?: string
          purchase_id: string
          service_id: string
          slot_id: string
          status?: string
          tenant_id: string
          tenant_notes?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          extended_properties?: Json | null
          id?: string
          purchase_id?: string
          service_id?: string
          slot_id?: string
          status?: string
          tenant_id?: string
          tenant_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "customer_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_purchases: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          classes_total: number
          classes_used: number
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          package_id: string | null
          payment_self_reported: string
          rejected_reason: string | null
          service_id: string
          tenant_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          classes_total: number
          classes_used?: number
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          package_id?: string | null
          payment_self_reported: string
          rejected_reason?: string | null
          service_id: string
          tenant_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          classes_total?: number
          classes_used?: number
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          package_id?: string | null
          payment_self_reported?: string
          rejected_reason?: string | null
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_purchases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchases_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          error_message: string | null
          id: string
          read_at: string | null
          related_id: string | null
          scheduled_for: string | null
          sent_at: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          channel?: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          related_id?: string | null
          scheduled_for?: string | null
          sent_at?: string
          status: string
          type: string
          user_id: string
        }
        Update: {
          channel?: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          related_id?: string | null
          scheduled_for?: string | null
          sent_at?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          booking_status_changes_enabled: boolean
          channels: Json
          daily_reminder_enabled: boolean
          daily_reminder_hour: number
          pre_event_enabled: boolean
          pre_event_minutes: number[]
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
          weekly_summary_enabled: boolean
        }
        Insert: {
          booking_status_changes_enabled?: boolean
          channels?: Json
          daily_reminder_enabled?: boolean
          daily_reminder_hour?: number
          pre_event_enabled?: boolean
          pre_event_minutes?: number[]
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
          weekly_summary_enabled?: boolean
        }
        Update: {
          booking_status_changes_enabled?: boolean
          channels?: Json
          daily_reminder_enabled?: boolean
          daily_reminder_hour?: number
          pre_event_enabled?: boolean
          pre_event_minutes?: number[]
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
          weekly_summary_enabled?: boolean
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_rules: {
        Row: {
          by_month_day: number | null
          by_weekday: number[] | null
          created_at: string
          end_condition: string
          end_count: number | null
          end_time: string
          end_until: string | null
          freq: string
          id: string
          interval_n: number
          is_active: boolean
          member_id: string
          service_id: string
          start_date: string
          start_time: string
          tenant_id: string
        }
        Insert: {
          by_month_day?: number | null
          by_weekday?: number[] | null
          created_at?: string
          end_condition: string
          end_count?: number | null
          end_time: string
          end_until?: string | null
          freq: string
          id?: string
          interval_n?: number
          is_active?: boolean
          member_id: string
          service_id: string
          start_date: string
          start_time: string
          tenant_id: string
        }
        Update: {
          by_month_day?: number | null
          by_weekday?: number[] | null
          created_at?: string
          end_condition?: string
          end_count?: number | null
          end_time?: string
          end_until?: string | null
          freq?: string
          id?: string
          interval_n?: number
          is_active?: boolean
          member_id?: string
          service_id?: string
          start_date?: string
          start_time?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          class_count: number
          created_at: string
          expires_in_days: number | null
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          price: number
          service_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          class_count: number
          created_at?: string
          expires_in_days?: number | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          price: number
          service_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          class_count?: number
          created_at?: string
          expires_in_days?: number | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          service_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          cancel_deadline_hours: number
          created_at: string
          description: string | null
          duration_minutes: number
          extended_properties: Json | null
          id: string
          is_active: boolean
          max_capacity: number
          min_attendance: number
          name: string
          price: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancel_deadline_hours?: number
          created_at?: string
          description?: string | null
          duration_minutes: number
          extended_properties?: Json | null
          id?: string
          is_active?: boolean
          max_capacity?: number
          min_attendance?: number
          name: string
          price?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancel_deadline_hours?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          extended_properties?: Json | null
          id?: string
          is_active?: boolean
          max_capacity?: number
          min_attendance?: number
          name?: string
          price?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_customers: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_blocked: boolean
          tenant_id: string
          tenant_notes: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_blocked?: boolean
          tenant_id: string
          tenant_notes?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_blocked?: boolean
          tenant_id?: string
          tenant_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_email: string | null
          parent_member_id: string | null
          role: string
          status: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_email?: string | null
          parent_member_id?: string | null
          role: string
          status?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_email?: string | null
          parent_member_id?: string | null
          role?: string
          status?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_parent_member_id_fkey"
            columns: ["parent_member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_photos: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number
          id: string
          storage_path: string
          tenant_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          storage_path: string
          tenant_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          avatar_url: string | null
          bio_html: string | null
          city: string | null
          contact_email: string | null
          contact_line_id: string | null
          contact_note: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          established_year: number | null
          id: string
          intro_video_url: string | null
          name: string
          slug: string
          status: string
          updated_at: string
          years_exp: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio_html?: string | null
          city?: string | null
          contact_email?: string | null
          contact_line_id?: string | null
          contact_note?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          established_year?: number | null
          id?: string
          intro_video_url?: string | null
          name: string
          slug: string
          status?: string
          updated_at?: string
          years_exp?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio_html?: string | null
          city?: string | null
          contact_email?: string | null
          contact_line_id?: string | null
          contact_note?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          established_year?: number | null
          id?: string
          intro_video_url?: string | null
          name?: string
          slug?: string
          status?: string
          updated_at?: string
          years_exp?: number | null
        }
        Relationships: []
      }
      unavailable_events: {
        Row: {
          created_at: string
          end_at: string
          id: string
          member_id: string
          reason: string | null
          start_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          member_id: string
          reason?: string | null
          start_at: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          member_id?: string
          reason?: string | null
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unavailable_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_cancel_group_slot: {
        Args: { p_slot_id: string }
        Returns: {
          affected_customer_id: string
          affected_member_user_id: string
          service_name: string
          slot_start_at: string
        }[]
      }
      book_slot_atomic: {
        Args: {
          p_customer_id: string
          p_customer_notes?: string
          p_slot_id: string
        }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          extended_properties: Json | null
          id: string
          purchase_id: string
          service_id: string
          slot_id: string
          status: string
          tenant_id: string
          tenant_notes: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      book_with_purchase: {
        Args: {
          p_customer_id: string
          p_customer_notes?: string
          p_purchase_id?: string
          p_slot_id: string
        }
        Returns: {
          auto_confirmed: boolean
          booking_id: string
        }[]
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          extended_properties: Json | null
          id: string
          purchase_id: string
          service_id: string
          slot_id: string
          status: string
          tenant_id: string
          tenant_notes: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_booking: {
        Args: { p_booking_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          extended_properties: Json | null
          id: string
          purchase_id: string
          service_id: string
          slot_id: string
          status: string
          tenant_id: string
          tenant_notes: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_owner_tenant_ids: { Args: never; Returns: string[] }
      current_user_tenant_ids: { Args: never; Returns: string[] }
      is_platform_admin: { Args: never; Returns: boolean }
      reschedule_booking: {
        Args: { p_new_slot_id: string; p_old_booking_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          extended_properties: Json | null
          id: string
          purchase_id: string
          service_id: string
          slot_id: string
          status: string
          tenant_id: string
          tenant_notes: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
