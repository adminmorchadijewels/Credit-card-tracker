export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      credit_cards: {
        Row: {
          id: string
          parent_id: string
          card_name: string
          card_status: string
          owned_by: string
          bank: string
          customer_care: string
          bill_generation_day: number
          bill_payment_date: number
          limit_shared: boolean
          milestone_rewards: string
          general_rewards: string
          target_milestones: Json
          annual_charges: number
          registered_no: string
          email: string
          annual_cycle_reset: string
          card_limit: number
          reward_points_expiry_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          parent_id?: string
          card_name: string
          card_status?: string
          owned_by?: string
          bank: string
          customer_care?: string
          bill_generation_day?: number
          bill_payment_date?: number
          limit_shared?: boolean
          milestone_rewards?: string
          general_rewards?: string
          target_milestones?: Json
          annual_charges?: number
          registered_no?: string
          email?: string
          annual_cycle_reset?: string
          card_limit?: number
          reward_points_expiry_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_id?: string
          card_name?: string
          card_status?: string
          owned_by?: string
          bank?: string
          customer_care?: string
          bill_generation_day?: number
          bill_payment_date?: number
          limit_shared?: boolean
          milestone_rewards?: string
          general_rewards?: string
          target_milestones?: Json
          annual_charges?: number
          registered_no?: string
          email?: string
          annual_cycle_reset?: string
          card_limit?: number
          reward_points_expiry_days?: number
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          card_id: string
          card_name: string
          statement_date: string
          payment_due: number
          payment_deadline: string
          payment_paid_on: string | null
          paid_amount: number
          status: string
          notes: string
          statement_file_url: string | null
          statement_file_name: string | null
          installments: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          card_id: string
          card_name: string
          statement_date: string
          payment_due?: number
          payment_deadline?: string
          payment_paid_on?: string | null
          paid_amount?: number
          status?: string
          notes?: string
          statement_file_url?: string | null
          statement_file_name?: string | null
          installments?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          card_id?: string
          card_name?: string
          statement_date?: string
          payment_due?: number
          payment_deadline?: string
          payment_paid_on?: string | null
          paid_amount?: number
          status?: string
          notes?: string
          statement_file_url?: string | null
          statement_file_name?: string | null
          installments?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          payment_id: string
          date: string
          category: string
          amount: number
          remark: string
          created_at: string
        }
        Insert: {
          id: string
          payment_id: string
          date: string
          category?: string
          amount: number
          remark?: string
          created_at?: string
        }
        Update: {
          id?: string
          payment_id?: string
          date?: string
          category?: string
          amount?: number
          remark?: string
          created_at?: string
        }
      }
      statement_chunks: {
        Row: {
          id: string
          payment_id: string
          chunk_index: number
          content: string
          embedding: string | null
          created_at: string
        }
        Insert: {
          id?: string
          payment_id: string
          chunk_index: number
          content: string
          embedding?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          payment_id?: string
          chunk_index?: number
          content?: string
          embedding?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_statement_chunks: {
        Args: {
          query_embedding: string
          payment_id_filter: string
          match_count?: number
        }
        Returns: {
          id: string
          payment_id: string
          content: string
          similarity: number
        }[]
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
  public: {
    Enums: {},
  },
} as const
