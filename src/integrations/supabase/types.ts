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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json | null
          org_id: string
          ts: string
          user_id: string | null
        }
        Insert: {
          action: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          org_id: string
          ts?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          org_id?: string
          ts?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_logs: {
        Row: {
          campaign_id: string
          created_at: string | null
          error_message: string | null
          execution_duration_ms: number | null
          execution_time: string | null
          id: string
          leads_processed: number | null
          messages_failed: number | null
          messages_sent: number | null
          messages_triggered: number | null
          metadata: Json | null
          org_id: string
          status: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          error_message?: string | null
          execution_duration_ms?: number | null
          execution_time?: string | null
          id?: string
          leads_processed?: number | null
          messages_failed?: number | null
          messages_sent?: number | null
          messages_triggered?: number | null
          metadata?: Json | null
          org_id: string
          status?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          error_message?: string | null
          execution_duration_ms?: number | null
          execution_time?: string | null
          id?: string
          leads_processed?: number | null
          messages_failed?: number | null
          messages_sent?: number | null
          messages_triggered?: number | null
          metadata?: Json | null
          org_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sends: {
        Row: {
          campaign_id: string
          channel: string
          id: string
          lead_id: string
          message_content: string
          sent_at: string
          status: string
        }
        Insert: {
          campaign_id: string
          channel: string
          id?: string
          lead_id: string
          message_content: string
          sent_at?: string
          status?: string
        }
        Update: {
          campaign_id?: string
          channel?: string
          id?: string
          lead_id?: string
          message_content?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channels: Json | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          message_template: string
          name: string
          org_id: string
          status: string
          target_criteria: Json | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          channels?: Json | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          message_template: string
          name: string
          org_id: string
          status?: string
          target_criteria?: Json | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          channels?: Json | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          message_template?: string
          name?: string
          org_id?: string
          status?: string
          target_criteria?: Json | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          connected_at: string
          id: string
          metadata: Json | null
          org_id: string
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          provider: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_snapshots: {
        Row: {
          created_at: string | null
          gating_factor: Database["public"]["Enums"]["gating_factor"] | null
          id: string
          lead_id: string
          model_version: string | null
          neighborhoods: Json | null
          price_ceiling: number | null
          purchase_window: Database["public"]["Enums"]["purchase_window"] | null
          sentiment: Database["public"]["Enums"]["sentiment"] | null
          urgency_score: number | null
        }
        Insert: {
          created_at?: string | null
          gating_factor?: Database["public"]["Enums"]["gating_factor"] | null
          id?: string
          lead_id: string
          model_version?: string | null
          neighborhoods?: Json | null
          price_ceiling?: number | null
          purchase_window?:
            | Database["public"]["Enums"]["purchase_window"]
            | null
          sentiment?: Database["public"]["Enums"]["sentiment"] | null
          urgency_score?: number | null
        }
        Update: {
          created_at?: string | null
          gating_factor?: Database["public"]["Enums"]["gating_factor"] | null
          id?: string
          lead_id?: string
          model_version?: string | null
          neighborhoods?: Json | null
          price_ceiling?: number | null
          purchase_window?:
            | Database["public"]["Enums"]["purchase_window"]
            | null
          sentiment?: Database["public"]["Enums"]["sentiment"] | null
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "intent_snapshots_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["interaction_channel"]
          direction: Database["public"]["Enums"]["interaction_direction"]
          id: string
          lead_id: string
          metadata: Json | null
          subject: string | null
          ts: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["interaction_channel"]
          direction: Database["public"]["Enums"]["interaction_direction"]
          id?: string
          lead_id: string
          metadata?: Json | null
          subject?: string | null
          ts?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["interaction_channel"]
          direction?: Database["public"]["Enums"]["interaction_direction"]
          id?: string
          lead_id?: string
          metadata?: Json | null
          subject?: string | null
          ts?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_user_id: string | null
          baths: number | null
          beds: number | null
          budget_max: number | null
          budget_min: number | null
          city: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          opt_out: boolean | null
          org_id: string
          phone: string | null
          source: Database["public"]["Enums"]["lead_source"] | null
          stage: Database["public"]["Enums"]["lead_stage"] | null
          tags: Json | null
          timezone: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          baths?: number | null
          beds?: number | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          opt_out?: boolean | null
          org_id: string
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          tags?: Json | null
          timezone?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          baths?: number | null
          beds?: number | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          opt_out?: boolean | null
          org_id?: string
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          tags?: Json | null
          timezone?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          channel: string
          created_at: string | null
          error_message: string | null
          id: string
          lead_id: string
          max_retries: number | null
          message_content: string
          metadata: Json | null
          org_id: string
          processed_at: string | null
          retry_count: number | null
          scheduled_for: string | null
          status: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id: string
          max_retries?: number | null
          message_content: string
          metadata?: Json | null
          org_id: string
          processed_at?: string | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string
          max_retries?: number | null
          message_content?: string
          metadata?: Json | null
          org_id?: string
          processed_at?: string | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          channel: string
          created_at: string
          fallback_copy: string | null
          id: string
          llm_prompt: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          fallback_copy?: string | null
          id?: string
          llm_prompt: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          fallback_copy?: string | null
          id?: string
          llm_prompt?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string | null
          id: string
          name: string
          plan: Database["public"]["Enums"]["org_plan"] | null
          seats: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          plan?: Database["public"]["Enums"]["org_plan"] | null
          seats?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          plan?: Database["public"]["Enums"]["org_plan"] | null
          seats?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          org_id: string | null
          phone: string | null
          timezone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          org_id?: string | null
          phone?: string | null
          timezone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          org_id?: string | null
          phone?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      triggers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          org_id: string
          params: Json | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          lead_id?: string | null
          org_id: string
          params?: Json | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          org_id?: string
          params?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "triggers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triggers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
          role: Database["public"]["Enums"]["app_role"]
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
      campaign_stats: {
        Row: {
          failed_sends: number | null
          id: string | null
          last_sent_at: string | null
          name: string | null
          status: string | null
          successful_sends: number | null
          total_sends: number | null
        }
        Relationships: []
      }
      message_queue_stats: {
        Row: {
          avg_retries: number | null
          channel: string | null
          count: number | null
          last_created: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_org_id: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "agent" | "broker_admin" | "owner"
      gating_factor:
        | "rates"
        | "downpayment"
        | "inventory"
        | "credit"
        | "just_browsing"
        | "unknown"
      interaction_channel:
        | "email"
        | "sms"
        | "call"
        | "note"
        | "site_chat"
        | "form"
      interaction_direction: "inbound" | "outbound"
      lead_source:
        | "Zillow"
        | "Realtor"
        | "FB"
        | "Website"
        | "Referral"
        | "Manual"
        | "Unknown"
      lead_stage:
        | "New"
        | "Conversation"
        | "Nurture"
        | "Hot"
        | "Under_Contract"
        | "Closed"
        | "Lost"
      org_plan: "Trial" | "Solo" | "Team" | "Broker"
      purchase_window: "ASAP" | "1-3mo" | "3-6mo" | "6-12mo" | "unknown"
      sentiment: "pos" | "neu" | "neg"
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
      app_role: ["agent", "broker_admin", "owner"],
      gating_factor: [
        "rates",
        "downpayment",
        "inventory",
        "credit",
        "just_browsing",
        "unknown",
      ],
      interaction_channel: [
        "email",
        "sms",
        "call",
        "note",
        "site_chat",
        "form",
      ],
      interaction_direction: ["inbound", "outbound"],
      lead_source: [
        "Zillow",
        "Realtor",
        "FB",
        "Website",
        "Referral",
        "Manual",
        "Unknown",
      ],
      lead_stage: [
        "New",
        "Conversation",
        "Nurture",
        "Hot",
        "Under_Contract",
        "Closed",
        "Lost",
      ],
      org_plan: ["Trial", "Solo", "Team", "Broker"],
      purchase_window: ["ASAP", "1-3mo", "3-6mo", "6-12mo", "unknown"],
      sentiment: ["pos", "neu", "neg"],
    },
  },
} as const
