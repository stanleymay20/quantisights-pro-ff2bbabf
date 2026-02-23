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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      data_sources: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          credentials_key_hash: string | null
          id: string
          last_synced_at: string | null
          name: string
          organization_id: string
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by: string
          credentials_key_hash?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          organization_id: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          credentials_key_hash?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          data_source_id: string
          error_message: string | null
          id: string
          organization_id: string
          records_synced: number | null
          request_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data_source_id: string
          error_message?: string | null
          id?: string
          organization_id: string
          records_synced?: number | null
          request_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data_source_id?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          records_synced?: number | null
          request_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sync_jobs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_versions: {
        Row: {
          change_summary: string | null
          column_mapping: Json | null
          created_at: string
          created_by: string
          dataset_id: string
          file_path: string | null
          id: string
          is_active: boolean
          organization_id: string
          row_count: number | null
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          column_mapping?: Json | null
          created_at?: string
          created_by: string
          dataset_id: string
          file_path?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          row_count?: number | null
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          column_mapping?: Json | null
          created_at?: string
          created_by?: string
          dataset_id?: string
          file_path?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          row_count?: number | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "dataset_versions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          column_mapping: Json | null
          created_at: string
          current_version: number | null
          data_source_id: string | null
          file_path: string | null
          id: string
          name: string
          organization_id: string
          row_count: number | null
          status: string
          uploaded_by: string
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string
          current_version?: number | null
          data_source_id?: string | null
          file_path?: string | null
          id?: string
          name: string
          organization_id: string
          row_count?: number | null
          status?: string
          uploaded_by: string
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string
          current_version?: number | null
          data_source_id?: string | null
          file_path?: string | null
          id?: string
          name?: string
          organization_id?: string
          row_count?: number | null
          status?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasets_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datasets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_alerts: {
        Row: {
          created_at: string
          id: string
          kpi_id: string | null
          metric_type: string | null
          organization_id: string
          resolved_at: string | null
          role_type: string
          severity: string
          status: string
          threshold_value: number | null
          title: string
          trigger_value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_id?: string | null
          metric_type?: string | null
          organization_id: string
          resolved_at?: string | null
          role_type: string
          severity?: string
          status?: string
          threshold_value?: number | null
          title: string
          trigger_value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kpi_id?: string | null
          metric_type?: string | null
          organization_id?: string
          resolved_at?: string | null
          role_type?: string
          severity?: string
          status?: string
          threshold_value?: number | null
          title?: string
          trigger_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_alerts_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_briefs: {
        Row: {
          generated_at: string
          generated_by: string
          id: string
          organization_id: string
          risk_score: number | null
          role_type: string
          summary_json: Json
        }
        Insert: {
          generated_at?: string
          generated_by?: string
          id?: string
          organization_id: string
          risk_score?: number | null
          role_type: string
          summary_json?: Json
        }
        Update: {
          generated_at?: string
          generated_by?: string
          id?: string
          organization_id?: string
          risk_score?: number | null
          role_type?: string
          summary_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "executive_briefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_modes: {
        Row: {
          alert_thresholds: Json
          created_at: string
          id: string
          organization_id: string
          priority_kpis: Json
          role_type: string
          updated_at: string
        }
        Insert: {
          alert_thresholds?: Json
          created_at?: string
          id?: string
          organization_id: string
          priority_kpis?: Json
          role_type: string
          updated_at?: string
        }
        Update: {
          alert_thresholds?: Json
          created_at?: string
          id?: string
          organization_id?: string
          priority_kpis?: Json
          role_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_modes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_risk_index: {
        Row: {
          components: Json
          created_at: string
          id: string
          last_updated: string
          organization_id: string
          role_type: string
          score: number
        }
        Insert: {
          components?: Json
          created_at?: string
          id?: string
          last_updated?: string
          organization_id: string
          role_type: string
          score?: number
        }
        Update: {
          components?: Json
          created_at?: string
          id?: string
          last_updated?: string
          organization_id?: string
          role_type?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "executive_risk_index_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          organization_id: string
          severity: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          organization_id: string
          severity?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          organization_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_targets: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kpi_id: string
          organization_id: string
          target_date: string
          target_value: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kpi_id: string
          organization_id: string
          target_date: string
          target_value: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kpi_id?: string
          organization_id?: string
          target_date?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_targets_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_values: {
        Row: {
          computed_at: string
          date: string
          id: string
          kpi_id: string
          organization_id: string
          value: number
        }
        Insert: {
          computed_at?: string
          date: string
          id?: string
          kpi_id: string
          organization_id: string
          value: number
        }
        Update: {
          computed_at?: string
          date?: string
          id?: string
          kpi_id?: string
          organization_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_values_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          aggregation_type: string
          created_at: string
          created_by: string
          description: string | null
          formula: string
          id: string
          metric_dependencies: Json
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          aggregation_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          formula: string
          id?: string
          metric_dependencies?: Json
          name: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          aggregation_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          formula?: string
          id?: string
          metric_dependencies?: Json
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          created_at: string
          dataset_id: string | null
          date: string
          id: string
          metric_type: string
          organization_id: string
          region: string | null
          segment: string | null
          value: number
        }
        Insert: {
          created_at?: string
          dataset_id?: string | null
          date: string
          id?: string
          metric_type: string
          organization_id: string
          region?: string | null
          segment?: string | null
          value: number
        }
        Update: {
          created_at?: string
          dataset_id?: string | null
          date?: string
          id?: string
          metric_type?: string
          organization_id?: string
          region?: string | null
          segment?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          file_path: string
          generated_by: string
          id: string
          organization_id: string
          report_type: string
        }
        Insert: {
          created_at?: string
          file_path: string
          generated_by: string
          id?: string
          organization_id: string
          report_type?: string
        }
        Update: {
          created_at?: string
          file_path?: string
          generated_by?: string
          id?: string
          organization_id?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_assumptions: {
        Row: {
          adjustment_type: string
          adjustment_value: number
          created_at: string
          id: string
          metric_type: string
          scenario_id: string
        }
        Insert: {
          adjustment_type?: string
          adjustment_value: number
          created_at?: string
          id?: string
          metric_type: string
          scenario_id: string
        }
        Update: {
          adjustment_type?: string
          adjustment_value?: number
          created_at?: string
          id?: string
          metric_type?: string
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_assumptions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_results: {
        Row: {
          baseline_value: number
          created_at: string
          date: string
          delta_value: number
          id: string
          kpi_id: string
          organization_id: string
          scenario_id: string
          simulated_value: number
        }
        Insert: {
          baseline_value: number
          created_at?: string
          date: string
          delta_value: number
          id?: string
          kpi_id: string
          organization_id: string
          scenario_id: string
          simulated_value: number
        }
        Update: {
          baseline_value?: number
          created_at?: string
          date?: string
          delta_value?: number
          id?: string
          kpi_id?: string
          organization_id?: string
          scenario_id?: string
          simulated_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "scenario_results_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_results_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          forecast_end_date: string
          forecast_start_date: string
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          forecast_end_date: string
          forecast_start_date: string
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          forecast_end_date?: string
          forecast_start_date?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          organization_id: string
          price_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id: string
          price_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tier?: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "analyst" | "executive" | "client_viewer"
      org_role: "owner" | "admin" | "analyst" | "executive" | "viewer"
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
  public: {
    Enums: {
      app_role: ["admin", "analyst", "executive", "client_viewer"],
      org_role: ["owner", "admin", "analyst", "executive", "viewer"],
    },
  },
} as const
