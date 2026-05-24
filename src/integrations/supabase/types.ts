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
        Relationships: []
      }
      customer_receipt_seq: {
        Row: {
          customer_id: string
          next_value: number
        }
        Insert: {
          customer_id: string
          next_value?: number
        }
        Update: {
          customer_id?: string
          next_value?: number
        }
        Relationships: []
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
      door_order_items: {
        Row: {
          back_mica: string | null
          billable_sqft: number
          created_at: string
          door_made: string | null
          door_taken_size: string | null
          door_type_id: string | null
          door_type_name: string | null
          front_mica: string | null
          id: string
          line_total: number
          mica_addon: number
          order_id: string
          party_door_size: string | null
          party_sqft: number
          qty: number
          rate_per_sqft: number
          taken_sqft: number
        }
        Insert: {
          back_mica?: string | null
          billable_sqft?: number
          created_at?: string
          door_made?: string | null
          door_taken_size?: string | null
          door_type_id?: string | null
          door_type_name?: string | null
          front_mica?: string | null
          id?: string
          line_total?: number
          mica_addon?: number
          order_id: string
          party_door_size?: string | null
          party_sqft?: number
          qty?: number
          rate_per_sqft?: number
          taken_sqft?: number
        }
        Update: {
          back_mica?: string | null
          billable_sqft?: number
          created_at?: string
          door_made?: string | null
          door_taken_size?: string | null
          door_type_id?: string | null
          door_type_name?: string | null
          front_mica?: string | null
          id?: string
          line_total?: number
          mica_addon?: number
          order_id?: string
          party_door_size?: string | null
          party_sqft?: number
          qty?: number
          rate_per_sqft?: number
          taken_sqft?: number
        }
        Relationships: [
          {
            foreignKeyName: "door_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "door_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      door_orders: {
        Row: {
          back_mica: string | null
          category: string
          created_at: string
          created_by: string | null
          customer_name: string
          door_taken_size: string | null
          door_type_id: string | null
          door_type_name: string | null
          front_mica: string | null
          id: string
          notes: string | null
          order_date: string
          order_no: string
          party_door_size: string | null
          rate: number
          total: number
          updated_at: string
        }
        Insert: {
          back_mica?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          customer_name: string
          door_taken_size?: string | null
          door_type_id?: string | null
          door_type_name?: string | null
          front_mica?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_no: string
          party_door_size?: string | null
          rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          back_mica?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string
          door_taken_size?: string | null
          door_type_id?: string | null
          door_type_name?: string | null
          front_mica?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_no?: string
          party_door_size?: string | null
          rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "door_orders_door_type_id_fkey"
            columns: ["door_type_id"]
            isOneToOne: false
            referencedRelation: "door_types"
            referencedColumns: ["id"]
          },
        ]
      }
      door_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          rate: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          rate?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      godowns: {
        Row: {
          active: boolean
          address: string | null
          capacity: number | null
          code: string | null
          created_at: string
          id: string
          manager_name: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          capacity?: number | null
          code?: string | null
          created_at?: string
          id?: string
          manager_name?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          capacity?: number | null
          code?: string | null
          created_at?: string
          id?: string
          manager_name?: string | null
          name?: string
          phone?: string | null
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
          godown_id: string | null
          id: string
          is_lot: boolean
          length_value: number | null
          location: string | null
          produced_by_order_id: string | null
          product_id: string
          qr_payload: Json
          qty_on_hand: number
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
          godown_id?: string | null
          id: string
          is_lot?: boolean
          length_value?: number | null
          location?: string | null
          produced_by_order_id?: string | null
          product_id: string
          qr_payload: Json
          qty_on_hand?: number
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
          godown_id?: string | null
          id?: string
          is_lot?: boolean
          length_value?: number | null
          location?: string | null
          produced_by_order_id?: string | null
          product_id?: string
          qr_payload?: Json
          qty_on_hand?: number
          source_purchase_item_id?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          width_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_instances_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
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
      products: {
        Row: {
          active: boolean
          alt_conversion: number | null
          alt_unit: string | null
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
          alt_conversion?: number | null
          alt_unit?: string | null
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
          alt_conversion?: number | null
          alt_unit?: string | null
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
      purchase_return_items: {
        Row: {
          created_at: string
          gst_rate: number
          id: string
          item_instance_id: string | null
          line_total: number
          product_id: string
          qty: number
          rate: number
          return_id: string
        }
        Insert: {
          created_at?: string
          gst_rate?: number
          id?: string
          item_instance_id?: string | null
          line_total?: number
          product_id: string
          qty?: number
          rate?: number
          return_id: string
        }
        Update: {
          created_at?: string
          gst_rate?: number
          id?: string
          item_instance_id?: string | null
          line_total?: number
          product_id?: string
          qty?: number
          rate?: number
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          grand_total: number
          id: string
          notes: string | null
          purchase_id: string | null
          reason: string | null
          return_date: string
          return_no: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          tax_total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          purchase_id?: string | null
          reason?: string | null
          return_date?: string
          return_no?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          purchase_id?: string | null
          reason?: string | null
          return_date?: string
          return_no?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          mode: string
          notes: string | null
          receipt_no: string
          receipt_type: string
          sale_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          mode?: string
          notes?: string | null
          receipt_no: string
          receipt_type?: string
          sale_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          mode?: string
          notes?: string | null
          receipt_no?: string
          receipt_type?: string
          sale_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
        Relationships: []
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
      sales_return_items: {
        Row: {
          created_at: string
          gst_rate: number
          id: string
          item_instance_id: string | null
          line_total: number
          product_id: string
          qty: number
          rate: number
          return_id: string
        }
        Insert: {
          created_at?: string
          gst_rate?: number
          id?: string
          item_instance_id?: string | null
          line_total?: number
          product_id: string
          qty?: number
          rate?: number
          return_id: string
        }
        Update: {
          created_at?: string
          gst_rate?: number
          id?: string
          item_instance_id?: string | null
          line_total?: number
          product_id?: string
          qty?: number
          rate?: number
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          grand_total: number
          id: string
          notes: string | null
          reason: string | null
          refund_amount: number
          refund_mode: string
          return_date: string
          return_no: string | null
          sale_id: string | null
          status: string
          subtotal: number
          tax_total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          reason?: string | null
          refund_amount?: number
          refund_mode?: string
          return_date?: string
          return_no?: string | null
          sale_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          reason?: string | null
          refund_amount?: number
          refund_mode?: string
          return_date?: string
          return_no?: string | null
          sale_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_sale_id_fkey"
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
      current_user_is_admin: { Args: never; Returns: boolean }
      dashboard_summary: { Args: { _since: string }; Returns: Json }
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
          godown_id: string | null
          id: string
          is_lot: boolean
          length_value: number | null
          location: string | null
          produced_by_order_id: string | null
          product_id: string
          qr_payload: Json
          qty_on_hand: number
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
      next_receipt_no: { Args: { _customer_id: string }; Returns: string }
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
      stock_by_product: {
        Args: never
        Returns: {
          available_qty: number
          product_id: string
        }[]
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
