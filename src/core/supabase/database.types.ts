export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          actor: string | null;
          at: string;
          from_status: string | null;
          id: number;
          new_data: Json | null;
          note: string | null;
          old_data: Json | null;
          record_id: string | null;
          table_name: string;
          to_status: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor?: string | null;
          at?: string;
          from_status?: string | null;
          id?: never;
          new_data?: Json | null;
          note?: string | null;
          old_data?: Json | null;
          record_id?: string | null;
          table_name: string;
          to_status?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          at?: string;
          from_status?: string | null;
          id?: never;
          new_data?: Json | null;
          note?: string | null;
          old_data?: Json | null;
          record_id?: string | null;
          table_name?: string;
          to_status?: string | null;
        };
        Relationships: [];
      };
      capacity_plans: {
        Row: {
          available_hours: number;
          created_at: string;
          created_by: string | null;
          id: string;
          month: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          available_hours: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          month: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          available_hours?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          month?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capacity_plans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_items: {
        Row: {
          code: string | null;
          created_at: string;
          created_by: string | null;
          default_cost_cents: number;
          default_pricing_mode: Database["public"]["Enums"]["pricing_mode"];
          default_pricing_pct: number | null;
          default_supplier_id: string | null;
          description: string | null;
          division_id: string | null;
          id: string;
          is_active: boolean;
          item_type: Database["public"]["Enums"]["item_type"];
          name: string;
          unit_code: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          code?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_cost_cents?: number;
          default_pricing_mode?: Database["public"]["Enums"]["pricing_mode"];
          default_pricing_pct?: number | null;
          default_supplier_id?: string | null;
          description?: string | null;
          division_id?: string | null;
          id?: string;
          is_active?: boolean;
          item_type: Database["public"]["Enums"]["item_type"];
          name: string;
          unit_code: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_cost_cents?: number;
          default_pricing_mode?: Database["public"]["Enums"]["pricing_mode"];
          default_pricing_pct?: number | null;
          default_supplier_id?: string | null;
          description?: string | null;
          division_id?: string | null;
          id?: string;
          is_active?: boolean;
          item_type?: Database["public"]["Enums"]["item_type"];
          name?: string;
          unit_code?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_items_default_supplier_id_fkey";
            columns: ["default_supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_items_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_items_unit_code_fkey";
            columns: ["unit_code"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["code"];
          },
        ];
      };
      companies: {
        Row: {
          bank_name: string | null;
          brand_name: string;
          city: string | null;
          country: string | null;
          created_at: string;
          created_by: string | null;
          dic: string | null;
          email: string | null;
          iban: string | null;
          ic_dph: string | null;
          ico: string | null;
          id: string;
          legal_name: string;
          logo_document_id: string | null;
          phone: string | null;
          registry_entry: string | null;
          street: string | null;
          swift: string | null;
          updated_at: string;
          updated_by: string | null;
          vat_payer: boolean;
          web: string | null;
          zip: string | null;
        };
        ComputedFields: never;
        Insert: {
          bank_name?: string | null;
          brand_name?: string;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          dic?: string | null;
          email?: string | null;
          iban?: string | null;
          ic_dph?: string | null;
          ico?: string | null;
          id?: string;
          legal_name: string;
          logo_document_id?: string | null;
          phone?: string | null;
          registry_entry?: string | null;
          street?: string | null;
          swift?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_payer?: boolean;
          web?: string | null;
          zip?: string | null;
        };
        Update: {
          bank_name?: string | null;
          brand_name?: string;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          dic?: string | null;
          email?: string | null;
          iban?: string | null;
          ic_dph?: string | null;
          ico?: string | null;
          id?: string;
          legal_name?: string;
          logo_document_id?: string | null;
          phone?: string | null;
          registry_entry?: string | null;
          street?: string | null;
          swift?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_payer?: boolean;
          web?: string | null;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "companies_logo_document_fk";
            columns: ["logo_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      content_blocks: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          division_id: string | null;
          id: string;
          image_document_ids: string[];
          is_active: boolean;
          job_type: Database["public"]["Enums"]["job_type"] | null;
          key: string;
          language: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          division_id?: string | null;
          id?: string;
          image_document_ids?: string[];
          is_active?: boolean;
          job_type?: Database["public"]["Enums"]["job_type"] | null;
          key: string;
          language?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          division_id?: string | null;
          id?: string;
          image_document_ids?: string[];
          is_active?: boolean;
          job_type?: Database["public"]["Enums"]["job_type"] | null;
          key?: string;
          language?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "content_blocks_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_contacts: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_id: string;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          is_primary: boolean;
          phone: string | null;
          position: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          email?: string | null;
          full_name: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          phone?: string | null;
          position?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          phone?: string | null;
          position?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_machines: {
        Row: {
          control_system: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          id: string;
          is_active: boolean;
          location: string | null;
          manufacturer: string | null;
          model: string | null;
          note: string | null;
          serial_number: string | null;
          updated_at: string;
          updated_by: string | null;
          year_built: number | null;
        };
        ComputedFields: never;
        Insert: {
          control_system?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          manufacturer?: string | null;
          model?: string | null;
          note?: string | null;
          serial_number?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          year_built?: number | null;
        };
        Update: {
          control_system?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          manufacturer?: string | null;
          model?: string | null;
          note?: string | null;
          serial_number?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          year_built?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_machines_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          billing_email: string | null;
          city: string | null;
          country: string;
          created_at: string;
          created_by: string | null;
          dic: string | null;
          ic_dph: string | null;
          ico: string | null;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["party_kind"];
          name: string;
          note: string | null;
          payment_terms_days: number | null;
          peppol_id: string | null;
          street: string | null;
          updated_at: string;
          updated_by: string | null;
          vat_payer: boolean;
          zip: string | null;
        };
        ComputedFields: never;
        Insert: {
          billing_email?: string | null;
          city?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          dic?: string | null;
          ic_dph?: string | null;
          ico?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["party_kind"];
          name: string;
          note?: string | null;
          payment_terms_days?: number | null;
          peppol_id?: string | null;
          street?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_payer?: boolean;
          zip?: string | null;
        };
        Update: {
          billing_email?: string | null;
          city?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          dic?: string | null;
          ic_dph?: string | null;
          ico?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["party_kind"];
          name?: string;
          note?: string | null;
          payment_terms_days?: number | null;
          peppol_id?: string | null;
          street?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_payer?: boolean;
          zip?: string | null;
        };
        Relationships: [];
      };
      divisions: {
        Row: {
          code: Database["public"]["Enums"]["division_code"];
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          code: Database["public"]["Enums"]["division_code"];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          code?: Database["public"]["Enums"]["division_code"];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          entity_id: string;
          entity_table: string;
          file_name: string;
          id: string;
          is_locked: boolean;
          mime_type: string;
          retention_until: string | null;
          sha256: string | null;
          size_bytes: number;
          storage_bucket: string;
          storage_path: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          created_at?: string;
          created_by?: string | null;
          entity_id: string;
          entity_table: string;
          file_name: string;
          id?: string;
          is_locked?: boolean;
          mime_type: string;
          retention_until?: string | null;
          sha256?: string | null;
          size_bytes: number;
          storage_bucket?: string;
          storage_path: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          entity_id?: string;
          entity_table?: string;
          file_name?: string;
          id?: string;
          is_locked?: boolean;
          mime_type?: string;
          retention_until?: string | null;
          sha256?: string | null;
          size_bytes?: number;
          storage_bucket?: string;
          storage_path?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      feature_flags: {
        Row: {
          created_at: string;
          created_by: string | null;
          enabled: boolean;
          key: string;
          note: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          key: string;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          key?: string;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      income_tax_brackets: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          rate_pct: number;
          revenue_from_cents: number;
          revenue_to_cents: number | null;
          source_note: string | null;
          updated_at: string;
          updated_by: string | null;
          valid_from: string;
          valid_to: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          rate_pct: number;
          revenue_from_cents: number;
          revenue_to_cents?: number | null;
          source_note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          valid_from: string;
          valid_to?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          rate_pct?: number;
          revenue_from_cents?: number;
          revenue_to_cents?: number | null;
          source_note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [];
      };
      kpi_targets: {
        Row: {
          created_at: string;
          created_by: string | null;
          direction: string;
          division_id: string | null;
          id: string;
          kpi_key: string;
          target_value: number;
          updated_at: string;
          updated_by: string | null;
          valid_from: string;
          warning_value: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          direction: string;
          division_id?: string | null;
          id?: string;
          kpi_key: string;
          target_value: number;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string;
          warning_value?: number | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          direction?: string;
          division_id?: string | null;
          id?: string;
          kpi_key?: string;
          target_value?: number;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string;
          warning_value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "kpi_targets_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
        ];
      };
      labor_rates: {
        Row: {
          bill_rate_cents: number;
          cost_rate_cents: number;
          created_at: string;
          created_by: string | null;
          id: string;
          role_id: string;
          updated_at: string;
          updated_by: string | null;
          valid_from: string;
          valid_to: string | null;
        };
        ComputedFields: never;
        Insert: {
          bill_rate_cents: number;
          cost_rate_cents: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          role_id: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_from: string;
          valid_to?: string | null;
        };
        Update: {
          bill_rate_cents?: number;
          cost_rate_cents?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          role_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "labor_rates_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "labor_roles";
            referencedColumns: ["id"];
          },
        ];
      };
      labor_roles: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      notification_recipients: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string;
          event_types: string[];
          id: string;
          is_active: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email: string;
          event_types?: string[];
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string;
          event_types?: string[];
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      number_series: {
        Row: {
          created_at: string;
          created_by: string | null;
          doc_type: Database["public"]["Enums"]["doc_type"];
          next_number: number;
          prefix: string;
          updated_at: string;
          updated_by: string | null;
          year: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          doc_type: Database["public"]["Enums"]["doc_type"];
          next_number?: number;
          prefix: string;
          updated_at?: string;
          updated_by?: string | null;
          year: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          doc_type?: Database["public"]["Enums"]["doc_type"];
          next_number?: number;
          prefix?: string;
          updated_at?: string;
          updated_by?: string | null;
          year?: number;
        };
        Relationships: [];
      };
      overhead_costs: {
        Row: {
          amount_cents: number;
          category: string;
          created_at: string;
          created_by: string | null;
          division_id: string | null;
          id: string;
          month: string;
          note: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          category: string;
          created_at?: string;
          created_by?: string | null;
          division_id?: string | null;
          id?: string;
          month: string;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          amount_cents?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          division_id?: string | null;
          id?: string;
          month?: string;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "overhead_costs_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
        ];
      };
      package_components: {
        Row: {
          component_item_id: string;
          created_at: string;
          created_by: string | null;
          package_item_id: string;
          quantity: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          component_item_id: string;
          created_at?: string;
          created_by?: string | null;
          package_item_id: string;
          quantity: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          component_item_id?: string;
          created_at?: string;
          created_by?: string | null;
          package_item_id?: string;
          quantity?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "package_components_component_item_id_fkey";
            columns: ["component_item_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "package_components_package_item_id_fkey";
            columns: ["package_item_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          is_active: boolean;
          phone: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          phone?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      resources: {
        Row: {
          bill_rate_cents: number | null;
          cost_rate_cents: number | null;
          created_at: string;
          created_by: string | null;
          expected_life_hours: number;
          id: string;
          is_active: boolean;
          kind: string | null;
          name: string;
          operating_cost_per_hour_cents: number;
          purchase_cost_cents: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          bill_rate_cents?: number | null;
          cost_rate_cents?: never;
          created_at?: string;
          created_by?: string | null;
          expected_life_hours: number;
          id?: string;
          is_active?: boolean;
          kind?: string | null;
          name: string;
          operating_cost_per_hour_cents?: number;
          purchase_cost_cents?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          bill_rate_cents?: number | null;
          cost_rate_cents?: never;
          created_at?: string;
          created_by?: string | null;
          expected_life_hours?: number;
          id?: string;
          is_active?: boolean;
          kind?: string | null;
          name?: string;
          operating_cost_per_hour_cents?: number;
          purchase_cost_cents?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      status_transitions: {
        Row: {
          created_at: string;
          created_by: string | null;
          entity_table: string;
          from_status: string;
          guard_fn: string | null;
          is_primary: boolean;
          label_sk: string;
          required_role: Database["public"]["Enums"]["app_role"];
          to_status: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          entity_table: string;
          from_status: string;
          guard_fn?: string | null;
          is_primary?: boolean;
          label_sk: string;
          required_role?: Database["public"]["Enums"]["app_role"];
          to_status: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          entity_table?: string;
          from_status?: string;
          guard_fn?: string | null;
          is_primary?: boolean;
          label_sk?: string;
          required_role?: Database["public"]["Enums"]["app_role"];
          to_status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      supplier_contacts: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          is_primary: boolean;
          phone: string | null;
          position: string | null;
          supplier_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          phone?: string | null;
          position?: string | null;
          supplier_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          phone?: string | null;
          position?: string | null;
          supplier_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          billing_email: string | null;
          categories: string[];
          city: string | null;
          country: string;
          created_at: string;
          created_by: string | null;
          dic: string | null;
          ic_dph: string | null;
          ico: string | null;
          id: string;
          is_active: boolean;
          is_foreign: boolean | null;
          kind: Database["public"]["Enums"]["party_kind"];
          name: string;
          note: string | null;
          payment_terms_days: number | null;
          peppol_id: string | null;
          street: string | null;
          updated_at: string;
          updated_by: string | null;
          vat_payer: boolean;
          zip: string | null;
        };
        ComputedFields: never;
        Insert: {
          billing_email?: string | null;
          categories?: string[];
          city?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          dic?: string | null;
          ic_dph?: string | null;
          ico?: string | null;
          id?: string;
          is_active?: boolean;
          is_foreign?: never;
          kind?: Database["public"]["Enums"]["party_kind"];
          name: string;
          note?: string | null;
          payment_terms_days?: number | null;
          peppol_id?: string | null;
          street?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_payer?: boolean;
          zip?: string | null;
        };
        Update: {
          billing_email?: string | null;
          categories?: string[];
          city?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          dic?: string | null;
          ic_dph?: string | null;
          ico?: string | null;
          id?: string;
          is_active?: boolean;
          is_foreign?: never;
          kind?: Database["public"]["Enums"]["party_kind"];
          name?: string;
          note?: string | null;
          payment_terms_days?: number | null;
          peppol_id?: string | null;
          street?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_payer?: boolean;
          zip?: string | null;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      units: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          name: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          created_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_open_items: {
        Row: {
          delivered_not_invoiced: number | null;
          invoices_overdue: number | null;
          new_inquiries: number | null;
          overdue_tasks: number | null;
          quotes_to_approve: number | null;
          visuals_waiting: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      admin_list_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          full_name: string;
          is_active: boolean;
          last_sign_in_at: string;
          roles: Database["public"]["Enums"]["app_role"][];
          user_id: string;
          verified_totp_factors: number;
        }[];
      };
      next_document_number: {
        Args: { p_doc_type: Database["public"]["Enums"]["doc_type"]; p_year?: number };
        Returns: string;
      };
      transition: {
        Args: { p_entity_table: string; p_id: string; p_note?: string; p_to_status: string };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "admin" | "manager" | "accountant" | "external";
      delivery_doc_kind: "delivery_note" | "handover_protocol" | "service_report";
      delivery_doc_status: "draft" | "issued" | "confirmed" | "cancelled";
      division_code: "AVENG" | "AGENCY";
      doc_type: "DOP" | "CP" | "ZAK" | "OD" | "PRI" | "DL" | "FA" | "ZF" | "DB" | "RFQ" | "NZ";
      email_direction: "inbound" | "outbound";
      inquiry_source: "email" | "phone" | "web" | "personal" | "other";
      inquiry_status:
        "new" | "in_progress" | "waiting_customer" | "ready_for_costing" | "closed" | "rejected";
      invoice_kind: "invoice" | "proforma" | "credit_note";
      invoice_status:
        "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";
      item_type: "goods" | "external_service" | "labor" | "resource" | "package" | "other";
      job_status:
        | "received"
        | "confirmed"
        | "planning"
        | "in_progress"
        | "ready_for_delivery"
        | "delivered"
        | "invoiced"
        | "closed"
        | "cancelled";
      job_type: "ENG" | "EVENT" | "PROMO" | "SEASON" | "SERVICE";
      party_kind: "company" | "person";
      payment_direction: "incoming" | "outgoing";
      po_status: "draft" | "sent" | "confirmed" | "partially_received" | "received" | "cancelled";
      pricing_mode: "none" | "margin" | "markup";
      quote_version_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "superseded";
      received_inv_source: "manual_pdf" | "xml_import" | "peppol_api";
      received_inv_status: "received" | "verified" | "approved_for_payment" | "paid" | "disputed";
      supplier_rfq_status: "draft" | "sent" | "quoted" | "selected" | "closed";
      task_status: "todo" | "in_progress" | "done" | "blocked";
      visual_status: "draft" | "sent" | "approved" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "manager", "accountant", "external"],
      delivery_doc_kind: ["delivery_note", "handover_protocol", "service_report"],
      delivery_doc_status: ["draft", "issued", "confirmed", "cancelled"],
      division_code: ["AVENG", "AGENCY"],
      doc_type: ["DOP", "CP", "ZAK", "OD", "PRI", "DL", "FA", "ZF", "DB", "RFQ", "NZ"],
      email_direction: ["inbound", "outbound"],
      inquiry_source: ["email", "phone", "web", "personal", "other"],
      inquiry_status: [
        "new",
        "in_progress",
        "waiting_customer",
        "ready_for_costing",
        "closed",
        "rejected",
      ],
      invoice_kind: ["invoice", "proforma", "credit_note"],
      invoice_status: ["draft", "issued", "sent", "partially_paid", "paid", "overdue", "cancelled"],
      item_type: ["goods", "external_service", "labor", "resource", "package", "other"],
      job_status: [
        "received",
        "confirmed",
        "planning",
        "in_progress",
        "ready_for_delivery",
        "delivered",
        "invoiced",
        "closed",
        "cancelled",
      ],
      job_type: ["ENG", "EVENT", "PROMO", "SEASON", "SERVICE"],
      party_kind: ["company", "person"],
      payment_direction: ["incoming", "outgoing"],
      po_status: ["draft", "sent", "confirmed", "partially_received", "received", "cancelled"],
      pricing_mode: ["none", "margin", "markup"],
      quote_version_status: [
        "draft",
        "pending_approval",
        "approved",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "superseded",
      ],
      received_inv_source: ["manual_pdf", "xml_import", "peppol_api"],
      received_inv_status: ["received", "verified", "approved_for_payment", "paid", "disputed"],
      supplier_rfq_status: ["draft", "sent", "quoted", "selected", "closed"],
      task_status: ["todo", "in_progress", "done", "blocked"],
      visual_status: ["draft", "sent", "approved", "rejected"],
    },
  },
} as const;
