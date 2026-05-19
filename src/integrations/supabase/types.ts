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
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          id: string
          payload: Json | null
          read_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          type?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          address: string | null
          default_label_format: string
          gstin: string | null
          id: boolean
          invoice_counter: number
          invoice_prefix: string
          shop_name: string
          state: string | null
          ui_config: Json
          updated_at: string
        }
        Insert: {
          address?: string | null
          default_label_format?: string
          gstin?: string | null
          id?: boolean
          invoice_counter?: number
          invoice_prefix?: string
          shop_name?: string
          state?: string | null
          ui_config?: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          default_label_format?: string
          gstin?: string | null
          id?: boolean
          invoice_counter?: number
          invoice_prefix?: string
          shop_name?: string
          state?: string | null
          ui_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json | null
          id: number
          ref_id: string | null
          ref_table: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: number
          ref_id?: string | null
          ref_table?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: number
          ref_id?: string | null
          ref_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "shop_users"
            referencedColumns: ["id"]
          },
        ]
      }
      bom: {
        Row: {
          active: boolean
          created_at: string
          finished_product_id: string
          id: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          finished_product_id: string
          id?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          finished_product_id?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          bom_id: string
          component_product_id: string
          id: string
          qty: number
        }
        Insert: {
          bom_id: string
          component_product_id: string
          id?: string
          qty: number
        }
        Update: {
          bom_id?: string
          component_product_id?: string
          id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          gstin: string | null
          id: string
          name: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      id_sequences: {
        Row: {
          next_value: number
          prefix: string
        }
        Insert: {
          next_value?: number
          prefix: string
        }
        Update: {
          next_value?: number
          prefix?: string
        }
        Relationships: []
      }
      item_history: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event: Database["public"]["Enums"]["history_event"]
          id: number
          item_id: string
          notes: string | null
          ref_id: string | null
          ref_table: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event: Database["public"]["Enums"]["history_event"]
          id?: number
          item_id: string
          notes?: string | null
          ref_id?: string | null
          ref_table?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event?: Database["public"]["Enums"]["history_event"]
          id?: number
          item_id?: string
          notes?: string | null
          ref_id?: string | null
          ref_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_history_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "shop_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      item_instances: {
        Row: {
          area_sqft: number | null
          barcode_payload: string
          cost_price: number
          created_at: string
          dimension_unit: string | null
          id: string
          length_value: number | null
          location: string | null
          produced_by_order_id: string | null
          product_id: string
          qr_payload: Json
          source_purchase_item_id: string | null
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
          width_value: number | null
        }
        Insert: {
          area_sqft?: number | null
          barcode_payload: string
          cost_price?: number
          created_at?: string
          dimension_unit?: string | null
          id: string
          length_value?: number | null
          location?: string | null
          produced_by_order_id?: string | null
          product_id: string
          qr_payload: Json
          source_purchase_item_id?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          width_value?: number | null
        }
        Update: {
          area_sqft?: number | null
          barcode_payload?: string
          cost_price?: number
          created_at?: string
          dimension_unit?: string | null
          id?: string
          length_value?: number | null
          location?: string | null
          produced_by_order_id?: string | null
          product_id?: string
          qr_payload?: Json
          source_purchase_item_id?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          width_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_instances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_instances_source_purchase_item_id_fkey"
            columns: ["source_purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
        ]
      }
      produced_items: {
        Row: {
          created_at: string
          id: string
          item_instance_id: string
          order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_instance_id: string
          order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_instance_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produced_items_item_instance_id_fkey"
            columns: ["item_instance_id"]
            isOneToOne: false
            referencedRelation: "item_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produced_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_materials: {
        Row: {
          actor_user_id: string | null
          consumed_at: string
          id: string
          item_instance_id: string
          order_id: string
          product_id: string
        }
        Insert: {
          actor_user_id?: string | null
          consumed_at?: string
          id?: string
          item_instance_id: string
          order_id: string
          product_id: string
        }
        Update: {
          actor_user_id?: string | null
          consumed_at?: string
          id?: string
          item_instance_id?: string
          order_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_materials_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "shop_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_materials_item_instance_id_fkey"
            columns: ["item_instance_id"]
            isOneToOne: false
            referencedRelation: "item_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_materials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          assigned_to: string | null
          bom_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          finished_product_id: string
          id: string
          notes: string | null
          qty: number
          status: Database["public"]["Enums"]["production_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bom_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          finished_product_id: string
          id?: string
          notes?: string | null
          qty?: number
          status?: Database["public"]["Enums"]["production_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bom_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          finished_product_id?: string
          id?: string
          notes?: string | null
          qty?: number
          status?: Database["public"]["Enums"]["production_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "shop_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          default_cost: number
          default_price: number
          gst_rate: number
          hsn: string | null
          id: string
          image_url: string | null
          name: string
          prefix: string
          reorder_level: number
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          default_cost?: number
          default_price?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          image_url?: string | null
          name: string
          prefix: string
          reorder_level?: number
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          default_cost?: number
          default_price?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          image_url?: string | null
          name?: string
          prefix?: string
          reorder_level?: number
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          gst_rate: number
          id: string
          line_total: number
          product_id: string
          purchase_id: string
          qty: number
          rate: number
        }
        Insert: {
          created_at?: string
          gst_rate?: number
          id?: string
          line_total?: number
          product_id: string
          purchase_id: string
          qty: number
          rate?: number
        }
        Update: {
          created_at?: string
          gst_rate?: number
          id?: string
          line_total?: number
          product_id?: string
          purchase_id?: string
          qty?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          bill_date: string
          bill_image_url: string | null
          bill_no: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          grand_total: number
          id: string
          notes: string | null
          subtotal: number
          supplier_id: string | null
          tax_total: number
          updated_at: string
        }
        Insert: {
          bill_date?: string
          bill_image_url?: string | null
          bill_no?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          updated_at?: string
        }
        Update: {
          bill_date?: string
          bill_image_url?: string | null
          bill_no?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      recycle_bin: {
        Row: {
          created_at: string
          deleted_by: string | null
          id: string
          payload: Json
          reason: string | null
          ref_id: string
          ref_table: string
        }
        Insert: {
          created_at?: string
          deleted_by?: string | null
          id?: string
          payload: Json
          reason?: string | null
          ref_id: string
          ref_table: string
        }
        Update: {
          created_at?: string
          deleted_by?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          ref_id?: string
          ref_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "recycle_bin_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "shop_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cgst: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          discount: number
          grand_total: number
          id: string
          igst: number
          invoice_date: string
          invoice_no: string | null
          notes: string | null
          paid_amount: number
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          sgst: number
          subtotal: number
          updated_at: string
        }
        Insert: {
          cgst?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          discount?: number
          grand_total?: number
          id?: string
          igst?: number
          invoice_date?: string
          invoice_no?: string | null
          notes?: string | null
          paid_amount?: number
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          sgst?: number
          subtotal?: number
          updated_at?: string
        }
        Update: {
          cgst?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          discount?: number
          grand_total?: number
          id?: string
          igst?: number
          invoice_date?: string
          invoice_no?: string | null
          notes?: string | null
          paid_amount?: number
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          sgst?: number
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_items: {
        Row: {
          gst_rate: number
          id: string
          item_instance_id: string | null
          line_total: number
          product_id: string
          qty: number
          rate: number
          sale_id: string
        }
        Insert: {
          gst_rate?: number
          id?: string
          item_instance_id?: string | null
          line_total?: number
          product_id: string
          qty?: number
          rate?: number
          sale_id: string
        }
        Update: {
          gst_rate?: number
          id?: string
          item_instance_id?: string | null
          line_total?: number
          product_id?: string
          qty?: number
          rate?: number
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_items_item_instance_id_fkey"
            columns: ["item_instance_id"]
            isOneToOne: false
            referencedRelation: "item_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_users: {
        Row: {
          active: boolean
          created_at: string
          id: string
          last_login_at: string | null
          name: string
          pin_hash: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          last_login_at?: string | null
          name: string
          pin_hash: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          last_login_at?: string | null
          name?: string
          pin_hash?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          gstin: string | null
          id: string
          name: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      complete_production: {
        Args: { _actor_user_id: string; _order_id: string }
        Returns: {
          area_sqft: number | null
          barcode_payload: string
          cost_price: number
          created_at: string
          dimension_unit: string | null
          id: string
          length_value: number | null
          location: string | null
          produced_by_order_id: string | null
          product_id: string
          qr_payload: Json
          source_purchase_item_id: string | null
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
          width_value: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "item_instances"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      consume_material: {
        Args: { _actor_user_id: string; _item_id: string; _order_id: string }
        Returns: undefined
      }
      current_user_is_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_signed_in: { Args: never; Returns: boolean }
      mark_damaged: {
        Args: { _actor_user_id: string; _item_id: string; _reason: string }
        Returns: undefined
      }
      mint_item_instances: {
        Args: { _actor_user_id: string; _purchase_item_id: string }
        Returns: {
          area_sqft: number | null
          barcode_payload: string
          cost_price: number
          created_at: string
          dimension_unit: string | null
          id: string
          length_value: number | null
          location: string | null
          produced_by_order_id: string | null
          product_id: string
          qr_payload: Json
          source_purchase_item_id: string | null
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
          width_value: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "item_instances"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      next_item_id: { Args: { _prefix: string }; Returns: string }
      record_sale: {
        Args: { _actor_user_id: string; _payload: Json }
        Returns: string
      }
      shop_user_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      soft_delete_invoice: {
        Args: { _actor_user_id: string; _reason: string; _sale_id: string }
        Returns: undefined
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      app_role: "admin" | "billing" | "store" | "production"
      history_event:
        | "purchased"
        | "sold"
        | "damaged"
        | "used_in_production"
        | "returned"
        | "reserved"
        | "moved"
        | "restored"
      item_status:
        | "available"
        | "sold"
        | "damaged"
        | "used_in_production"
        | "returned"
        | "reserved"
      payment_mode: "cash" | "credit" | "upi" | "card"
      product_category: "plywood" | "hardware" | "door" | "other"
      production_status: "open" | "in_progress" | "completed" | "cancelled"
      user_role: "admin" | "billing" | "store" | "production"
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
      alert_severity: ["info", "warning", "critical"],
      app_role: ["admin", "billing", "store", "production"],
      history_event: [
        "purchased",
        "sold",
        "damaged",
        "used_in_production",
        "returned",
        "reserved",
        "moved",
        "restored",
      ],
      item_status: [
        "available",
        "sold",
        "damaged",
        "used_in_production",
        "returned",
        "reserved",
      ],
      payment_mode: ["cash", "credit", "upi", "card"],
      product_category: ["plywood", "hardware", "door", "other"],
      production_status: ["open", "in_progress", "completed", "cancelled"],
      user_role: ["admin", "billing", "store", "production"],
    },
  },
} as const
