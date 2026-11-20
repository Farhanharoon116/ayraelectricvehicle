-- Migration 0000_initial_schema.sql
-- Cloudflare D1 Initial Migration for AEV Management System

CREATE TABLE IF NOT EXISTS `showrooms` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `logo_r2_key` text,
  `address` text NOT NULL,
  `phone_numbers` text NOT NULL,
  `email` text,
  `invoice_prefix` text DEFAULT 'INV' NOT NULL,
  `receipt_prefix` text DEFAULT 'REC' NOT NULL,
  `invoice_footer_text` text,
  `default_warranty_terms` text,
  `min_down_payment_type` text DEFAULT 'percentage' NOT NULL,
  `min_down_payment_value` integer DEFAULT 20 NOT NULL,
  `default_markup_type` text DEFAULT 'percentage' NOT NULL,
  `default_markup_value` integer DEFAULT 15 NOT NULL,
  `allowed_durations` text DEFAULT '[3,6,9,12]' NOT NULL,
  `late_fine_enabled` integer DEFAULT 0 NOT NULL,
  `late_fine_type` text DEFAULT 'fixed',
  `late_fine_amount` integer DEFAULT 0,
  `late_fine_grace_days` integer DEFAULT 5 NOT NULL,
  `guarantor_enabled` integer DEFAULT 1 NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `email` text NOT NULL,
  `password_hash` text NOT NULL,
  `role` text DEFAULT 'staff' NOT NULL,
  `full_name` text NOT NULL,
  `phone` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_users_email_showroom` ON `users` (`showroom_id`, `email`);

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `expires_at` integer NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_sessions_user` ON `sessions` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_sessions_expires` ON `sessions` (`expires_at`);

CREATE TABLE IF NOT EXISTS `brands` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `name` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS `models` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `brand_id` text NOT NULL REFERENCES `brands`(`id`),
  `name` text NOT NULL,
  `variant` text,
  `color_options` text DEFAULT '[]' NOT NULL,
  `battery_capacity` text,
  `range_km` integer,
  `default_selling_price` integer NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `name` text NOT NULL,
  `phone` text NOT NULL,
  `address` text,
  `cnic` text,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS `supplier_transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `supplier_id` text NOT NULL REFERENCES `suppliers`(`id`),
  `type` text NOT NULL,
  `amount` integer NOT NULL,
  `reference` text,
  `notes` text,
  `transaction_date` integer NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS `units` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `model_id` text NOT NULL REFERENCES `models`(`id`),
  `supplier_id` text NOT NULL REFERENCES `suppliers`(`id`),
  `chassis_number` text NOT NULL,
  `motor_number` text NOT NULL,
  `battery_serial_numbers` text NOT NULL,
  `color` text NOT NULL,
  `purchase_cost` integer NOT NULL,
  `status` text DEFAULT 'in_stock' NOT NULL,
  `received_date` integer NOT NULL,
  `sold_at` integer,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_units_chassis_showroom` ON `units` (`showroom_id`, `chassis_number`);
CREATE INDEX IF NOT EXISTS `idx_units_status` ON `units` (`showroom_id`, `status`);

CREATE TABLE IF NOT EXISTS `customers` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `name` text NOT NULL,
  `father_or_husband_name` text,
  `cnic` text NOT NULL,
  `phone` text NOT NULL,
  `address` text NOT NULL,
  `cnic_front_r2_key` text,
  `cnic_back_r2_key` text,
  `notes` text,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_customers_cnic_showroom` ON `customers` (`showroom_id`, `cnic`);
CREATE INDEX IF NOT EXISTS `idx_customers_phone` ON `customers` (`showroom_id`, `phone`);

