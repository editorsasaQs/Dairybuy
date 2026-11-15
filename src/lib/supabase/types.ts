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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          milk_type: Database["public"]["Enums"]["milk_type_enum"] | null
          product_variant_id: string
          quantity: number
          quantity_litres: number | null
          unit_price_paise: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          milk_type?: Database["public"]["Enums"]["milk_type_enum"] | null
          product_variant_id: string
          quantity: number
          quantity_litres?: number | null
          unit_price_paise: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          milk_type?: Database["public"]["Enums"]["milk_type_enum"] | null
          product_variant_id?: string
          quantity?: number
          quantity_litres?: number | null
          unit_price_paise?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "cart_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          session_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          session_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          session_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cod_collection_adjustments: {
        Row: {
          collection_id: string
          created_at: string
          created_by: string
          evidence_reference: string | null
          id: string
          new_amount_paise: number
          old_amount_paise: number
          reason: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          created_by: string
          evidence_reference?: string | null
          id?: string
          new_amount_paise: number
          old_amount_paise: number
          reason: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          created_by?: string
          evidence_reference?: string | null
          id?: string
          new_amount_paise?: number
          old_amount_paise?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "cod_collection_adjustments_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "cod_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      cod_collections: {
        Row: {
          amount_collected_paise: number
          collected_at: string
          collected_by_staff_id: string
          collection_notes: string | null
          id: string
          order_id: string
          receipt_reference: string | null
          rejected_at: string | null
          rejected_by_manager_id: string | null
          rejection_reason: string | null
          status: string
          verified_at: string | null
          verified_by_manager_id: string | null
        }
        Insert: {
          amount_collected_paise: number
          collected_at?: string
          collected_by_staff_id: string
          collection_notes?: string | null
          id?: string
          order_id: string
          receipt_reference?: string | null
          rejected_at?: string | null
          rejected_by_manager_id?: string | null
          rejection_reason?: string | null
          status?: string
          verified_at?: string | null
          verified_by_manager_id?: string | null
        }
        Update: {
          amount_collected_paise?: number
          collected_at?: string
          collected_by_staff_id?: string
          collection_notes?: string | null
          id?: string
          order_id?: string
          receipt_reference?: string | null
          rejected_at?: string | null
          rejected_by_manager_id?: string | null
          rejection_reason?: string | null
          status?: string
          verified_at?: string | null
          verified_by_manager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cod_collections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_type: string
          city: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          landmark: string | null
          phone: string
          pincode: string
          recipient_name: string
          service_area_id: string | null
          state: string
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_type?: string
          city?: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          landmark?: string | null
          phone: string
          pincode: string
          recipient_name: string
          service_area_id?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_type?: string
          city?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          landmark?: string | null
          phone?: string
          pincode?: string
          recipient_name?: string
          service_area_id?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignment_orders: {
        Row: {
          assigned_at: string
          assigned_by: string
          delivery_assignment_id: string
          id: string
          order_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          delivery_assignment_id: string
          id?: string
          order_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          delivery_assignment_id?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignment_orders_delivery_assignment_id_fkey"
            columns: ["delivery_assignment_id"]
            isOneToOne: false
            referencedRelation: "delivery_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignment_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignments: {
        Row: {
          assigned_at: string
          completed_at: string | null
          delivery_date: string
          delivery_slot_id: string
          id: string
          route_order: Json | null
          service_area_id: string
          staff_id: string
          status: string
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          delivery_date: string
          delivery_slot_id: string
          id?: string
          route_order?: Json | null
          service_area_id: string
          staff_id: string
          status?: string
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          delivery_date?: string
          delivery_slot_id?: string
          id?: string
          route_order?: Json | null
          service_area_id?: string
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_delivery_slot_id_fkey"
            columns: ["delivery_slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_cash_handover_adjustments: {
        Row: {
          created_at: string
          created_by: string
          evidence_reference: string | null
          handover_id: string
          id: string
          new_received_amount_paise: number
          old_received_amount_paise: number
          reason: string
        }
        Insert: {
          created_at?: string
          created_by: string
          evidence_reference?: string | null
          handover_id: string
          id?: string
          new_received_amount_paise: number
          old_received_amount_paise: number
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string
          evidence_reference?: string | null
          handover_id?: string
          id?: string
          new_received_amount_paise?: number
          old_received_amount_paise?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_cash_handover_adjustments_handover_id_fkey"
            columns: ["handover_id"]
            isOneToOne: false
            referencedRelation: "delivery_cash_handovers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_cash_handover_items: {
        Row: {
          amount_paise: number
          collection_id: string
          created_at: string
          handover_id: string
          id: string
        }
        Insert: {
          amount_paise: number
          collection_id: string
          created_at?: string
          handover_id: string
          id?: string
        }
        Update: {
          amount_paise?: number
          collection_id?: string
          created_at?: string
          handover_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_cash_handover_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: true
            referencedRelation: "cod_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_cash_handover_items_handover_id_fkey"
            columns: ["handover_id"]
            isOneToOne: false
            referencedRelation: "delivery_cash_handovers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_cash_handovers: {
        Row: {
          business_date: string
          delivery_slot_id: string
          expected_amount_paise: number
          handover_number: string
          id: string
          idempotency_key: string
          received_amount_paise: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_area_id: string
          staff_id: string
          status: string
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          business_date: string
          delivery_slot_id: string
          expected_amount_paise: number
          handover_number: string
          id?: string
          idempotency_key: string
          received_amount_paise: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_id: string
          staff_id: string
          status?: string
          submitted_at?: string
          submitted_by: string
        }
        Update: {
          business_date?: string
          delivery_slot_id?: string
          expected_amount_paise?: number
          handover_number?: string
          id?: string
          idempotency_key?: string
          received_amount_paise?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_id?: string
          staff_id?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_cash_handovers_delivery_slot_id_fkey"
            columns: ["delivery_slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_cash_handovers_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_slots: {
        Row: {
          cancellation_deadline_time: string
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          label: string
          order_cutoff_time: string
          slot_code: string
          start_time: string
        }
        Insert: {
          cancellation_deadline_time: string
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          label: string
          order_cutoff_time: string
          slot_code: string
          start_time: string
        }
        Update: {
          cancellation_deadline_time?: string
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          label?: string
          order_cutoff_time?: string
          slot_code?: string
          start_time?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          available_stock: number
          id: string
          product_variant_id: string
          reserved_stock: number
          safety_stock: number
          service_area_id: string | null
          updated_at: string
        }
        Insert: {
          available_stock?: number
          id?: string
          product_variant_id: string
          reserved_stock?: number
          safety_stock?: number
          service_area_id?: string | null
          updated_at?: string
        }
        Update: {
          available_stock?: number
          id?: string
          product_variant_id?: string
          reserved_stock?: number
          safety_stock?: number
          service_area_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "inventory_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          change_amount: number
          created_at: string
          created_by: string | null
          id: string
          inventory_id: string
          movement_type: string
          notes: string | null
          reference_id: string | null
        }
        Insert: {
          change_amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_id: string
          movement_type: string
          notes?: string | null
          reference_id?: string | null
        }
        Update: {
          change_amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_id?: string
          movement_type?: string
          notes?: string | null
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_receipt_items: {
        Row: {
          created_at: string
          id: string
          inventory_id: string
          line_total_paise: number | null
          product_variant_id: string
          quantity_received: number
          receipt_id: string
          unit_cost_paise: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_id: string
          line_total_paise?: number | null
          product_variant_id: string
          quantity_received: number
          receipt_id: string
          unit_cost_paise: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_id?: string
          line_total_paise?: number | null
          product_variant_id?: string
          quantity_received?: number
          receipt_id?: string
          unit_cost_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipt_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "inventory_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inventory_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_receipts: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          notes: string | null
          receipt_number: string
          received_at: string
          received_by: string
          request_fingerprint: string
          service_area_id: string
          total_cost_paise: number
          total_units: number
          vendor_id: string
          vendor_reference: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          notes?: string | null
          receipt_number: string
          received_at?: string
          received_by: string
          request_fingerprint: string
          service_area_id: string
          total_cost_paise?: number
          total_units?: number
          vendor_id: string
          vendor_reference?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          receipt_number?: string
          received_at?: string
          received_by?: string
          request_fingerprint?: string
          service_area_id?: string
          total_cost_paise?: number
          total_units?: number
          vendor_id?: string
          vendor_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipts_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_adjustments: {
        Row: {
          adjusted_by: string
          adjustment_number: string
          adjustment_type: string
          created_at: string
          evidence_reference: string | null
          id: string
          idempotency_key: string
          inventory_id: string
          quantity_delta: number
          reason: string
          request_fingerprint: string
        }
        Insert: {
          adjusted_by: string
          adjustment_number: string
          adjustment_type: string
          created_at?: string
          evidence_reference?: string | null
          id?: string
          idempotency_key: string
          inventory_id: string
          quantity_delta: number
          reason: string
          request_fingerprint: string
        }
        Update: {
          adjusted_by?: string
          adjustment_number?: string
          adjustment_type?: string
          created_at?: string
          evidence_reference?: string | null
          id?: string
          idempotency_key?: string
          inventory_id?: string
          quantity_delta?: number
          reason?: string
          request_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_adjustments_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          brand_snapshot: string | null
          id: string
          milk_type: Database["public"]["Enums"]["milk_type_enum"] | null
          order_id: string
          pack_size_snapshot: string | null
          product_name_snapshot: string | null
          product_variant_id: string
          quantity: number
          quantity_litres: number | null
          total_price_paise: number
          unit_price_paise: number
          variant_name_snapshot: string | null
          vendor_id: string | null
          vendor_name_snapshot: string | null
        }
        Insert: {
          brand_snapshot?: string | null
          id?: string
          milk_type?: Database["public"]["Enums"]["milk_type_enum"] | null
          order_id: string
          pack_size_snapshot?: string | null
          product_name_snapshot?: string | null
          product_variant_id: string
          quantity: number
          quantity_litres?: number | null
          total_price_paise: number
          unit_price_paise: number
          variant_name_snapshot?: string | null
          vendor_id?: string | null
          vendor_name_snapshot?: string | null
        }
        Update: {
          brand_snapshot?: string | null
          id?: string
          milk_type?: Database["public"]["Enums"]["milk_type_enum"] | null
          order_id?: string
          pack_size_snapshot?: string | null
          product_name_snapshot?: string | null
          product_variant_id?: string
          quantity?: number
          quantity_litres?: number | null
          total_price_paise?: number
          unit_price_paise?: number
          variant_name_snapshot?: string | null
          vendor_id?: string | null
          vendor_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status_enum"] | null
          id: string
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status_enum"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status_enum"] | null
          id?: string
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status_enum"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status_enum"] | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_address_id: string
          customer_id: string
          delivery_address_snapshot: Json
          delivery_address_snapshot_at: string
          delivery_address_snapshot_source: string
          delivery_date: string | null
          delivery_fee_paise: number
          delivery_notes: string | null
          delivery_slot_id: string
          id: string
          idempotency_key: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type_enum"]
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          service_area_id: string
          status: Database["public"]["Enums"]["order_status_enum"]
          subscription_delivery_id: string | null
          subscription_discount_paise: number
          subscription_id: string | null
          subtotal_paise: number
          total_paise: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address_id: string
          customer_id: string
          delivery_address_snapshot: Json
          delivery_address_snapshot_at: string
          delivery_address_snapshot_source: string
          delivery_date?: string | null
          delivery_fee_paise?: number
          delivery_notes?: string | null
          delivery_slot_id: string
          id?: string
          idempotency_key?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type_enum"]
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          service_area_id: string
          status?: Database["public"]["Enums"]["order_status_enum"]
          subscription_delivery_id?: string | null
          subscription_discount_paise?: number
          subscription_id?: string | null
          subtotal_paise: number
          total_paise: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address_id?: string
          customer_id?: string
          delivery_address_snapshot?: Json
          delivery_address_snapshot_at?: string
          delivery_address_snapshot_source?: string
          delivery_date?: string | null
          delivery_fee_paise?: number
          delivery_notes?: string | null
          delivery_slot_id?: string
          id?: string
          idempotency_key?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type_enum"]
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          service_area_id?: string
          status?: Database["public"]["Enums"]["order_status_enum"]
          subscription_delivery_id?: string | null
          subscription_discount_paise?: number
          subscription_id?: string | null
          subtotal_paise?: number
          total_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_subscription_delivery"
            columns: ["subscription_delivery_id"]
            isOneToOne: false
            referencedRelation: "subscription_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_slot_id_fkey"
            columns: ["delivery_slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          gateway: string
          gateway_event_id: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          gateway: string
          gateway_event_id: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          gateway?: string
          gateway_event_id?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          gateway: string
          gateway_order_id: string | null
          gateway_payment_id: string | null
          id: string
          method: string | null
          order_id: string | null
          status: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          gateway?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          method?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          gateway?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          method?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_variants: {
        Row: {
          brand: string | null
          created_at: string
          final_price_paise: number | null
          id: string
          is_orderable: boolean
          pack_size: string
          pack_unit: string
          product_id: string
          purchase_price_paise: number | null
          sheet_delivery_component_paise: number | null
          unit_quantity: number
          updated_at: string
          variant_name: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          final_price_paise?: number | null
          id: string
          is_orderable?: boolean
          pack_size: string
          pack_unit: string
          product_id: string
          purchase_price_paise?: number | null
          sheet_delivery_component_paise?: number | null
          unit_quantity: number
          updated_at?: string
          variant_name: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          final_price_paise?: number | null
          id?: string
          is_orderable?: boolean
          pack_size?: string
          pack_unit?: string
          product_id?: string
          purchase_price_paise?: number | null
          sheet_delivery_component_paise?: number | null
          unit_quantity?: number
          updated_at?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          product_type: Database["public"]["Enums"]["product_type_enum"]
          requires_vendor_selection: boolean
          slug: string
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          product_type?: Database["public"]["Enums"]["product_type_enum"]
          requires_vendor_selection?: boolean
          slug: string
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_type?: Database["public"]["Enums"]["product_type_enum"]
          requires_vendor_selection?: boolean
          slug?: string
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["category_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_paise: number
          created_at: string
          gateway_refund_id: string | null
          id: string
          payment_id: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          gateway_refund_id?: string | null
          id?: string
          payment_id: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          gateway_refund_id?: string | null
          id?: string
          payment_id?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_area_pincodes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          pincode: string
          service_area_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          pincode: string
          service_area_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          pincode?: string
          service_area_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_area_pincodes_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      service_areas: {
        Row: {
          city: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          state: string
          updated_at: string
        }
        Insert: {
          city?: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          state?: string
          updated_at?: string
        }
        Update: {
          city?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["staff_permission_enum"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["staff_permission_enum"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["staff_permission_enum"]
          user_id?: string
        }
        Relationships: []
      }
      subscription_deliveries: {
        Row: {
          assigned_at: string | null
          assigned_staff_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_date: string
          delivery_notes: string | null
          delivery_slot_id: string
          discount_paise: number
          failed_at: string | null
          id: string
          order_id: string | null
          status: Database["public"]["Enums"]["delivery_status_enum"]
          subscription_id: string
          subtotal_paise: number | null
          total_paise: number | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_staff_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_date: string
          delivery_notes?: string | null
          delivery_slot_id: string
          discount_paise?: number
          failed_at?: string | null
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["delivery_status_enum"]
          subscription_id: string
          subtotal_paise?: number | null
          total_paise?: number | null
        }
        Update: {
          assigned_at?: string | null
          assigned_staff_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_date?: string
          delivery_notes?: string | null
          delivery_slot_id?: string
          discount_paise?: number
          failed_at?: string | null
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["delivery_status_enum"]
          subscription_id?: string
          subtotal_paise?: number | null
          total_paise?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_subscription_deliveries_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_deliveries_delivery_slot_id_fkey"
            columns: ["delivery_slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_item_vendor_changes: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          id: string
          idempotency_key: string
          new_vendor_id: string
          old_vendor_id: string
          subscription_id: string
          subscription_item_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from: string
          id?: string
          idempotency_key: string
          new_vendor_id: string
          old_vendor_id: string
          subscription_id: string
          subscription_item_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          id?: string
          idempotency_key?: string
          new_vendor_id?: string
          old_vendor_id?: string
          subscription_id?: string
          subscription_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_item_vendor_changes_new_vendor_id_fkey"
            columns: ["new_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_item_vendor_changes_old_vendor_id_fkey"
            columns: ["old_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_item_vendor_changes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_item_vendor_changes_subscription_item_id_fkey"
            columns: ["subscription_item_id"]
            isOneToOne: false
            referencedRelation: "subscription_items"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_items: {
        Row: {
          created_at: string
          id: string
          line_total_paise: number | null
          milk_type: Database["public"]["Enums"]["milk_type_enum"] | null
          price_per_delivery_paise: number
          product_name_snapshot: string | null
          product_variant_id: string
          quantity: number
          quantity_litres: number | null
          subscription_id: string
          variant_name_snapshot: string | null
          vendor_id: string | null
          vendor_name_snapshot: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_paise?: number | null
          milk_type?: Database["public"]["Enums"]["milk_type_enum"] | null
          price_per_delivery_paise: number
          product_name_snapshot?: string | null
          product_variant_id: string
          quantity: number
          quantity_litres?: number | null
          subscription_id: string
          variant_name_snapshot?: string | null
          vendor_id?: string | null
          vendor_name_snapshot?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total_paise?: number | null
          milk_type?: Database["public"]["Enums"]["milk_type_enum"] | null
          price_per_delivery_paise?: number
          product_name_snapshot?: string | null
          product_variant_id?: string
          quantity?: number
          quantity_litres?: number | null
          subscription_id?: string
          variant_name_snapshot?: string | null
          vendor_id?: string | null
          vendor_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_lifecycle_events: {
        Row: {
          actor_id: string | null
          created_at: string
          effective_date: string | null
          event_type: string
          id: string
          metadata: Json
          subscription_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          effective_date?: string | null
          event_type: string
          id?: string
          metadata?: Json
          subscription_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          effective_date?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_lifecycle_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_skip_records: {
        Row: {
          created_by: string | null
          id: string
          idempotency_key: string | null
          reason: string | null
          requested_at: string
          skip_date: string
          subscription_id: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          requested_at?: string
          skip_date: string
          subscription_id: string
        }
        Update: {
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          requested_at?: string
          skip_date?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_skip_records_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_vendor_changes: {
        Row: {
          effective_from: string
          id: string
          new_vendor_id: string
          old_vendor_id: string
          requested_at: string
          subscription_id: string
        }
        Insert: {
          effective_from: string
          id?: string
          new_vendor_id: string
          old_vendor_id: string
          requested_at?: string
          subscription_id: string
        }
        Update: {
          effective_from?: string
          id?: string
          new_vendor_id?: string
          old_vendor_id?: string
          requested_at?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_vendor_changes_new_vendor_id_fkey"
            columns: ["new_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_vendor_changes_old_vendor_id_fkey"
            columns: ["old_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_vendor_changes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          address_snapshot: Json | null
          auto_renew: boolean
          cancelled_at: string | null
          cod_activated_at: string | null
          created_at: string
          customer_address_id: string
          customer_id: string
          delivery_generation_last_date: string | null
          delivery_slot_id: string
          delivery_slot_snapshot: Json | null
          discount_paise: number
          duration_days: number | null
          end_date: string | null
          id: string
          idempotency_key: string | null
          next_delivery_date: string | null
          paused_at: string | null
          payment_verified_at: string | null
          plan_type: Database["public"]["Enums"]["subscription_plan_enum"]
          service_area_id: string
          start_date: string
          status: Database["public"]["Enums"]["subscription_status_enum"]
          subscription_number: string
          subtotal_paise: number
          total_paise: number
          updated_at: string
        }
        Insert: {
          address_snapshot?: Json | null
          auto_renew?: boolean
          cancelled_at?: string | null
          cod_activated_at?: string | null
          created_at?: string
          customer_address_id: string
          customer_id: string
          delivery_generation_last_date?: string | null
          delivery_slot_id: string
          delivery_slot_snapshot?: Json | null
          discount_paise?: number
          duration_days?: number | null
          end_date?: string | null
          id?: string
          idempotency_key?: string | null
          next_delivery_date?: string | null
          paused_at?: string | null
          payment_verified_at?: string | null
          plan_type: Database["public"]["Enums"]["subscription_plan_enum"]
          service_area_id: string
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status_enum"]
          subscription_number: string
          subtotal_paise?: number
          total_paise?: number
          updated_at?: string
        }
        Update: {
          address_snapshot?: Json | null
          auto_renew?: boolean
          cancelled_at?: string | null
          cod_activated_at?: string | null
          created_at?: string
          customer_address_id?: string
          customer_id?: string
          delivery_generation_last_date?: string | null
          delivery_slot_id?: string
          delivery_slot_snapshot?: Json | null
          discount_paise?: number
          duration_days?: number | null
          end_date?: string | null
          id?: string
          idempotency_key?: string | null
          next_delivery_date?: string | null
          paused_at?: string | null
          payment_verified_at?: string | null
          plan_type?: Database["public"]["Enums"]["subscription_plan_enum"]
          service_area_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status_enum"]
          subscription_number?: string
          subtotal_paise?: number
          total_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_delivery_slot_id_fkey"
            columns: ["delivery_slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role_enum"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendor_prices: {
        Row: {
          created_at: string
          delivery_fee_paise: number
          effective_from: string
          effective_to: string | null
          id: string
          is_current: boolean
          milk_type: Database["public"]["Enums"]["milk_type_enum"]
          plan_30_day_paise: number | null
          plan_7_day_paise: number | null
          price_per_delivery_paise: number
          product_variant_id: string
          total_customer_delivery_paise: number
          vendor_id: string
        }
        Insert: {
          created_at?: string
          delivery_fee_paise?: number
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_current?: boolean
          milk_type: Database["public"]["Enums"]["milk_type_enum"]
          plan_30_day_paise?: number | null
          plan_7_day_paise?: number | null
          price_per_delivery_paise: number
          product_variant_id: string
          total_customer_delivery_paise: number
          vendor_id: string
        }
        Update: {
          created_at?: string
          delivery_fee_paise?: number
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_current?: boolean
          milk_type?: Database["public"]["Enums"]["milk_type_enum"]
          plan_30_day_paise?: number | null
          plan_7_day_paise?: number | null
          price_per_delivery_paise?: number
          product_variant_id?: string
          total_customer_delivery_paise?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_prices_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_prices_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "vendor_prices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_products: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          milk_type: Database["public"]["Enums"]["milk_type_enum"]
          product_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          milk_type: Database["public"]["Enums"]["milk_type_enum"]
          product_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          milk_type?: Database["public"]["Enums"]["milk_type_enum"]
          product_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_catalogue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          code: string
          contact_person: string | null
          created_at: string
          id: string
          is_approved: boolean
          name: string
          ordering_enabled: boolean
          phone: string | null
          updated_at: string
          vendor_type: string
        }
        Insert: {
          address?: string | null
          code: string
          contact_person?: string | null
          created_at?: string
          id: string
          is_approved?: boolean
          name: string
          ordering_enabled?: boolean
          phone?: string | null
          updated_at?: string
          vendor_type?: string
        }
        Update: {
          address?: string | null
          code?: string
          contact_person?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          name?: string
          ordering_enabled?: boolean
          phone?: string | null
          updated_at?: string
          vendor_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_catalogue: {
        Row: {
          category_description: string | null
          category_display_order: number | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          product_description: string | null
          product_id: string | null
          product_name: string | null
          product_requires_vendor_selection: boolean | null
          product_slug: string | null
          product_subtitle: string | null
          product_type: Database["public"]["Enums"]["product_type_enum"] | null
          variant_brand: string | null
          variant_final_price_paise: number | null
          variant_id: string | null
          variant_is_orderable: boolean | null
          variant_name: string | null
          variant_pack_size: string | null
          variant_pack_unit: string | null
          variant_unit_quantity: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_inventory_stock: {
        Args: {
          p_adjustment_type: string
          p_evidence_reference: string
          p_idempotency_key: string
          p_inventory_id: string
          p_quantity: number
          p_reason: string
        }
        Returns: {
          adjustment_id: string
          adjustment_number: string
          adjustment_type: string
          available_stock: number
          inventory_id: string
          quantity_delta: number
          reserved_stock: number
          was_replayed: boolean
        }[]
      }
      assign_cod_order_to_delivery: {
        Args: { p_delivery_assignment_id: string; p_order_id: string }
        Returns: {
          assignment_order_id: string
          delivery_assignment_id: string
          order_id: string
        }[]
      }
      assign_subscription_delivery: {
        Args: { p_delivery_id: string; p_staff_id: string }
        Returns: {
          assigned_staff_id: string
          delivery_id: string
          delivery_status: Database["public"]["Enums"]["delivery_status_enum"]
          was_replayed: boolean
        }[]
      }
      audit_inventory_reservations: {
        Args: never
        Returns: {
          audit_type: string
          detail: string
          inventory_id: string
          ledger_reserved_stock: number
          order_id: string
          order_status: string
          product_variant_id: string
          recorded_reserved_stock: number
          service_area_id: string
        }[]
      }
      audit_inventory_stock: {
        Args: never
        Returns: {
          audit_type: string
          detail: string
          free_stock: number
          inventory_id: string
          ledger_available_stock: number
          ledger_reserved_stock: number
          product_variant_id: string
          recorded_available_stock: number
          recorded_reserved_stock: number
          safety_stock: number
          service_area_id: string
        }[]
      }
      cancel_customer_cod_order: {
        Args: { p_order_id: string }
        Returns: {
          order_id: string
          resulting_status: Database["public"]["Enums"]["order_status_enum"]
          was_already_cancelled: boolean
        }[]
      }
      cancel_subscription: {
        Args: { p_reason?: string; p_subscription_id: string }
        Returns: {
          subscription_id: string
          subscription_status: Database["public"]["Enums"]["subscription_status_enum"]
          was_replayed: boolean
        }[]
      }
      change_subscription_item_vendor: {
        Args: {
          p_effective_from: string
          p_idempotency_key: string
          p_new_vendor_id: string
          p_subscription_id: string
          p_subscription_item_id: string
        }
        Returns: {
          effective_from: string
          new_vendor_id: string
          old_vendor_id: string
          subscription_id: string
          subscription_item_id: string
          was_replayed: boolean
        }[]
      }
      complete_subscription_delivery: {
        Args: { p_delivery_id: string }
        Returns: {
          delivery_id: string
          delivery_status: Database["public"]["Enums"]["delivery_status_enum"]
          was_replayed: boolean
        }[]
      }
      correct_delivery_cash_handover: {
        Args: {
          p_corrected_received_amount_paise: number
          p_evidence_reference?: string | null
          p_handover_id: string
          p_reason: string
        }
        Returns: {
          expected_amount_paise: number
          handover_id: string
          handover_status: string
          received_amount_paise: number
          was_replayed: boolean
        }[]
      }
      create_cod_order: {
        Args: {
          p_address_id: string
          p_delivery_date: string
          p_delivery_notes?: string | null
          p_delivery_slot_id: string
          p_idempotency_key: string
        }
        Returns: {
          order_id: string
          order_number: string
          total_paise: number
          was_replayed: boolean
        }[]
      }
      create_subscription_payment_intent: {
        Args: {
          p_address_id: string
          p_delivery_slot_id: string
          p_idempotency_key: string
          p_items: Json
          p_plan_type: Database["public"]["Enums"]["subscription_plan_enum"]
          p_start_date: string
        }
        Returns: {
          amount_paise: number
          payment_id: string
          subscription_id: string
          subscription_number: string
          subscription_status: Database["public"]["Enums"]["subscription_status_enum"]
          was_replayed: boolean
        }[]
      }
      fail_subscription_delivery: {
        Args: { p_delivery_id: string; p_reason: string }
        Returns: {
          delivery_id: string
          delivery_status: Database["public"]["Enums"]["delivery_status_enum"]
          was_replayed: boolean
        }[]
      }
      generate_subscription_deliveries: {
        Args: { p_delivery_date: string }
        Returns: {
          generated_count: number
          replayed_count: number
          skipped_count: number
        }[]
      }
      get_admin_cod_collection: {
        Args: { p_order_id: string }
        Returns: {
          amount_collected_paise: number
          collected_at: string
          collected_by_staff_id: string
          collection_id: string
          collection_notes: string
          collection_status: string
          order_id: string
          receipt_reference: string
          rejected_at: string
          rejected_by_manager_id: string
          rejection_reason: string
          verified_at: string
          verified_by_manager_id: string
        }[]
      }
      get_admin_cod_financial_report: {
        Args: {
          p_from_date: string
          p_service_area_id?: string | null
          p_staff_id?: string | null
          p_to_date: string
        }
        Returns: {
          amount_collected_paise: number
          business_date: string
          collected_at: string
          collection_id: string
          collection_status: string
          delivery_slot: string
          handover_expected_paise: number
          handover_id: string
          handover_number: string
          handover_received_paise: number
          handover_status: string
          order_id: string
          order_number: string
          order_total_paise: number
          service_area_id: string
          service_area_name: string
          staff_id: string
          staff_name: string
          variance_paise: number
        }[]
      }
      get_auth_uid: { Args: never; Returns: string }
      get_my_unhanded_cod_collections: {
        Args: never
        Returns: {
          amount_collected_paise: number
          business_date: string
          collected_at: string
          collection_id: string
          collection_status: string
          delivery_slot: string
          delivery_slot_id: string
          order_id: string
          order_number: string
          service_area_id: string
          service_area_name: string
        }[]
      }
      get_user_roles: {
        Args: { lookup_user_id: string }
        Returns: Database["public"]["Enums"]["user_role_enum"][]
      }
      has_staff_permission: {
        Args: {
          check_permission: Database["public"]["Enums"]["staff_permission_enum"]
        }
        Returns: boolean
      }
      is_admin_or_owner: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      pause_subscription: {
        Args: { p_subscription_id: string }
        Returns: {
          subscription_id: string
          subscription_status: Database["public"]["Enums"]["subscription_status_enum"]
          was_replayed: boolean
        }[]
      }
      quote_subscription: {
        Args: {
          p_address_id: string
          p_delivery_slot_id: string
          p_items: Json
          p_plan_type: Database["public"]["Enums"]["subscription_plan_enum"]
          p_start_date: string
        }
        Returns: Json
      }
      receive_inventory_stock: {
        Args: {
          p_idempotency_key: string
          p_items: Json
          p_notes: string
          p_service_area_id: string
          p_vendor_id: string
          p_vendor_reference: string
        }
        Returns: {
          receipt_id: string
          receipt_number: string
          total_cost_paise: number
          total_units: number
          was_replayed: boolean
        }[]
      }
      record_cod_cash_collection: {
        Args: {
          p_amount_collected_paise: number
          p_collection_notes?: string | null
          p_order_id: string
          p_receipt_reference?: string | null
        }
        Returns: {
          amount_collected_paise: number
          collection_id: string
          collection_status: string
          order_id: string
          was_replayed: boolean
        }[]
      }
      resolve_cod_collection_discrepancy: {
        Args: {
          p_corrected_amount_paise: number
          p_evidence_reference?: string | null
          p_order_id: string
          p_reason: string
        }
        Returns: {
          collection_id: string
          collection_status: string
          order_id: string
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          was_replayed: boolean
        }[]
      }
      resume_subscription: {
        Args: { p_subscription_id: string }
        Returns: {
          new_end_date: string
          subscription_id: string
          subscription_status: Database["public"]["Enums"]["subscription_status_enum"]
          was_replayed: boolean
        }[]
      }
      review_cod_cash_collection: {
        Args: { p_decision: string; p_note?: string | null; p_order_id: string }
        Returns: {
          collection_id: string
          collection_status: string
          order_id: string
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          was_replayed: boolean
        }[]
      }
      review_delivery_cash_handover: {
        Args: { p_decision: string; p_handover_id: string; p_note?: string | null }
        Returns: {
          handover_id: string
          handover_status: string
          was_replayed: boolean
        }[]
      }
      set_customer_default_address: {
        Args: { p_address_id: string }
        Returns: undefined
      }
      skip_subscription_delivery: {
        Args: {
          p_idempotency_key: string
          p_reason: string
          p_skip_date: string
          p_subscription_id: string
        }
        Returns: {
          skip_date: string
          subscription_id: string
          was_replayed: boolean
        }[]
      }
      start_subscription_delivery: {
        Args: { p_delivery_id: string }
        Returns: {
          delivery_id: string
          delivery_status: Database["public"]["Enums"]["delivery_status_enum"]
          was_replayed: boolean
        }[]
      }
      submit_delivery_cash_handover: {
        Args: {
          p_collection_ids: string[]
          p_idempotency_key: string
          p_received_amount_paise: number
        }
        Returns: {
          expected_amount_paise: number
          handover_id: string
          handover_number: string
          handover_status: string
          received_amount_paise: number
          was_replayed: boolean
        }[]
      }
      sync_active_cart: { Args: { p_items: Json }; Returns: string }
      transition_one_time_cod_order: {
        Args: {
          p_next_status: Database["public"]["Enums"]["order_status_enum"]
          p_note?: string | null
          p_order_id: string
        }
        Returns: {
          order_id: string
          previous_status: Database["public"]["Enums"]["order_status_enum"]
          resulting_status: Database["public"]["Enums"]["order_status_enum"]
          was_already_applied: boolean
        }[]
      }
    }
    Enums: {
      delivery_status_enum:
        | "scheduled"
        | "assigned"
        | "out_for_delivery"
        | "delivered"
        | "skipped"
        | "failed"
      milk_type_enum: "cow" | "buffalo" | "canteen"
      order_status_enum:
        | "draft"
        | "pending_confirmation"
        | "confirmed"
        | "processing"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "failed"
      order_type_enum: "one_time" | "subscription"
      payment_status_enum:
        | "pending"
        | "authorized"
        | "captured"
        | "failed"
        | "refunded"
        | "partially_refunded"
      product_type_enum: "standard_milk" | "canteen_milk" | "grocery_dairy"
      staff_permission_enum:
        | "manage_catalogue"
        | "manage_pricing"
        | "manage_vendors"
        | "manage_inventory"
        | "assign_deliveries"
        | "manage_staff"
        | "manage_customers"
        | "view_reports"
      subscription_plan_enum: "7_day" | "30_day" | "custom"
      subscription_status_enum:
        | "active"
        | "paused"
        | "cancelled"
        | "completed"
        | "pending_payment"
      user_role_enum:
        | "owner"
        | "admin"
        | "manager"
        | "operations_staff"
        | "customer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      delivery_status_enum: [
        "scheduled",
        "assigned",
        "out_for_delivery",
        "delivered",
        "skipped",
        "failed",
      ],
      milk_type_enum: ["cow", "buffalo", "canteen"],
      order_status_enum: [
        "draft",
        "pending_confirmation",
        "confirmed",
        "processing",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "failed",
      ],
      order_type_enum: ["one_time", "subscription"],
      payment_status_enum: [
        "pending",
        "authorized",
        "captured",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      product_type_enum: ["standard_milk", "canteen_milk", "grocery_dairy"],
      staff_permission_enum: [
        "manage_catalogue",
        "manage_pricing",
        "manage_vendors",
        "manage_inventory",
        "assign_deliveries",
        "manage_staff",
        "manage_customers",
        "view_reports",
      ],
      subscription_plan_enum: ["7_day", "30_day", "custom"],
      subscription_status_enum: [
        "active",
        "paused",
        "cancelled",
        "completed",
        "pending_payment",
      ],
      user_role_enum: [
        "owner",
        "admin",
        "manager",
        "operations_staff",
        "customer",
      ],
    },
  },
} as const

// Backward-compatible domain aliases used by application services.
export type UserRole = Database["public"]["Enums"]["user_role_enum"];
export type StaffPermission = Database["public"]["Enums"]["staff_permission_enum"];
export type MilkType = Database["public"]["Enums"]["milk_type_enum"];
