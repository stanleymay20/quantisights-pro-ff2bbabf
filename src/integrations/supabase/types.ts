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
      ab_experiments: {
        Row: {
          alpha: number
          control_group_filter: Json | null
          created_at: string
          created_by: string
          dataset_id: string | null
          description: string | null
          ended_at: string | null
          hypothesis: string | null
          id: string
          minimum_detectable_effect: number | null
          name: string
          organization_id: string
          primary_metric: string
          results: Json | null
          secondary_metrics: string[] | null
          started_at: string | null
          status: string
          target_sample_size: number | null
          treatment_group_filter: Json | null
          updated_at: string
        }
        Insert: {
          alpha?: number
          control_group_filter?: Json | null
          created_at?: string
          created_by: string
          dataset_id?: string | null
          description?: string | null
          ended_at?: string | null
          hypothesis?: string | null
          id?: string
          minimum_detectable_effect?: number | null
          name: string
          organization_id: string
          primary_metric: string
          results?: Json | null
          secondary_metrics?: string[] | null
          started_at?: string | null
          status?: string
          target_sample_size?: number | null
          treatment_group_filter?: Json | null
          updated_at?: string
        }
        Update: {
          alpha?: number
          control_group_filter?: Json | null
          created_at?: string
          created_by?: string
          dataset_id?: string | null
          description?: string | null
          ended_at?: string | null
          hypothesis?: string | null
          id?: string
          minimum_detectable_effect?: number | null
          name?: string
          organization_id?: string
          primary_metric?: string
          results?: Json | null
          secondary_metrics?: string[] | null
          started_at?: string | null
          status?: string
          target_sample_size?: number | null
          treatment_group_filter?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_experiments_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_experiments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          dataset_id: string | null
          decision_context_id: string | null
          detection_model: string | null
          deviation_score: number | null
          ewma_baseline: number | null
          ewma_std: number | null
          expected_impact: string | null
          generation_version: number | null
          id: string
          impact_score: number | null
          insight_object: Json | null
          kpi_affected: Json | null
          model_parameters: Json | null
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
          z_score: number | null
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
          dataset_id?: string | null
          decision_context_id?: string | null
          detection_model?: string | null
          deviation_score?: number | null
          ewma_baseline?: number | null
          ewma_std?: number | null
          expected_impact?: string | null
          generation_version?: number | null
          id?: string
          impact_score?: number | null
          insight_object?: Json | null
          kpi_affected?: Json | null
          model_parameters?: Json | null
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
          z_score?: number | null
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
          dataset_id?: string | null
          decision_context_id?: string | null
          detection_model?: string | null
          deviation_score?: number | null
          ewma_baseline?: number | null
          ewma_std?: number | null
          expected_impact?: string | null
          generation_version?: number | null
          id?: string
          impact_score?: number | null
          insight_object?: Json | null
          kpi_affected?: Json | null
          model_parameters?: Json | null
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
          z_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "advisory_instances_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisory_instances_decision_context_id_fkey"
            columns: ["decision_context_id"]
            isOneToOne: false
            referencedRelation: "decision_contexts"
            referencedColumns: ["id"]
          },
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
      analytics_compute_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          dataset_id: string | null
          error_message: string | null
          id: string
          job_type: string
          organization_id: string
          parameters: Json | null
          priority: number
          result: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          organization_id: string
          parameters?: Json | null
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          organization_id?: string
          parameters?: Json | null
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_compute_jobs_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_compute_jobs_organization_id_fkey"
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
      auth_events: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string | null
          risk_score: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          risk_score?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          risk_score?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_events_organization_id_fkey"
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
      cohort_definitions: {
        Row: {
          activity_field: string
          cached_results: Json | null
          cohort_field: string
          created_at: string
          created_by: string
          dataset_id: string | null
          description: string | null
          entity_field: string
          filters: Json | null
          id: string
          last_computed_at: string | null
          name: string
          organization_id: string
          period_type: string
          updated_at: string
        }
        Insert: {
          activity_field: string
          cached_results?: Json | null
          cohort_field: string
          created_at?: string
          created_by: string
          dataset_id?: string | null
          description?: string | null
          entity_field?: string
          filters?: Json | null
          id?: string
          last_computed_at?: string | null
          name: string
          organization_id: string
          period_type?: string
          updated_at?: string
        }
        Update: {
          activity_field?: string
          cached_results?: Json | null
          cohort_field?: string
          created_at?: string
          created_by?: string
          dataset_id?: string | null
          description?: string | null
          entity_field?: string
          filters?: Json | null
          id?: string
          last_computed_at?: string | null
          name?: string
          organization_id?: string
          period_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_definitions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_configs: {
        Row: {
          connection_status: string | null
          connector_type: string
          created_at: string
          credential_vault_key: string | null
          data_source_id: string | null
          database_name: string | null
          discovered_schema: Json | null
          host: string | null
          id: string
          last_tested_at: string | null
          organization_id: string
          port: number | null
          schema_name: string | null
          selected_tables: Json | null
          ssl_mode: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          connection_status?: string | null
          connector_type?: string
          created_at?: string
          credential_vault_key?: string | null
          data_source_id?: string | null
          database_name?: string | null
          discovered_schema?: Json | null
          host?: string | null
          id?: string
          last_tested_at?: string | null
          organization_id: string
          port?: number | null
          schema_name?: string | null
          selected_tables?: Json | null
          ssl_mode?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          connection_status?: string | null
          connector_type?: string
          created_at?: string
          credential_vault_key?: string | null
          data_source_id?: string | null
          database_name?: string | null
          discovered_schema?: Json | null
          host?: string | null
          id?: string
          last_tested_at?: string | null
          organization_id?: string
          port?: number | null
          schema_name?: string | null
          selected_tables?: Json | null
          ssl_mode?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connector_configs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_configs_organization_id_fkey"
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
      cron_run_log: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          job_name: string
          metadata: Json | null
          records_processed: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_name: string
          metadata?: Json | null
          records_processed?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_name?: string
          metadata?: Json | null
          records_processed?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      data_lineage: {
        Row: {
          confidence_impact: number | null
          created_at: string
          id: string
          organization_id: string
          source_id: string
          source_name: string | null
          source_type: string
          target_id: string
          target_name: string | null
          target_type: string
          transformation: string | null
          transformation_details: Json | null
        }
        Insert: {
          confidence_impact?: number | null
          created_at?: string
          id?: string
          organization_id: string
          source_id: string
          source_name?: string | null
          source_type: string
          target_id: string
          target_name?: string | null
          target_type: string
          transformation?: string | null
          transformation_details?: Json | null
        }
        Update: {
          confidence_impact?: number | null
          created_at?: string
          id?: string
          organization_id?: string
          source_id?: string
          source_name?: string | null
          source_type?: string
          target_id?: string
          target_name?: string | null
          target_type?: string
          transformation?: string | null
          transformation_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "data_lineage_organization_id_fkey"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "data_quality_checks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_policies: {
        Row: {
          auto_cleanup: boolean
          created_at: string
          data_category: string
          description: string | null
          enforcement_status: string
          id: string
          last_cleanup_at: string | null
          next_scheduled_at: string | null
          organization_id: string
          retention_days: number
          updated_at: string
        }
        Insert: {
          auto_cleanup?: boolean
          created_at?: string
          data_category: string
          description?: string | null
          enforcement_status?: string
          id?: string
          last_cleanup_at?: string | null
          next_scheduled_at?: string | null
          organization_id: string
          retention_days?: number
          updated_at?: string
        }
        Update: {
          auto_cleanup?: boolean
          created_at?: string
          data_category?: string
          description?: string | null
          enforcement_status?: string
          id?: string
          last_cleanup_at?: string | null
          next_scheduled_at?: string | null
          organization_id?: string
          retention_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_retention_policies_organization_id_fkey"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "dataset_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          owner_user_id: string | null
          row_count: number | null
          status: string
          steward_user_id: string | null
          uploaded_by: string
          workspace_id: string | null
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
          owner_user_id?: string | null
          row_count?: number | null
          status?: string
          steward_user_id?: string | null
          uploaded_by: string
          workspace_id?: string | null
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
          owner_user_id?: string | null
          row_count?: number | null
          status?: string
          steward_user_id?: string | null
          uploaded_by?: string
          workspace_id?: string | null
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
          {
            foreignKeyName: "datasets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      decision_contexts: {
        Row: {
          created_at: string
          created_by: string | null
          datasets: Json | null
          decision_type: string
          description: string | null
          id: string
          industry: string | null
          name: string
          objective: string | null
          organization_id: string
          status: string
          target_metrics: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          datasets?: Json | null
          decision_type?: string
          description?: string | null
          id?: string
          industry?: string | null
          name: string
          objective?: string | null
          organization_id: string
          status?: string
          target_metrics?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          datasets?: Json | null
          decision_type?: string
          description?: string | null
          id?: string
          industry?: string | null
          name?: string
          objective?: string | null
          organization_id?: string
          status?: string
          target_metrics?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_contexts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_embeddings: {
        Row: {
          content_text: string
          created_at: string
          embedding: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          content_text: string
          created_at?: string
          embedding: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          content_text?: string
          created_at?: string
          embedding?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_embeddings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          causal_attribution_score: number | null
          chosen_action: string | null
          confidence_at_decision: number | null
          confidence_cap_reason: string | null
          confidence_updated: number | null
          counterfactual_analysis_id: string | null
          counterfactual_delta: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_context_id: string | null
          decision_origin: string
          decision_simulation_id: string | null
          decision_status: string
          decision_type: string
          execution_completed_at: string | null
          execution_started_at: string | null
          execution_status: string
          expected_value_at_decision: number | null
          explanation_metadata: Json | null
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
          recommendation_logic_type: string | null
          recommended_action: string
          simulation_id: string | null
          source_insight_summary: string | null
          updated_at: string
        }
        Insert: {
          actual_value?: number | null
          advisory_instance_id?: string | null
          baseline_value?: number | null
          calibration_error?: number | null
          capped_confidence?: number | null
          causal_attribution_score?: number | null
          chosen_action?: string | null
          confidence_at_decision?: number | null
          confidence_cap_reason?: string | null
          confidence_updated?: number | null
          counterfactual_analysis_id?: string | null
          counterfactual_delta?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_context_id?: string | null
          decision_origin?: string
          decision_simulation_id?: string | null
          decision_status?: string
          decision_type?: string
          execution_completed_at?: string | null
          execution_started_at?: string | null
          execution_status?: string
          expected_value_at_decision?: number | null
          explanation_metadata?: Json | null
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
          recommendation_logic_type?: string | null
          recommended_action: string
          simulation_id?: string | null
          source_insight_summary?: string | null
          updated_at?: string
        }
        Update: {
          actual_value?: number | null
          advisory_instance_id?: string | null
          baseline_value?: number | null
          calibration_error?: number | null
          capped_confidence?: number | null
          causal_attribution_score?: number | null
          chosen_action?: string | null
          confidence_at_decision?: number | null
          confidence_cap_reason?: string | null
          confidence_updated?: number | null
          counterfactual_analysis_id?: string | null
          counterfactual_delta?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_context_id?: string | null
          decision_origin?: string
          decision_simulation_id?: string | null
          decision_status?: string
          decision_type?: string
          execution_completed_at?: string | null
          execution_started_at?: string | null
          execution_status?: string
          expected_value_at_decision?: number | null
          explanation_metadata?: Json | null
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
          recommendation_logic_type?: string | null
          recommended_action?: string
          simulation_id?: string | null
          source_insight_summary?: string | null
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
            foreignKeyName: "decision_ledger_counterfactual_analysis_id_fkey"
            columns: ["counterfactual_analysis_id"]
            isOneToOne: false
            referencedRelation: "counterfactual_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_ledger_decision_context_id_fkey"
            columns: ["decision_context_id"]
            isOneToOne: false
            referencedRelation: "decision_contexts"
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
      decision_outcomes: {
        Row: {
          accuracy_score: number | null
          created_at: string
          dataset_id: string | null
          decision_id: string
          evaluation_date: string | null
          evaluation_window_days: number
          expected_change: number | null
          expected_direction: string
          expected_metric: string
          id: string
          notes: string | null
          observed_metric: string | null
          observed_value_after: number | null
          observed_value_before: number | null
          organization_id: string
          outcome_status: string
          updated_at: string
        }
        Insert: {
          accuracy_score?: number | null
          created_at?: string
          dataset_id?: string | null
          decision_id: string
          evaluation_date?: string | null
          evaluation_window_days?: number
          expected_change?: number | null
          expected_direction?: string
          expected_metric: string
          id?: string
          notes?: string | null
          observed_metric?: string | null
          observed_value_after?: number | null
          observed_value_before?: number | null
          organization_id: string
          outcome_status?: string
          updated_at?: string
        }
        Update: {
          accuracy_score?: number | null
          created_at?: string
          dataset_id?: string | null
          decision_id?: string
          evaluation_date?: string | null
          evaluation_window_days?: number
          expected_change?: number | null
          expected_direction?: string
          expected_metric?: string
          id?: string
          notes?: string | null
          observed_metric?: string | null
          observed_value_after?: number | null
          observed_value_before?: number | null
          organization_id?: string
          outcome_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_outcomes_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_outcomes_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_outcomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_replays: {
        Row: {
          confidence_drift: number | null
          created_at: string
          current_data_summary: Json | null
          decision_id: string
          id: string
          organization_id: string
          original_confidence: number | null
          original_recommendation: string | null
          recommendation_changed: boolean | null
          replay_narrative: string | null
          replayed_by: string
          replayed_confidence: number | null
          replayed_recommendation: string | null
        }
        Insert: {
          confidence_drift?: number | null
          created_at?: string
          current_data_summary?: Json | null
          decision_id: string
          id?: string
          organization_id: string
          original_confidence?: number | null
          original_recommendation?: string | null
          recommendation_changed?: boolean | null
          replay_narrative?: string | null
          replayed_by: string
          replayed_confidence?: number | null
          replayed_recommendation?: string | null
        }
        Update: {
          confidence_drift?: number | null
          created_at?: string
          current_data_summary?: Json | null
          decision_id?: string
          id?: string
          organization_id?: string
          original_confidence?: number | null
          original_recommendation?: string | null
          recommendation_changed?: boolean | null
          replay_narrative?: string | null
          replayed_by?: string
          replayed_confidence?: number | null
          replayed_recommendation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_replays_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_replays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_rules: {
        Row: {
          actions: Json
          condition_type: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          hit_policy: string
          id: string
          is_active: boolean
          is_shadow: boolean
          name: string
          organization_id: string
          priority: number
          updated_at: string
          version: number
        }
        Insert: {
          actions?: Json
          condition_type?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          hit_policy?: string
          id?: string
          is_active?: boolean
          is_shadow?: boolean
          name: string
          organization_id: string
          priority?: number
          updated_at?: string
          version?: number
        }
        Update: {
          actions?: Json
          condition_type?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          hit_policy?: string
          id?: string
          is_active?: boolean
          is_shadow?: boolean
          name?: string
          organization_id?: string
          priority?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "decision_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_shadow_log: {
        Row: {
          advisory_instance_id: string | null
          created_at: string
          discrepancy_detected: boolean
          id: string
          organization_id: string
          production_decision_id: string | null
          rule_id: string
          rule_version: number
          shadow_decision: Json
          would_have_created: boolean
        }
        Insert: {
          advisory_instance_id?: string | null
          created_at?: string
          discrepancy_detected?: boolean
          id?: string
          organization_id: string
          production_decision_id?: string | null
          rule_id: string
          rule_version: number
          shadow_decision?: Json
          would_have_created?: boolean
        }
        Update: {
          advisory_instance_id?: string | null
          created_at?: string
          discrepancy_detected?: boolean
          id?: string
          organization_id?: string
          production_decision_id?: string | null
          rule_id?: string
          rule_version?: number
          shadow_decision?: Json
          would_have_created?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "decision_shadow_log_advisory_instance_id_fkey"
            columns: ["advisory_instance_id"]
            isOneToOne: false
            referencedRelation: "advisory_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_shadow_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_shadow_log_production_decision_id_fkey"
            columns: ["production_decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_shadow_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "decision_rules"
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
      embed_tokens: {
        Row: {
          allowed_metrics: Json | null
          created_at: string | null
          created_by: string
          dashboard_type: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          token: string
        }
        Insert: {
          allowed_metrics?: Json | null
          created_at?: string | null
          created_by: string
          dashboard_type?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          token?: string
        }
        Update: {
          allowed_metrics?: Json | null
          created_at?: string | null
          created_by?: string
          dashboard_type?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "embed_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          execution_plan_id: string
          id: string
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          execution_plan_id: string
          id?: string
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          execution_plan_id?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_events_execution_plan_id_fkey"
            columns: ["execution_plan_id"]
            isOneToOne: false
            referencedRelation: "execution_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_interventions: {
        Row: {
          auto_triggered: boolean
          corrective_action: string | null
          created_at: string
          escalated_to: string | null
          execution_plan_id: string
          id: string
          intervention_type: string
          new_owner: string | null
          organization_id: string
          previous_owner: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          trigger_reason: string
          updated_at: string
        }
        Insert: {
          auto_triggered?: boolean
          corrective_action?: string | null
          created_at?: string
          escalated_to?: string | null
          execution_plan_id: string
          id?: string
          intervention_type?: string
          new_owner?: string | null
          organization_id: string
          previous_owner?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          trigger_reason: string
          updated_at?: string
        }
        Update: {
          auto_triggered?: boolean
          corrective_action?: string | null
          created_at?: string
          escalated_to?: string | null
          execution_plan_id?: string
          id?: string
          intervention_type?: string
          new_owner?: string | null
          organization_id?: string
          previous_owner?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          trigger_reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_interventions_execution_plan_id_fkey"
            columns: ["execution_plan_id"]
            isOneToOne: false
            referencedRelation: "execution_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_interventions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_overrides: {
        Row: {
          actor_id: string
          created_at: string
          execution_plan_id: string
          id: string
          new_state: Json
          organization_id: string
          override_type: string
          previous_state: Json
          reason: string
          requires_step_up: boolean | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          execution_plan_id: string
          id?: string
          new_state: Json
          organization_id: string
          override_type: string
          previous_state: Json
          reason: string
          requires_step_up?: boolean | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          execution_plan_id?: string
          id?: string
          new_state?: Json
          organization_id?: string
          override_type?: string
          previous_state?: Json
          reason?: string
          requires_step_up?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_overrides_execution_plan_id_fkey"
            columns: ["execution_plan_id"]
            isOneToOne: false
            referencedRelation: "execution_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_plans: {
        Row: {
          action_description: string | null
          action_title: string
          blocked_by_plan_id: string | null
          created_at: string
          deadline: string | null
          decision_id: string
          dependency_type: string | null
          id: string
          is_critical_path: boolean | null
          organization_id: string
          owner_user_id: string | null
          priority: string
          status: string
          trigger_config: Json | null
          trigger_type: string | null
          unlocks_plan_ids: string[] | null
          updated_at: string
        }
        Insert: {
          action_description?: string | null
          action_title: string
          blocked_by_plan_id?: string | null
          created_at?: string
          deadline?: string | null
          decision_id: string
          dependency_type?: string | null
          id?: string
          is_critical_path?: boolean | null
          organization_id: string
          owner_user_id?: string | null
          priority?: string
          status?: string
          trigger_config?: Json | null
          trigger_type?: string | null
          unlocks_plan_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          action_description?: string | null
          action_title?: string
          blocked_by_plan_id?: string | null
          created_at?: string
          deadline?: string | null
          decision_id?: string
          dependency_type?: string | null
          id?: string
          is_critical_path?: boolean | null
          organization_id?: string
          owner_user_id?: string | null
          priority?: string
          status?: string
          trigger_config?: Json | null
          trigger_type?: string | null
          unlocks_plan_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_plans_blocked_by_plan_id_fkey"
            columns: ["blocked_by_plan_id"]
            isOneToOne: false
            referencedRelation: "execution_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_plans_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_predictions: {
        Row: {
          created_at: string
          delay_days_predicted: number | null
          execution_plan_id: string
          feature_summary: Json | null
          generated_at: string
          id: string
          is_active: boolean
          model_version: number | null
          organization_id: string
          predicted_outcome: string
          recommendation: string | null
          risk_factors: Json | null
          risk_score: number
          run_id: string | null
          superseded_at: string | null
          superseded_by_run_id: string | null
        }
        Insert: {
          created_at?: string
          delay_days_predicted?: number | null
          execution_plan_id: string
          feature_summary?: Json | null
          generated_at?: string
          id?: string
          is_active?: boolean
          model_version?: number | null
          organization_id: string
          predicted_outcome?: string
          recommendation?: string | null
          risk_factors?: Json | null
          risk_score?: number
          run_id?: string | null
          superseded_at?: string | null
          superseded_by_run_id?: string | null
        }
        Update: {
          created_at?: string
          delay_days_predicted?: number | null
          execution_plan_id?: string
          feature_summary?: Json | null
          generated_at?: string
          id?: string
          is_active?: boolean
          model_version?: number | null
          organization_id?: string
          predicted_outcome?: string
          recommendation?: string | null
          risk_factors?: Json | null
          risk_score?: number
          run_id?: string | null
          superseded_at?: string | null
          superseded_by_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_predictions_execution_plan_id_fkey"
            columns: ["execution_plan_id"]
            isOneToOne: false
            referencedRelation: "execution_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_run_log: {
        Row: {
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          items_created: number | null
          items_processed: number | null
          metadata: Json | null
          organization_id: string
          run_id: string
          run_type: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          items_created?: number | null
          items_processed?: number | null
          metadata?: Json | null
          organization_id: string
          run_id?: string
          run_type: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          items_created?: number | null
          items_processed?: number | null
          metadata?: Json | null
          organization_id?: string
          run_id?: string
          run_type?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_run_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_scores: {
        Row: {
          avg_delay_days: number | null
          computed_at: string
          computed_by: string | null
          created_at: string
          failure_rate: number | null
          formula_snapshot: string | null
          id: string
          organization_id: string
          plans_evaluated: number | null
          reliability_rate: number | null
          scope_id: string
          scope_type: string
          score: number
          score_explanation: Json | null
          scoring_model_version: number | null
          source_window_days: number | null
          success_rate: number | null
        }
        Insert: {
          avg_delay_days?: number | null
          computed_at?: string
          computed_by?: string | null
          created_at?: string
          failure_rate?: number | null
          formula_snapshot?: string | null
          id?: string
          organization_id: string
          plans_evaluated?: number | null
          reliability_rate?: number | null
          scope_id: string
          scope_type?: string
          score?: number
          score_explanation?: Json | null
          scoring_model_version?: number | null
          source_window_days?: number | null
          success_rate?: number | null
        }
        Update: {
          avg_delay_days?: number | null
          computed_at?: string
          computed_by?: string | null
          created_at?: string
          failure_rate?: number | null
          formula_snapshot?: string | null
          id?: string
          organization_id?: string
          plans_evaluated?: number | null
          reliability_rate?: number | null
          scope_id?: string
          scope_type?: string
          score?: number
          score_explanation?: Json | null
          scoring_model_version?: number | null
          source_window_days?: number | null
          success_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_scores_organization_id_fkey"
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
          dataset_id: string | null
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
          dataset_id?: string | null
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
          dataset_id?: string | null
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
            foreignKeyName: "external_signals_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_signals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fairness_assessments: {
        Row: {
          assessment_status: string
          created_at: string
          created_by: string | null
          dataset_id: string | null
          decision_id: string | null
          disparate_impact_ratio: number | null
          group_a_label: string
          group_a_value: number | null
          group_b_label: string
          group_b_value: number | null
          id: string
          metric_name: string
          organization_id: string
          protected_attribute: string
          remediation_notes: string | null
          statistical_parity_diff: number | null
        }
        Insert: {
          assessment_status?: string
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          decision_id?: string | null
          disparate_impact_ratio?: number | null
          group_a_label: string
          group_a_value?: number | null
          group_b_label: string
          group_b_value?: number | null
          id?: string
          metric_name: string
          organization_id: string
          protected_attribute: string
          remediation_notes?: string | null
          statistical_parity_diff?: number | null
        }
        Update: {
          assessment_status?: string
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          decision_id?: string | null
          disparate_impact_ratio?: number | null
          group_a_label?: string
          group_a_value?: number | null
          group_b_label?: string
          group_b_value?: number | null
          id?: string
          metric_name?: string
          organization_id?: string
          protected_attribute?: string
          remediation_notes?: string | null
          statistical_parity_diff?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fairness_assessments_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fairness_assessments_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fairness_assessments_organization_id_fkey"
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
          dataset_id: string | null
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
          dataset_id?: string | null
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
          dataset_id?: string | null
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
            foreignKeyName: "forecast_results_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_maturity_assessments: {
        Row: {
          assessed_by: string
          created_at: string
          dimensions: Json
          id: string
          organization_id: string
          overall_score: number
          recommendations: Json | null
        }
        Insert: {
          assessed_by: string
          created_at?: string
          dimensions?: Json
          id?: string
          organization_id: string
          overall_score?: number
          recommendations?: Json | null
        }
        Update: {
          assessed_by?: string
          created_at?: string
          dimensions?: Json
          id?: string
          organization_id?: string
          overall_score?: number
          recommendations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_maturity_assessments_organization_id_fkey"
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
          decision_context_id: string | null
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
          decision_context_id?: string | null
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
          decision_context_id?: string | null
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
            foreignKeyName: "insights_decision_context_id_fkey"
            columns: ["decision_context_id"]
            isOneToOne: false
            referencedRelation: "decision_contexts"
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
          dataset_id: string | null
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
          dataset_id?: string | null
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
          dataset_id?: string | null
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
            foreignKeyName: "kpis_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "metric_aggregates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_latest: {
        Row: {
          computed_at: string
          dataset_id: string
          latest_date: string
          latest_value: number
          max_value: number | null
          mean_value: number | null
          metric_type: string
          min_value: number | null
          organization_id: string
          stddev_value: number | null
          total_count: number
          total_sum: number
          trend_slope: number | null
        }
        Insert: {
          computed_at?: string
          dataset_id: string
          latest_date: string
          latest_value: number
          max_value?: number | null
          mean_value?: number | null
          metric_type: string
          min_value?: number | null
          organization_id: string
          stddev_value?: number | null
          total_count?: number
          total_sum?: number
          trend_slope?: number | null
        }
        Update: {
          computed_at?: string
          dataset_id?: string
          latest_date?: string
          latest_value?: number
          max_value?: number | null
          mean_value?: number | null
          metric_type?: string
          min_value?: number | null
          organization_id?: string
          stddev_value?: number | null
          total_count?: number
          total_sum?: number
          trend_slope?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metric_latest_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_latest_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_mappings: {
        Row: {
          aggregation: string | null
          created_at: string
          data_source_id: string
          date_column: string | null
          id: string
          is_active: boolean | null
          metric_type: string
          organization_id: string
          region_column: string | null
          segment_column: string | null
          source_column: string
          source_table: string
          transform_expression: string | null
          updated_at: string
        }
        Insert: {
          aggregation?: string | null
          created_at?: string
          data_source_id: string
          date_column?: string | null
          id?: string
          is_active?: boolean | null
          metric_type: string
          organization_id: string
          region_column?: string | null
          segment_column?: string | null
          source_column: string
          source_table: string
          transform_expression?: string | null
          updated_at?: string
        }
        Update: {
          aggregation?: string | null
          created_at?: string
          data_source_id?: string
          date_column?: string | null
          id?: string
          is_active?: boolean | null
          metric_type?: string
          organization_id?: string
          region_column?: string | null
          segment_column?: string | null
          source_column?: string
          source_table?: string
          transform_expression?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_mappings_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_rollups: {
        Row: {
          computed_at: string
          dataset_id: string
          id: string
          metric_type: string
          organization_id: string
          period_start: string
          period_type: string
          region: string | null
          segment: string | null
          val_avg: number | null
          val_count: number
          val_max: number | null
          val_min: number | null
          val_p50: number | null
          val_stddev: number | null
          val_sum: number
        }
        Insert: {
          computed_at?: string
          dataset_id: string
          id?: string
          metric_type: string
          organization_id: string
          period_start: string
          period_type: string
          region?: string | null
          segment?: string | null
          val_avg?: number | null
          val_count?: number
          val_max?: number | null
          val_min?: number | null
          val_p50?: number | null
          val_stddev?: number | null
          val_sum?: number
        }
        Update: {
          computed_at?: string
          dataset_id?: string
          id?: string
          metric_type?: string
          organization_id?: string
          period_start?: string
          period_type?: string
          region?: string | null
          segment?: string | null
          val_avg?: number | null
          val_count?: number
          val_max?: number | null
          val_min?: number | null
          val_p50?: number | null
          val_stddev?: number | null
          val_sum?: number
        }
        Relationships: [
          {
            foreignKeyName: "metric_rollups_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_rollups_organization_id_fkey"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      model_drift_snapshots: {
        Row: {
          baseline_snapshot_id: string | null
          created_at: string
          drift_detected: boolean | null
          drift_score: number | null
          feature_importance: Json | null
          id: string
          model_name: string
          organization_id: string
          prediction_distribution: Json | null
          snapshot_date: string
        }
        Insert: {
          baseline_snapshot_id?: string | null
          created_at?: string
          drift_detected?: boolean | null
          drift_score?: number | null
          feature_importance?: Json | null
          id?: string
          model_name: string
          organization_id: string
          prediction_distribution?: Json | null
          snapshot_date?: string
        }
        Update: {
          baseline_snapshot_id?: string | null
          created_at?: string
          drift_detected?: boolean | null
          drift_score?: number | null
          feature_importance?: Json | null
          id?: string
          model_name?: string
          organization_id?: string
          prediction_distribution?: Json | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_drift_snapshots_baseline_snapshot_id_fkey"
            columns: ["baseline_snapshot_id"]
            isOneToOne: false
            referencedRelation: "model_drift_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_drift_snapshots_organization_id_fkey"
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
      org_branding: {
        Row: {
          accent_color: string | null
          company_name: string | null
          created_at: string | null
          custom_domain: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          organization_id: string
          primary_color: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_domain?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          organization_id: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_domain?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
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
      organizational_identity: {
        Row: {
          competitive_position: string | null
          core_values: Json | null
          created_at: string
          decision_principles: Json | null
          decision_speed_preference: string | null
          ethical_boundaries: Json | null
          governance_model: string | null
          id: string
          industry_context: string | null
          innovation_posture: string | null
          key_stakeholders: Json | null
          market_stage: string | null
          mission_statement: string | null
          organization_id: string
          regulatory_environment: string | null
          risk_appetite: string | null
          stakeholder_orientation: string | null
          strategic_priorities: Json | null
          updated_at: string
          updated_by: string | null
          vision_statement: string | null
        }
        Insert: {
          competitive_position?: string | null
          core_values?: Json | null
          created_at?: string
          decision_principles?: Json | null
          decision_speed_preference?: string | null
          ethical_boundaries?: Json | null
          governance_model?: string | null
          id?: string
          industry_context?: string | null
          innovation_posture?: string | null
          key_stakeholders?: Json | null
          market_stage?: string | null
          mission_statement?: string | null
          organization_id: string
          regulatory_environment?: string | null
          risk_appetite?: string | null
          stakeholder_orientation?: string | null
          strategic_priorities?: Json | null
          updated_at?: string
          updated_by?: string | null
          vision_statement?: string | null
        }
        Update: {
          competitive_position?: string | null
          core_values?: Json | null
          created_at?: string
          decision_principles?: Json | null
          decision_speed_preference?: string | null
          ethical_boundaries?: Json | null
          governance_model?: string | null
          id?: string
          industry_context?: string | null
          innovation_posture?: string | null
          key_stakeholders?: Json | null
          market_stage?: string | null
          mission_statement?: string | null
          organization_id?: string
          regulatory_environment?: string | null
          risk_appetite?: string | null
          stakeholder_orientation?: string | null
          strategic_priorities?: Json | null
          updated_at?: string
          updated_by?: string | null
          vision_statement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizational_identity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
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
      outcome_predictions: {
        Row: {
          confidence_factors: Json | null
          created_at: string
          decision_id: string
          id: string
          model_version: number
          organization_id: string
          predicted_success_probability: number
          similar_decisions_avg_outcome: number | null
          similar_decisions_count: number
          similar_decisions_success_rate: number | null
        }
        Insert: {
          confidence_factors?: Json | null
          created_at?: string
          decision_id: string
          id?: string
          model_version?: number
          organization_id: string
          predicted_success_probability: number
          similar_decisions_avg_outcome?: number | null
          similar_decisions_count?: number
          similar_decisions_success_rate?: number | null
        }
        Update: {
          confidence_factors?: Json | null
          created_at?: string
          decision_id?: string
          id?: string
          model_version?: number
          organization_id?: string
          predicted_success_probability?: number
          similar_decisions_avg_outcome?: number | null
          similar_decisions_count?: number
          similar_decisions_success_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_predictions_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "pipeline_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      portfolio_companies: {
        Row: {
          cash_runway_months: number | null
          created_at: string
          current_valuation: number | null
          dataset_id: string | null
          ebitda_ltm: number | null
          ebitda_margin_pct: number | null
          fund_name: string | null
          headcount: number | null
          health_status: string | null
          id: string
          investment_amount: number | null
          investment_date: string | null
          last_board_date: string | null
          name: string
          next_board_date: string | null
          notes: string | null
          organization_id: string
          ownership_pct: number | null
          revenue_growth_pct: number | null
          revenue_ltm: number | null
          risk_score: number | null
          risk_trend: string | null
          sector: string
          updated_at: string
        }
        Insert: {
          cash_runway_months?: number | null
          created_at?: string
          current_valuation?: number | null
          dataset_id?: string | null
          ebitda_ltm?: number | null
          ebitda_margin_pct?: number | null
          fund_name?: string | null
          headcount?: number | null
          health_status?: string | null
          id?: string
          investment_amount?: number | null
          investment_date?: string | null
          last_board_date?: string | null
          name: string
          next_board_date?: string | null
          notes?: string | null
          organization_id: string
          ownership_pct?: number | null
          revenue_growth_pct?: number | null
          revenue_ltm?: number | null
          risk_score?: number | null
          risk_trend?: string | null
          sector?: string
          updated_at?: string
        }
        Update: {
          cash_runway_months?: number | null
          created_at?: string
          current_valuation?: number | null
          dataset_id?: string | null
          ebitda_ltm?: number | null
          ebitda_margin_pct?: number | null
          fund_name?: string | null
          headcount?: number | null
          health_status?: string | null
          id?: string
          investment_amount?: number | null
          investment_date?: string | null
          last_board_date?: string | null
          name?: string
          next_board_date?: string | null
          notes?: string | null
          organization_id?: string
          ownership_pct?: number | null
          revenue_growth_pct?: number | null
          revenue_ltm?: number | null
          risk_score?: number | null
          risk_trend?: string | null
          sector?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_companies_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "raw_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          dataset_id: string | null
          file_path: string
          generated_by: string
          id: string
          organization_id: string
          report_type: string
        }
        Insert: {
          created_at?: string
          dataset_id?: string | null
          file_path: string
          generated_by: string
          id?: string
          organization_id: string
          report_type?: string
        }
        Update: {
          created_at?: string
          dataset_id?: string | null
          file_path?: string
          generated_by?: string
          id?: string
          organization_id?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          granted: boolean | null
          id: string
          organization_id: string
          permission: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          created_at?: string | null
          granted?: boolean | null
          id?: string
          organization_id: string
          permission: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          created_at?: string | null
          granted?: boolean | null
          id?: string
          organization_id?: string
          permission?: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_organization_id_fkey"
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
          dataset_id: string | null
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
          dataset_id?: string | null
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
          dataset_id?: string | null
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
            foreignKeyName: "scenarios_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_evolution_log: {
        Row: {
          change_type: string
          column_name: string | null
          created_at: string
          dataset_id: string
          detected_at: string
          detected_by: string
          id: string
          metadata: Json | null
          new_type: string | null
          old_type: string | null
          organization_id: string
          version_number: number
        }
        Insert: {
          change_type?: string
          column_name?: string | null
          created_at?: string
          dataset_id: string
          detected_at?: string
          detected_by?: string
          id?: string
          metadata?: Json | null
          new_type?: string | null
          old_type?: string | null
          organization_id: string
          version_number?: number
        }
        Update: {
          change_type?: string
          column_name?: string | null
          created_at?: string
          dataset_id?: string
          detected_at?: string
          detected_by?: string
          id?: string
          metadata?: Json | null
          new_type?: string | null
          old_type?: string | null
          organization_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "schema_evolution_log_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schema_evolution_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_tokens: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          last_used_at: string | null
          organization_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          last_used_at?: string | null
          organization_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          last_used_at?: string | null
          organization_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_tokens_organization_id_fkey"
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
          dataset_id: string | null
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
          dataset_id?: string | null
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
          dataset_id?: string | null
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
            foreignKeyName: "simulation_results_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
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
      sso_configs: {
        Row: {
          allowed_domains: string[] | null
          attribute_mapping: Json | null
          auto_provision: boolean
          created_at: string
          deactivate_on_removal: boolean
          enforce_sso: boolean
          id: string
          idp_certificate: string | null
          idp_entity_id: string | null
          idp_metadata_url: string | null
          idp_sso_url: string | null
          is_active: boolean
          organization_id: string
          provider_type: string
          updated_at: string
        }
        Insert: {
          allowed_domains?: string[] | null
          attribute_mapping?: Json | null
          auto_provision?: boolean
          created_at?: string
          deactivate_on_removal?: boolean
          enforce_sso?: boolean
          id?: string
          idp_certificate?: string | null
          idp_entity_id?: string | null
          idp_metadata_url?: string | null
          idp_sso_url?: string | null
          is_active?: boolean
          organization_id: string
          provider_type?: string
          updated_at?: string
        }
        Update: {
          allowed_domains?: string[] | null
          attribute_mapping?: Json | null
          auto_provision?: boolean
          created_at?: string
          deactivate_on_removal?: boolean
          enforce_sso?: boolean
          id?: string
          idp_certificate?: string | null
          idp_entity_id?: string | null
          idp_metadata_url?: string | null
          idp_sso_url?: string | null
          is_active?: boolean
          organization_id?: string
          provider_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sso_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      step_up_challenges: {
        Row: {
          action_type: string
          created_at: string
          expires_at: string
          id: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
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
      sync_schedules: {
        Row: {
          backoff_minutes: number
          created_at: string
          data_source_id: string
          frequency: string
          id: string
          is_active: boolean | null
          last_error: string | null
          last_run_at: string | null
          max_retries: number
          next_run_at: string | null
          organization_id: string
          retry_count: number
          run_count: number | null
          updated_at: string
        }
        Insert: {
          backoff_minutes?: number
          created_at?: string
          data_source_id: string
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_run_at?: string | null
          max_retries?: number
          next_run_at?: string | null
          organization_id: string
          retry_count?: number
          run_count?: number | null
          updated_at?: string
        }
        Update: {
          backoff_minutes?: number
          created_at?: string
          data_source_id?: string
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_run_at?: string | null
          max_retries?: number
          next_run_at?: string | null
          organization_id?: string
          retry_count?: number
          run_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_schedules_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: true
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_schedules_organization_id_fkey"
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
      user_sessions: {
        Row: {
          created_at: string
          device_name: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          last_active_at: string | null
          location_info: Json | null
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          session_token_hash: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string | null
          location_info?: Json | null
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          session_token_hash?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string | null
          location_info?: Json | null
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          session_token_hash?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_challenges: {
        Row: {
          ceremony_type: string
          challenge: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          ceremony_type: string
          challenge: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          ceremony_type?: string
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          aaguid: string | null
          created_at: string
          credential_id: string
          device_name: string
          id: string
          last_used_at: string | null
          public_key: string
          sign_count: number | null
          transports: Json | null
          user_id: string
        }
        Insert: {
          aaguid?: string | null
          created_at?: string
          credential_id: string
          device_name?: string
          id?: string
          last_used_at?: string | null
          public_key: string
          sign_count?: number | null
          transports?: Json | null
          user_id: string
        }
        Update: {
          aaguid?: string | null
          created_at?: string
          credential_id?: string
          device_name?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          sign_count?: number | null
          transports?: Json | null
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
      exec_cleanup_old_data: {
        Args: {
          _events_retain_days?: number
          _predictions_retain_days?: number
          _run_log_retain_days?: number
          _scores_retain_days?: number
        }
        Returns: Json
      }
      exec_compute_scores_idempotent: {
        Args: { _cooldown_minutes?: number; _org_id: string; _scores: Json }
        Returns: Json
      }
      exec_create_interventions_atomic: {
        Args: { _interventions: Json; _org_id: string }
        Returns: Json
      }
      exec_get_latest_events_by_plan: {
        Args: { _org_id: string; _plan_ids: string[] }
        Returns: {
          event_count: number
          execution_plan_id: string
          latest_event_at: string
        }[]
      }
      exec_infer_blockers:
        | {
            Args: { _org_id: string }
            Returns: {
              blocker_action_title: string
              blocker_status: string
              inferred_blocker_id: string
              plan_action_title: string
              plan_id: string
              reason: string
            }[]
          }
        | {
            Args: { _limit?: number; _org_id: string }
            Returns: {
              blocker_action_title: string
              blocker_status: string
              inferred_blocker_id: string
              plan_action_title: string
              plan_id: string
              reason: string
            }[]
          }
      exec_log_override: {
        Args: {
          _actor_id: string
          _changes?: Json
          _org_id: string
          _override_type: string
          _plan_id: string
          _reason: string
        }
        Returns: Json
      }
      exec_operational_metrics: { Args: { _org_id: string }; Returns: Json }
      exec_reassign_plan_atomic: {
        Args: {
          _actor_id: string
          _new_owner_id: string
          _org_id: string
          _plan_id: string
          _reason?: string
        }
        Returns: Json
      }
      exec_require_elevated_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      exec_resolve_intervention_atomic: {
        Args: { _actor_id: string; _intervention_id: string; _org_id: string }
        Returns: Json
      }
      exec_supersede_predictions: {
        Args: {
          _new_run_id: string
          _org_id: string
          _plan_ids: string[]
          _predictions: Json
        }
        Returns: Json
      }
      exec_verify_step_up_auth: {
        Args: { _org_id: string; _user_id: string; _validity_minutes?: number }
        Returns: boolean
      }
      get_user_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_permission: {
        Args: { _org_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
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
      is_dataset_workspace_member: {
        Args: { _dataset_id: string; _user_id: string }
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
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      match_decision_embeddings: {
        Args: {
          filter_entity_types: string[]
          filter_org_id: string
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content_text: string
          distance: number
          entity_id: string
          entity_type: string
          metadata: Json
        }[]
      }
      refresh_metric_aggregates: {
        Args: { _dataset_id?: string; _org_id: string; _period_type?: string }
        Returns: number
      }
      release_cron_advisory_lock: {
        Args: { _lock_id: number }
        Returns: undefined
      }
      resolve_sso_for_email: {
        Args: { _email: string }
        Returns: {
          enforce_sso: boolean
          idp_sso_url: string
          organization_id: string
          provider_type: string
        }[]
      }
      try_cron_advisory_lock: { Args: { _lock_id: number }; Returns: boolean }
      update_dataset_staleness: { Args: never; Returns: undefined }
      validate_embed_token: { Args: { _token: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "analyst" | "executive" | "client_viewer"
      org_role:
        | "owner"
        | "admin"
        | "analyst"
        | "executive"
        | "viewer"
        | "steward"
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
      org_role: ["owner", "admin", "analyst", "executive", "viewer", "steward"],
      workspace_role: [
        "workspace_admin",
        "workspace_editor",
        "workspace_viewer",
      ],
    },
  },
} as const