CREATE TABLE IF NOT EXISTS `counters` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `type` text NOT NULL,
  `year` integer NOT NULL,
  `last_sequence` integer DEFAULT 0 NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_counters_type_year` ON `counters` (`showroom_id`, `type`, `year`);

CREATE TABLE IF NOT EXISTS `sales` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `invoice_number` text NOT NULL,
  `customer_id` text NOT NULL REFERENCES `customers`(`id`),
  `unit_id` text NOT NULL REFERENCES `units`(`id`),
  `sale_type` text NOT NULL,
  `sale_date` integer NOT NULL,
  `base_price` integer NOT NULL,
  `discount` integer DEFAULT 0 NOT NULL,
  `markup_amount` integer DEFAULT 0 NOT NULL,
  `total_amount` integer NOT NULL,
  `down_payment_amount` integer DEFAULT 0 NOT NULL,
  `customer_name_snap` text NOT NULL,
  `customer_cnic_snap` text NOT NULL,
  `customer_phone_snap` text NOT NULL,
  `customer_address_snap` text NOT NULL,
  `unit_brand_snap` text NOT NULL,
  `unit_model_snap` text NOT NULL,
  `unit_variant_snap` text,
  `unit_color_snap` text NOT NULL,
  `unit_chassis_snap` text NOT NULL,
  `unit_motor_snap` text NOT NULL,
  `unit_battery_snap` text NOT NULL,
  `guarantor_name` text,
  `guarantor_cnic` text,
  `guarantor_phone` text,
  `guarantor_address` text,
  `guarantor_cnic_r2_key` text,
  `is_voided` integer DEFAULT 0 NOT NULL,
  `void_reason` text,
  `voided_by` text REFERENCES `users`(`id`),
  `voided_at` integer,
  `notes` text,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_sales_invoice_showroom` ON `sales` (`showroom_id`, `invoice_number`);
CREATE INDEX IF NOT EXISTS `idx_sales_customer` ON `sales` (`showroom_id`, `customer_id`);
CREATE INDEX IF NOT EXISTS `idx_sales_unit` ON `sales` (`unit_id`);

CREATE TABLE IF NOT EXISTS `installment_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `sale_id` text NOT NULL REFERENCES `sales`(`id`) ON DELETE CASCADE,
  `duration_months` integer NOT NULL,
  `monthly_installment_amount` integer NOT NULL,
  `markup_type` text NOT NULL,
  `markup_rate` integer NOT NULL,
  `markup_amount` integer NOT NULL,
  `start_date` integer NOT NULL,
  `end_date` integer NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS `installment_schedules` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `installment_plan_id` text NOT NULL REFERENCES `installment_plans`(`id`) ON DELETE CASCADE,
  `installment_number` integer NOT NULL,
  `due_date` integer NOT NULL,
  `amount` integer NOT NULL,
  `fine_amount` integer DEFAULT 0 NOT NULL,
  `fine_waived` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `paid_at` integer,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_installment_schedule_due` ON `installment_schedules` (`showroom_id`, `status`, `due_date`);

CREATE TABLE IF NOT EXISTS `payments` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `sale_id` text NOT NULL REFERENCES `sales`(`id`),
  `receipt_number` text NOT NULL,
  `payment_date` integer NOT NULL,
  `amount` integer NOT NULL,
  `payment_method` text NOT NULL,
  `reference` text,
  `notes` text,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_payments_receipt_showroom` ON `payments` (`showroom_id`, `receipt_number`);
CREATE INDEX IF NOT EXISTS `idx_payments_sale` ON `payments` (`sale_id`);

CREATE TABLE IF NOT EXISTS `payment_allocations` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `payment_id` text NOT NULL REFERENCES `payments`(`id`) ON DELETE CASCADE,
  `installment_schedule_id` text NOT NULL REFERENCES `installment_schedules`(`id`),
  `allocated_amount` integer NOT NULL,
  `fine_allocated_amount` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `user_id` text REFERENCES `users`(`id`),
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `details` text,
  `ip_address` text,
  `user_agent` text,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_action` ON `audit_logs` (`showroom_id`, `action`, `created_at`);
