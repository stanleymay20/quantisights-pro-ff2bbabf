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
      advisory_instances: {
        Row: {
          action: string
          advisory_type: string
          assigned_to: string | null
          capped_confidence: number | null
          category: string
          confidence: number | null
          confidence_cap_reason: string | null
          created_at: string
          data_quality_index: number | null
          data_snapshot_date: string | null
          expected_impact: string | null
          generation_version: number | null
          id: string
          impact_score: number | null
          kpi_affected: Json | null
          organization_id: string
          playbook_steps: Json | null
          priority: string
          rationale: string | null
          raw_confidence: number | null
          resolution_summary: string | null
          resolved_at: string | null
          source_evidence: Json | null
          status: string
          timeframe: string | null
          title: string
          updated_at: string
          variance_score: number | null
        }
        Insert: {
          action: string
          advisory_type: string
          assigned_to?: string | null
          capped_confidence?: number | null
          category?: string
          confidence?: number | null
          confidence_cap_reason?: string | null
          created_at?: string
          data_quality_index?: number | null
          data_snapshot_date?: string | null
          expected_impact?: string | null
          generation_version?: number | null
          id?: string
          impact_score?: number | null
          kpi_affected?: Json | null
          organization_id: string
          playbook_steps?: Json | null
          priority?: string
          rationale?: string | null
          raw_confidence?: number | null
          resolution_summary?: string | null
          resolved_at?: string | null
          source_evidence?: Json | null
          status?: string
          timeframe?: string | null
          title: string
          updated_at?: string
          variance_score?: number | null
        }
        Update: {
          action?: string
          advisory_type?: string
          assigned_to?: string | null
          capped_confidence?: number | null
          category?: string
          confidence?: number | null
          confidence_cap_reason?: string | null
          created_at?: string
          data_quality_index?: number | null
          data_snapshot_date?: string | null
          expected_impact?: string | null
          generation_version?: number | null
          id?: string
          impact_score?: number | null
          kpi_affected?: Json | null
          organization_id?: string
          playbook_steps?: Json | null
          priority?: string
          rationale?: string | null
          raw_confidence?: number | null
          resolution_summary?: string | null
          resolved_at?: string | null
          source_evidence?: Json | null
          status?: string
          timeframe?: string | null
          title?: string
          updated_at?: string
          variance_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "advisory_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_explanations: {
        Row: {
          confidence_breakdown: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          explanation_narrative: string | null
          feature_attributions: Json
          id: string
          model_used: string | null
          organization_id: string
        }
        Insert: {
          confidence_breakdown?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          explanation_narrative?: string | null
          feature_attributions?: Json
          id?: string
          model_used?: string | null
          organization_id: string
        }
        Update: {
          confidence_breakdown?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          explanation_narrative?: string | null
          feature_attributions?: Json
          id?: string
          model_used?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_explanations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_playbooks: {
        Row: {
          cooldown_minutes: number
          created_at: string
          created_by: string
          description: string | null
          escalation_steps: Json
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          organization_id: string
          severity: string
          trigger_condition: string
          trigger_metric: string
          trigger_threshold: number
          updated_at: string
        }
        Insert: {
          cooldown_minutes?: number
          created_at?: string
          created_by: string
          description?: string | null
          escalation_steps?: Json
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          organization_id: string
          severity?: string
          trigger_condition?: string
          trigger_metric: string
          trigger_threshold: number
          updated_at?: string
        }
        Update: {
          cooldown_minutes?: number
          created_at?: string
          created_by?: string
          description?: string | null
          escalation_steps?: Json
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          organization_id?: string
          severity?: string
          trigger_condition?: string
          trigger_metric?: string
          trigger_threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_playbooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          ip_address: string | null
          organization_id: string
          payload: Json | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id: string
          payload?: Json | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          payload?: Json | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_scores: {
        Row: {
          benchmark_id: string
          computed_at: string
          created_at: string
          current_value: number
          gap_to_p75: number | null
          gap_to_p90: number | null
          id: string
          metric_type: string
          organization_id: string
          percentile_rank: number
          quartile: number
          trend: string | null
        }
        Insert: {
          benchmark_id: string
          computed_at?: string
          created_at?: string
          current_value: number
          gap_to_p75?: number | null
          gap_to_p90?: number | null
          id?: string
          metric_type: string
          organization_id: string
          percentile_rank?: number
          quartile?: number
          trend?: string | null
        }
        Update: {
          benchmark_id?: string
          computed_at?: string
          created_at?: string
          current_value?: number
          gap_to_p75?: number | null
          gap_to_p90?: number | null
          id?: string
          metric_type?: string
          organization_id?: string
          percentile_rank?: number
          quartile?: number
          trend?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_scores_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: false
            referencedRelation: "industry_benchmarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benchmark_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_assessments: {
        Row: {
          bias_markers: Json | null
          brier_score: number | null
          calibration_profile: string | null
          completed_at: string | null
          created_at: string
          id: string
          organization_id: string
          overconfidence_score: number | null
          responses: Json
          underconfidence_score: number | null
          user_id: string
        }
        Insert: {
          bias_markers?: Json | null
          brier_score?: number | null
          calibration_profile?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          organization_id: string
          overconfidence_score?: number | null
          responses?: Json
          underconfidence_score?: number | null
          user_id: string
        }
        Update: {
          bias_markers?: Json | null
          brier_score?: number | null
          calibration_profile?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          overconfidence_score?: number | null
          responses?: Json
          underconfidence_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      calibration_models: {
        Row: {
          ai_narrative: string | null
          band_corrections: Json
          band_sample_sizes: Json
          computed_at: string
          confidence_bands_count: number
          created_at: string
          id: string
          low_sample_bands: Json
          mean_absolute_error: number | null
          model_version: number
          organization_id: string
          overall_bias_direction: string | null
          overall_calibration_score: number | null
          smoothing_alpha: number
          smoothing_beta: number
          success_metric: string
          total_decisions_analyzed: number
          window_decisions_count: number
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          ai_narrative?: string | null
          band_corrections?: Json
          band_sample_sizes?: Json
          computed_at?: string
          confidence_bands_count?: number
          created_at?: string
          id?: string
          low_sample_bands?: Json
          mean_absolute_error?: number | null
          model_version?: number
          organization_id: string
          overall_bias_direction?: string | null
          overall_calibration_score?: number | null
          smoothing_alpha?: number
          smoothing_beta?: number
          success_metric?: string
          total_decisions_analyzed?: number
          window_decisions_count?: number
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          ai_narrative?: string | null
          band_corrections?: Json
          band_sample_sizes?: Json
          computed_at?: string
          confidence_bands_count?: number
          created_at?: string
          id?: string
          low_sample_bands?: Json
          mean_absolute_error?: number | null
          model_version?: number
          organization_id?: string
          overall_bias_direction?: string | null
          overall_calibration_score?: number | null
          smoothing_alpha?: number
          smoothing_beta?: number
          success_metric?: string
          total_decisions_analyzed?: number
          window_decisions_count?: number
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calibration_models_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      causal_models: {
        Row: {
          confidence_score: number | null
          created_at: string
          created_by: string | null
          dag_structure: Json
          description: string | null
          id: string
          inference_results: Json | null
          model_status: string
          name: string
          organization_id: string
          sample_size: number | null
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          dag_structure?: Json
          description?: string | null
          id?: string
          inference_results?: Json | null
          model_status?: string
          name: string
          organization_id: string
          sample_size?: number | null
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          dag_structure?: Json
          description?: string | null
          id?: string
          inference_results?: Json | null
          model_status?: string
          name?: string
          organization_id?: string
          sample_size?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "causal_models_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cognitive_bias_detections: {
        Row: {
          bias_name: string
          bias_type: string
          confidence: number | null
          decision_id: string | null
          description: string
          detected_at: string
          dismissed_at: string | null
          dismissed_by: string | null
          evidence: Json | null
          id: string
          mitigation_suggestion: string | null
          organization_id: string
          severity: string
        }
        Insert: {
          bias_name: string
          bias_type: string
          confidence?: number | null
          decision_id?: string | null
          description: string
          detected_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          evidence?: Json | null
          id?: string
          mitigation_suggestion?: string | null
          organization_id: string
          severity?: string
        }
        Update: {
          bias_name?: string
          bias_type?: string
          confidence?: number | null
          decision_id?: string | null
          description?: string
          detected_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          evidence?: Json | null
          id?: string
          mitigation_suggestion?: string | null
          organization_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "cognitive_bias_detections_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cognitive_bias_detections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      convergence_usage: {
        Row: {
          call_count: number
          date: string
          id: string
          organization_id: string
        }
        Insert: {
          call_count?: number
          date?: string
          id?: string
          organization_id: string
        }
        Update: {
          call_count?: number
          date?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convergence_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          role: string
          session_id: string
          structured_response: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id: string
          role: string
          session_id: string
          structured_response?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          session_id?: string
          structured_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "copilot_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_sessions: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_usage: {
        Row: {
          call_count: number
          date: string
          id: string
          organization_id: string
        }
        Insert: {
          call_count?: number
          date?: string
          id?: string
          organization_id: string
        }
        Update: {
          call_count?: number
          date?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      counterfactual_analyses: {
        Row: {
          confidence: number | null
          counterfactual_scenario: string
          created_at: string
          entity_id: string
          entity_type: string
          factors_to_change: Json
          id: string
          minimum_changes_required: number | null
          narrative: string | null
          organization_id: string
          original_recommendation: string
          sensitivity_ranking: Json | null
        }
        Insert: {
          confidence?: number | null
          counterfactual_scenario: string
          created_at?: string
          entity_id: string
          entity_type: string
          factors_to_change?: Json
          id?: string
          minimum_changes_required?: number | null
          narrative?: string | null
          organization_id: string
          original_recommendation: string
          sensitivity_ranking?: Json | null
        }
        Update: {
          confidence?: number | null
          counterfactual_scenario?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          factors_to_change?: Json
          id?: string
          minimum_changes_required?: number | null
          narrative?: string | null
          organization_id?: string
          original_recommendation?: string
          sensitivity_ranking?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "counterfactual_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_quality_checks: {
        Row: {
          check_type: string
          created_at: string
          dataset_id: string | null
          details: Json | null
          id: string
          organization_id: string
          records_checked: number | null
          records_failed: number | null
          score: number | null
          status: string
        }
        Insert: {
          check_type?: string
          created_at?: string
          dataset_id?: string | null
          details?: Json | null
          id?: string
          organization_id: string
          records_checked?: number | null
          records_failed?: number | null
          score?: number | null
          status?: string
        }
        Update: {
          check_type?: string
          created_at?: string
          dataset_id?: string | null
          details?: Json | null
          id?: string
          organization_id?: string
          records_checked?: number | null
          records_failed?: number | null
          score?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_checks_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          freshness_policy_hours: number | null
          id: string
          is_stale: boolean | null
          last_refreshed_at: string | null
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
          freshness_policy_hours?: number | null
          id?: string
          is_stale?: boolean | null
          last_refreshed_at?: string | null
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
          freshness_policy_hours?: number | null
          id?: string
          is_stale?: boolean | null
          last_refreshed_at?: string | null
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
      decision_approvals: {
        Row: {
          approver_id: string
          comments: string | null
          decision_id: string
          id: string
          organization_id: string
          requested_at: string
          requested_by: string
          responded_at: string | null
          status: string
          verdict: string | null
        }
        Insert: {
          approver_id: string
          comments?: string | null
          decision_id: string
          id?: string
          organization_id: string
          requested_at?: string
          requested_by: string
          responded_at?: string | null
          status?: string
          verdict?: string | null
        }
        Update: {
          approver_id?: string
          comments?: string | null
          decision_id?: string
          id?: string
          organization_id?: string
          requested_at?: string
          requested_by?: string
          responded_at?: string | null
          status?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_approvals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_comments: {
        Row: {
          content: string
          created_at: string
          decision_id: string
          id: string
          mentions: string[] | null
          organization_id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          decision_id: string
          id?: string
          mentions?: string[] | null
          organization_id: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          decision_id?: string
          id?: string
          mentions?: string[] | null
          organization_id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_comments_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "decision_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_ledger: {
        Row: {
          actual_value: number | null
          advisory_instance_id: string | null
          baseline_value: number | null
          calibration_error: number | null
          capped_confidence: number | null
          chosen_action: string | null
          confidence_at_decision: number | null
          confidence_cap_reason: string | null
          confidence_updated: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_simulation_id: string | null
          decision_status: string
          decision_type: string
          execution_completed_at: string | null
          execution_started_at: string | null
          execution_status: string
          expected_value_at_decision: number | null
          id: string
          kpi_id: string | null
          model_calibration_adjustment: number | null
          notes: string | null
          organization_id: string
          outcome_delta: number | null
          outcome_measured_at: string | null
          predicted_net_impact: number | null
          predicted_roi_probability: number | null
          prediction_accuracy_score: number | null
          probability_of_success: number | null
          raw_confidence: number | null
          recommended_action: string
          simulation_id: string | null
          updated_at: string
        }
        Insert: {
          actual_value?: number | null
          advisory_instance_id?: string | null
          baseline_value?: number | null
          calibration_error?: number | null
          capped_confidence?: number | null
          chosen_action?: string | null
          confidence_at_decision?: number | null
          confidence_cap_reason?: string | null
          confidence_updated?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_simulation_id?: string | null
          decision_status?: string
          decision_type?: string
          execution_completed_at?: string | null
          execution_started_at?: string | null
          execution_status?: string
          expected_value_at_decision?: number | null
          id?: string
          kpi_id?: string | null
          model_calibration_adjustment?: number | null
          notes?: string | null
          organization_id: string
          outcome_delta?: number | null
          outcome_measured_at?: string | null
          predicted_net_impact?: number | null
          predicted_roi_probability?: number | null
          prediction_accuracy_score?: number | null
          probability_of_success?: number | null
          raw_confidence?: number | null
          recommended_action: string
          simulation_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_value?: number | null
          advisory_instance_id?: string | null
          baseline_value?: number | null
          calibration_error?: number | null
          capped_confidence?: number | null
          chosen_action?: string | null
          confidence_at_decision?: number | null
          confidence_cap_reason?: string | null
          confidence_updated?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_simulation_id?: string | null
          decision_status?: string
          decision_type?: string
          execution_completed_at?: string | null
          execution_started_at?: string | null
          execution_status?: string
          expected_value_at_decision?: number | null
          id?: string
          kpi_id?: string | null
          model_calibration_adjustment?: number | null
          notes?: string | null
          organization_id?: string
          outcome_delta?: number | null
          outcome_measured_at?: string | null
          predicted_net_impact?: number | null
          predicted_roi_probability?: number | null
          prediction_accuracy_score?: number | null
          probability_of_success?: number | null
          raw_confidence?: number | null
          recommended_action?: string
          simulation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_ledger_advisory_instance_id_fkey"
            columns: ["advisory_instance_id"]
            isOneToOne: false
            referencedRelation: "advisory_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_ledger_decision_simulation_id_fkey"
            columns: ["decision_simulation_id"]
            isOneToOne: false
            referencedRelation: "decision_simulations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_ledger_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_ledger_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulation_results"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_simulations: {
        Row: {
          actual_net_impact: number | null
          calibration_delta: number | null
          capped_confidence: number | null
          churn_change_pct: number | null
          confidence_cap_reason: string | null
          correlation_assumptions: Json | null
          cost_delta_pct: number | null
          created_at: string
          created_by: string | null
          data_sufficiency: string | null
          decision_id: string | null
          expected_net_impact: number | null
          id: string
          implementation_cost: number | null
          measured_at: string | null
          median_net_impact: number | null
          model_version: number | null
          organization_id: string
          p10_impact: number | null
          p50_impact: number | null
          p90_impact: number | null
          probability_cashflow_stress: number | null
          probability_positive_roi: number | null
          raw_confidence: number | null
          revenue_delta_pct: number | null
          risk_adjusted_expected_value: number | null
          sample_size: number | null
          simulation_runs: number | null
          time_to_impact_months: number | null
          variance_score: number | null
        }
        Insert: {
          actual_net_impact?: number | null
          calibration_delta?: number | null
          capped_confidence?: number | null
          churn_change_pct?: number | null
          confidence_cap_reason?: string | null
          correlation_assumptions?: Json | null
          cost_delta_pct?: number | null
          created_at?: string
          created_by?: string | null
          data_sufficiency?: string | null
          decision_id?: string | null
          expected_net_impact?: number | null
          id?: string
          implementation_cost?: number | null
          measured_at?: string | null
          median_net_impact?: number | null
          model_version?: number | null
          organization_id: string
          p10_impact?: number | null
          p50_impact?: number | null
          p90_impact?: number | null
          probability_cashflow_stress?: number | null
          probability_positive_roi?: number | null
          raw_confidence?: number | null
          revenue_delta_pct?: number | null
          risk_adjusted_expected_value?: number | null
          sample_size?: number | null
          simulation_runs?: number | null
          time_to_impact_months?: number | null
          variance_score?: number | null
        }
        Update: {
          actual_net_impact?: number | null
          calibration_delta?: number | null
          capped_confidence?: number | null
          churn_change_pct?: number | null
          confidence_cap_reason?: string | null
          correlation_assumptions?: Json | null
          cost_delta_pct?: number | null
          created_at?: string
          created_by?: string | null
          data_sufficiency?: string | null
          decision_id?: string | null
          expected_net_impact?: number | null
          id?: string
          implementation_cost?: number | null
          measured_at?: string | null
          median_net_impact?: number | null
          model_version?: number | null
          organization_id?: string
          p10_impact?: number | null
          p50_impact?: number | null
          p90_impact?: number | null
          probability_cashflow_stress?: number | null
          probability_positive_roi?: number | null
          raw_confidence?: number | null
          revenue_delta_pct?: number | null
          risk_adjusted_expected_value?: number | null
          sample_size?: number | null
          simulation_runs?: number | null
          time_to_impact_months?: number | null
          variance_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_simulations_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_simulations_organization_id_fkey"
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
          notification_channel: string | null
          notified_at: string | null
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
          notification_channel?: string | null
          notified_at?: string | null
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
          notification_channel?: string | null
          notified_at?: string | null
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
      executive_conflicts: {
        Row: {
          created_at: string
          description: string
          id: string
          organization_id: string
          resolved_at: string | null
          role_1: string
          role_2: string
          rule_triggered: string
          severity: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          organization_id: string
          resolved_at?: string | null
          role_1: string
          role_2: string
          rule_triggered: string
          severity?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          resolved_at?: string | null
          role_1?: string
          role_2?: string
          rule_triggered?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_convergence_index: {
        Row: {
          alignment_status: string
          conflict_penalty: number
          created_at: string
          dispersion: number
          id: string
          organization_id: string
          score: number
          volatility_divergence: number
        }
        Insert: {
          alignment_status?: string
          conflict_penalty?: number
          created_at?: string
          dispersion?: number
          id?: string
          organization_id: string
          score?: number
          volatility_divergence?: number
        }
        Update: {
          alignment_status?: string
          conflict_penalty?: number
          created_at?: string
          dispersion?: number
          id?: string
          organization_id?: string
          score?: number
          volatility_divergence?: number
        }
        Relationships: [
          {
            foreignKeyName: "executive_convergence_index_organization_id_fkey"
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
          escalation_reason: string | null
          escalation_required: boolean
          id: string
          last_notified_at: string | null
          last_updated: string
          organization_id: string
          role_type: string
          score: number
        }
        Insert: {
          components?: Json
          created_at?: string
          escalation_reason?: string | null
          escalation_required?: boolean
          id?: string
          last_notified_at?: string | null
          last_updated?: string
          organization_id: string
          role_type: string
          score?: number
        }
        Update: {
          components?: Json
          created_at?: string
          escalation_reason?: string | null
          escalation_required?: boolean
          id?: string
          last_notified_at?: string | null
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
      external_signals: {
        Row: {
          data: Json
          expires_at: string | null
          fetched_at: string
          id: string
          organization_id: string
          relevance_score: number | null
          signal_type: string
          source: string
        }
        Insert: {
          data?: Json
          expires_at?: string | null
          fetched_at?: string
          id?: string
          organization_id: string
          relevance_score?: number | null
          signal_type: string
          source: string
        }
        Update: {
          data?: Json
          expires_at?: string | null
          fetched_at?: string
          id?: string
          organization_id?: string
          relevance_score?: number | null
          signal_type?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_signals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_results: {
        Row: {
          confidence_interval: number | null
          created_by: string
          forecast_horizon_months: number
          generated_at: string
          id: string
          mape: number | null
          metric_type: string
          model_used: string
          organization_id: string
          predictions: Json
          seasonality_detected: boolean | null
          trend_direction: string | null
        }
        Insert: {
          confidence_interval?: number | null
          created_by: string
          forecast_horizon_months?: number
          generated_at?: string
          id?: string
          mape?: number | null
          metric_type: string
          model_used?: string
          organization_id: string
          predictions?: Json
          seasonality_detected?: boolean | null
          trend_direction?: string | null
        }
        Update: {
          confidence_interval?: number | null
          created_by?: string
          forecast_horizon_months?: number
          generated_at?: string
          id?: string
          mape?: number | null
          metric_type?: string
          model_used?: string
          organization_id?: string
          predictions?: Json
          seasonality_detected?: boolean | null
          trend_direction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_benchmarks: {
        Row: {
          created_at: string
          id: string
          industry: string
          metric_type: string
          p10: number
          p25: number
          p50: number
          p75: number
          p90: number
          region: string | null
          revenue_band: string | null
          sample_size: number
          size_band: string | null
          source: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          industry: string
          metric_type: string
          p10?: number
          p25?: number
          p50?: number
          p75?: number
          p90?: number
          region?: string | null
          revenue_band?: string | null
          sample_size?: number
          size_band?: string | null
          source?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string
          metric_type?: string
          p10?: number
          p25?: number
          p50?: number
          p75?: number
          p90?: number
          region?: string | null
          revenue_band?: string | null
          sample_size?: number
          size_band?: string | null
          source?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      insights: {
        Row: {
          capped_confidence: number | null
          category: string | null
          confidence_cap_reason: string | null
          confidence_score: number | null
          created_at: string
          data_quality_index: number | null
          dataset_id: string | null
          generation_model: string | null
          id: string
          is_read: boolean
          message: string
          organization_id: string
          raw_confidence: number | null
          sample_size: number | null
          severity: string
          source_kpi_id: string | null
          source_metric_ids: Json | null
          variance_score: number | null
        }
        Insert: {
          capped_confidence?: number | null
          category?: string | null
          confidence_cap_reason?: string | null
          confidence_score?: number | null
          created_at?: string
          data_quality_index?: number | null
          dataset_id?: string | null
          generation_model?: string | null
          id?: string
          is_read?: boolean
          message: string
          organization_id: string
          raw_confidence?: number | null
          sample_size?: number | null
          severity?: string
          source_kpi_id?: string | null
          source_metric_ids?: Json | null
          variance_score?: number | null
        }
        Update: {
          capped_confidence?: number | null
          category?: string | null
          confidence_cap_reason?: string | null
          confidence_score?: number | null
          created_at?: string
          data_quality_index?: number | null
          dataset_id?: string | null
          generation_model?: string | null
          id?: string
          is_read?: boolean
          message?: string
          organization_id?: string
          raw_confidence?: number | null
          sample_size?: number | null
          severity?: string
          source_kpi_id?: string | null
          source_metric_ids?: Json | null
          variance_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_audit_trail: {
        Row: {
          confidence_score: number | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          input_data: Json | null
          model_used: string | null
          organization_id: string
          output_data: Json | null
          processing_time_ms: number | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          input_data?: Json | null
          model_used?: string | null
          organization_id: string
          output_data?: Json | null
          processing_time_ms?: number | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          input_data?: Json | null
          model_used?: string | null
          organization_id?: string
          output_data?: Json | null
          processing_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_audit_trail_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      key_results: {
        Row: {
          created_at: string
          current_value: number
          id: string
          kpi_id: string | null
          metric_type: string | null
          objective_id: string
          organization_id: string
          status: string
          target_value: number
          title: string
          unit: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          kpi_id?: string | null
          metric_type?: string | null
          objective_id: string
          organization_id: string
          status?: string
          target_value?: number
          title: string
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          kpi_id?: string | null
          metric_type?: string | null
          objective_id?: string
          organization_id?: string
          status?: string
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "key_results_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_organization_id_fkey"
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
      kpi_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          industry: string
          kpis: Json
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          industry: string
          kpis?: Json
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string
          kpis?: Json
          name?: string
        }
        Relationships: []
      }
      kpi_values: {
        Row: {
          computation_version: number | null
          computed_at: string
          date: string
          formula_snapshot: string | null
          id: string
          input_metric_ids: Json | null
          kpi_id: string
          organization_id: string
          value: number
        }
        Insert: {
          computation_version?: number | null
          computed_at?: string
          date: string
          formula_snapshot?: string | null
          id?: string
          input_metric_ids?: Json | null
          kpi_id: string
          organization_id: string
          value: number
        }
        Update: {
          computation_version?: number | null
          computed_at?: string
          date?: string
          formula_snapshot?: string | null
          id?: string
          input_metric_ids?: Json | null
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
      metric_aggregates: {
        Row: {
          agg_avg: number | null
          agg_count: number
          agg_max: number | null
          agg_min: number | null
          agg_sum: number
          computed_at: string
          dataset_id: string | null
          id: string
          metric_type: string
          organization_id: string
          period_start: string
          period_type: string
          region: string
          segment: string
        }
        Insert: {
          agg_avg?: number | null
          agg_count?: number
          agg_max?: number | null
          agg_min?: number | null
          agg_sum?: number
          computed_at?: string
          dataset_id?: string | null
          id?: string
          metric_type: string
          organization_id: string
          period_start: string
          period_type?: string
          region?: string
          segment?: string
        }
        Update: {
          agg_avg?: number | null
          agg_count?: number
          agg_max?: number | null
          agg_min?: number | null
          agg_sum?: number
          computed_at?: string
          dataset_id?: string | null
          id?: string
          metric_type?: string
          organization_id?: string
          period_start?: string
          period_type?: string
          region?: string
          segment?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_aggregates_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_aggregates_organization_id_fkey"
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
          ingested_at: string
          metric_type: string
          organization_id: string
          quality_score: number | null
          region: string
          segment: string
          source_id: string
          source_type: string
          value: number
        }
        Insert: {
          created_at?: string
          dataset_id?: string | null
          date: string
          id?: string
          ingested_at?: string
          metric_type: string
          organization_id: string
          quality_score?: number | null
          region?: string
          segment?: string
          source_id?: string
          source_type?: string
          value: number
        }
        Update: {
          created_at?: string
          dataset_id?: string | null
          date?: string
          id?: string
          ingested_at?: string
          metric_type?: string
          organization_id?: string
          quality_score?: number | null
          region?: string
          segment?: string
          source_id?: string
          source_type?: string
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
      nlq_queries: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          interpreted_intent: Json | null
          organization_id: string
          query_text: string
          results: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          interpreted_intent?: Json | null
          organization_id: string
          query_text: string
          results?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          interpreted_intent?: Json | null
          organization_id?: string
          query_text?: string
          results?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nlq_queries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          organization_id: string
          recipients: string[]
          role_type: string
          status: string
          subject: string
          week_start: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          recipients?: string[]
          role_type: string
          status?: string
          subject: string
          week_start?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          recipients?: string[]
          role_type?: string
          status?: string
          subject?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          alert_threshold: number
          created_at: string
          email_enabled: boolean
          email_recipients: string[]
          escalation_threshold: number
          id: string
          organization_id: string
          role_type: string
          slack_enabled: boolean
          slack_webhook_url: string | null
          updated_at: string
          weekly_brief_enabled: boolean
        }
        Insert: {
          alert_threshold?: number
          created_at?: string
          email_enabled?: boolean
          email_recipients?: string[]
          escalation_threshold?: number
          id?: string
          organization_id: string
          role_type: string
          slack_enabled?: boolean
          slack_webhook_url?: string | null
          updated_at?: string
          weekly_brief_enabled?: boolean
        }
        Update: {
          alert_threshold?: number
          created_at?: string
          email_enabled?: boolean
          email_recipients?: string[]
          escalation_threshold?: number
          id?: string
          organization_id?: string
          role_type?: string
          slack_enabled?: boolean
          slack_webhook_url?: string | null
          updated_at?: string
          weekly_brief_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string
          description: string | null
          id: string
          organization_id: string
          owner_id: string
          parent_id: string | null
          progress: number
          status: string
          time_period: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          owner_id: string
          parent_id?: string | null
          progress?: number
          status?: string
          time_period?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          owner_id?: string
          parent_id?: string | null
          progress?: number
          status?: string
          time_period?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestration_runs: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          organization_id: string
          started_at: string
          status: string
          steps_completed: Json | null
          trigger_type: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          organization_id: string
          started_at?: string
          status?: string
          steps_completed?: Json | null
          trigger_type?: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          organization_id?: string
          started_at?: string
          status?: string
          steps_completed?: Json | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "orchestration_runs_organization_id_fkey"
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
          ai_raw_text_enabled: boolean
          created_at: string
          created_by: string | null
          data_retention_days: number
          id: string
          industry: string | null
          name: string
          onboarding_completed: boolean
          revenue_band: string | null
          size_band: string | null
        }
        Insert: {
          ai_raw_text_enabled?: boolean
          created_at?: string
          created_by?: string | null
          data_retention_days?: number
          id?: string
          industry?: string | null
          name: string
          onboarding_completed?: boolean
          revenue_band?: string | null
          size_band?: string | null
        }
        Update: {
          ai_raw_text_enabled?: boolean
          created_at?: string
          created_by?: string | null
          data_retention_days?: number
          id?: string
          industry?: string | null
          name?: string
          onboarding_completed?: boolean
          revenue_band?: string | null
          size_band?: string | null
        }
        Relationships: []
      }
      pipeline_runs: {
        Row: {
          aggregated_count: number | null
          completed_at: string | null
          dataset_id: string
          duration_ms: number | null
          error_count: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          organization_id: string
          raw_count: number | null
          run_type: string
          stage: string
          started_at: string
          status: string
          transformed_count: number | null
        }
        Insert: {
          aggregated_count?: number | null
          completed_at?: string | null
          dataset_id: string
          duration_ms?: number | null
          error_count?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          raw_count?: number | null
          run_type?: string
          stage?: string
          started_at?: string
          status?: string
          transformed_count?: number | null
        }
        Update: {
          aggregated_count?: number | null
          completed_at?: string | null
          dataset_id?: string
          duration_ms?: number | null
          error_count?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          raw_count?: number | null
          run_type?: string
          stage?: string
          started_at?: string
          status?: string
          transformed_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_runs_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_executions: {
        Row: {
          completed_at: string | null
          execution_log: Json
          id: string
          organization_id: string
          playbook_id: string
          started_at: string
          status: string
          steps_completed: number
          total_steps: number
          trigger_value: number | null
        }
        Insert: {
          completed_at?: string | null
          execution_log?: Json
          id?: string
          organization_id: string
          playbook_id: string
          started_at?: string
          status?: string
          steps_completed?: number
          total_steps?: number
          trigger_value?: number | null
        }
        Update: {
          completed_at?: string | null
          execution_log?: Json
          id?: string
          organization_id?: string
          playbook_id?: string
          started_at?: string
          status?: string
          steps_completed?: number
          total_steps?: number
          trigger_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_executions_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "alert_playbooks"
            referencedColumns: ["id"]
          },
        ]
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
      project_datasets: {
        Row: {
          added_by: string
          created_at: string
          dataset_id: string
          id: string
          project_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          dataset_id: string
          id?: string
          project_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          dataset_id?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_datasets_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          active_dataset_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          active_dataset_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          active_dataset_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_active_dataset_fkey"
            columns: ["active_dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_active_dataset_id_fkey"
            columns: ["active_dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_records: {
        Row: {
          dataset_id: string
          dataset_version_id: string | null
          id: string
          ingested_at: string
          organization_id: string
          raw_data: Json
          row_index: number
          transform_error: string | null
          transform_status: string
          transformed_at: string | null
        }
        Insert: {
          dataset_id: string
          dataset_version_id?: string | null
          id?: string
          ingested_at?: string
          organization_id: string
          raw_data?: Json
          row_index: number
          transform_error?: string | null
          transform_status?: string
          transformed_at?: string | null
        }
        Update: {
          dataset_id?: string
          dataset_version_id?: string | null
          id?: string
          ingested_at?: string
          organization_id?: string
          raw_data?: Json
          row_index?: number
          transform_error?: string | null
          transform_status?: string
          transformed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_records_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_records_dataset_version_id_fkey"
            columns: ["dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_records_organization_id_fkey"
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
      scenario_branches: {
        Row: {
          comparison_group_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          parameters: Json
          results: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          comparison_group_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          parameters?: Json
          results?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          comparison_group_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          parameters?: Json
          results?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      simulation_results: {
        Row: {
          capped_confidence: number | null
          confidence_cap_reason: string | null
          created_at: string
          created_by: string | null
          data_sufficiency: string
          expected_value: number
          forecast_horizon: number
          id: string
          mean_growth_rate: number | null
          median_value: number
          metric_type: string
          organization_id: string
          p10_value: number
          p25_value: number
          p75_value: number
          p90_value: number
          probability_negative: number
          raw_confidence: number | null
          sample_size: number
          simulation_runs: number
          value_at_risk_95: number | null
          variance_score: number | null
          volatility: number | null
        }
        Insert: {
          capped_confidence?: number | null
          confidence_cap_reason?: string | null
          created_at?: string
          created_by?: string | null
          data_sufficiency?: string
          expected_value: number
          forecast_horizon?: number
          id?: string
          mean_growth_rate?: number | null
          median_value: number
          metric_type: string
          organization_id: string
          p10_value: number
          p25_value: number
          p75_value: number
          p90_value: number
          probability_negative?: number
          raw_confidence?: number | null
          sample_size?: number
          simulation_runs?: number
          value_at_risk_95?: number | null
          variance_score?: number | null
          volatility?: number | null
        }
        Update: {
          capped_confidence?: number | null
          confidence_cap_reason?: string | null
          created_at?: string
          created_by?: string | null
          data_sufficiency?: string
          expected_value?: number
          forecast_horizon?: number
          id?: string
          mean_growth_rate?: number | null
          median_value?: number
          metric_type?: string
          organization_id?: string
          p10_value?: number
          p25_value?: number
          p75_value?: number
          p90_value?: number
          probability_negative?: number
          raw_confidence?: number | null
          sample_size?: number
          simulation_runs?: number
          value_at_risk_95?: number | null
          variance_score?: number | null
          volatility?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_usage: {
        Row: {
          call_count: number
          date: string
          id: string
          organization_id: string
        }
        Insert: {
          call_count?: number
          date?: string
          id?: string
          organization_id: string
        }
        Update: {
          call_count?: number
          date?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_usage_organization_id_fkey"
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
          is_trial: boolean
          organization_id: string
          price_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tier: string
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_trial?: boolean
          organization_id: string
          price_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tier?: string
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_trial?: boolean
          organization_id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          tier?: string
          trial_end?: string | null
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
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metering: {
        Row: {
          id: string
          metric_name: string
          metric_value: number
          organization_id: string
          period_date: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          metric_name: string
          metric_value?: number
          organization_id: string
          period_date?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          metric_name?: string
          metric_value?: number
          organization_id?: string
          period_date?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_metering_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_metering_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      workspace_members: {
        Row: {
          added_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          added_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_quotas: {
        Row: {
          created_at: string
          id: string
          max_api_calls_per_day: number
          max_copilot_queries_per_day: number
          max_datasets: number
          max_rows_per_day: number
          max_simulations_per_day: number
          max_team_seats: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_api_calls_per_day?: number
          max_copilot_queries_per_day?: number
          max_datasets?: number
          max_rows_per_day?: number
          max_simulations_per_day?: number
          max_team_seats?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_api_calls_per_day?: number
          max_copilot_queries_per_day?: number
          max_datasets?: number
          max_rows_per_day?: number
          max_simulations_per_day?: number
          max_team_seats?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_quotas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: Json }
      check_workspace_quota: {
        Args: { _metric_name: string; _workspace_id: string }
        Returns: Json
      }
      cleanup_old_copilot_messages: { Args: never; Returns: undefined }
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
      immutable_date_trunc_hour: { Args: { ts: string }; Returns: string }
      increment_convergence_usage: {
        Args: { _org_id: string }
        Returns: undefined
      }
      increment_copilot_usage: { Args: { _org_id: string }; Returns: undefined }
      increment_simulation_usage: {
        Args: { _org_id: string }
        Returns: undefined
      }
      increment_workspace_usage: {
        Args: {
          _increment?: number
          _metric_name: string
          _org_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      update_dataset_staleness: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "analyst" | "executive" | "client_viewer"
      org_role: "owner" | "admin" | "analyst" | "executive" | "viewer"
      workspace_role:
        | "workspace_admin"
        | "workspace_editor"
        | "workspace_viewer"
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
      workspace_role: [
        "workspace_admin",
        "workspace_editor",
        "workspace_viewer",
      ],
    },
  },
} as const
