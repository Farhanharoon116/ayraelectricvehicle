-- Migration 0001_accounts_and_cash_flow.sql
-- Add Accounts, Cash Flow, Financial Ledger, Expenses, and Backfill

-- 1. Alter Existing Tables
ALTER TABLE `showrooms` ADD COLUMN `high_discount_threshold_percent` integer DEFAULT 10 NOT NULL;
ALTER TABLE `payments` ADD COLUMN `account_id` text REFERENCES `accounts`(`id`);
ALTER TABLE `supplier_transactions` ADD COLUMN `account_id` text REFERENCES `accounts`(`id`);

-- 2. Create Accounts Table
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `name` text NOT NULL,
  `type` text NOT NULL, -- 'cash' | 'bank' | 'mobile_wallet' | 'other'
  `bank_name` text,
  `account_title` text,
  `account_number` text,
  `opening_balance` integer DEFAULT 0 NOT NULL, -- Integer PKR
  `opening_date` integer NOT NULL, -- timestamp
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_accounts_showroom_name` ON `accounts` (`showroom_id`, `name`);

-- 3. Create Append-Only Account Transactions Ledger
CREATE TABLE IF NOT EXISTS `account_transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `account_id` text NOT NULL REFERENCES `accounts`(`id`),
  `date` integer NOT NULL, -- timestamp
  `direction` text NOT NULL, -- 'in' | 'out'
  `amount` integer NOT NULL, -- Integer PKR, always positive
  `type` text NOT NULL, -- 'customer_payment' | 'supplier_payment' | 'expense' | 'transfer' | 'owner_investment' | 'owner_withdrawal' | 'adjustment'
  `category` text,
  `reference_type` text, -- 'payment' | 'supplier_transaction' | 'expense' | 'transfer' | 'reconciliation' | 'owner_equity'
  `reference_id` text,
  `notes` text,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `reverses_id` text, -- self-referencing ID for reversals
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_acc_tx_account_date` ON `account_transactions` (`showroom_id`, `account_id`, `date`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_acc_tx_idempotent` ON `account_transactions` (`showroom_id`, `reference_type`, `reference_id`, `type`) WHERE `reverses_id` IS NULL;

-- 4. Create Expenses Table (Void-Only for Append-Only Ledger)
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `account_id` text NOT NULL REFERENCES `accounts`(`id`),
  `category` text NOT NULL,
  `amount` integer NOT NULL, -- Integer PKR
  `date` integer NOT NULL, -- timestamp
  `notes` text,
  `receipt_r2_key` text,
  `is_voided` integer DEFAULT 0 NOT NULL,
  `void_reason` text,
  `voided_by` text REFERENCES `users`(`id`),
  `voided_at` integer,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- 5. Create Expense Categories Table
CREATE TABLE IF NOT EXISTS `expense_categories` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `name` text NOT NULL,
  `is_default` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- 6. Create Account Transfers Table
CREATE TABLE IF NOT EXISTS `account_transfers` (
  `id` text PRIMARY KEY NOT NULL,
  `showroom_id` text NOT NULL REFERENCES `showrooms`(`id`),
  `from_account_id` text NOT NULL REFERENCES `accounts`(`id`),
  `to_account_id` text NOT NULL REFERENCES `accounts`(`id`),
  `amount` integer NOT NULL, -- Integer PKR
  `date` integer NOT NULL, -- timestamp
  `notes` text,
  `from_transaction_id` text,
  `to_transaction_id` text,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- 7. Seed Default Account ("Cash Drawer") for all showrooms
INSERT OR IGNORE INTO `accounts` (
  `id`, `showroom_id`, `name`, `type`, `opening_balance`, `opening_date`, `is_active`
)
SELECT
  'acc_cash_drawer_' || id,
  id,
  'Cash Drawer',
  'cash',
  0,
  CAST(strftime('%s', 'now') AS INTEGER),
  1
FROM `showrooms`;

-- 8. Seed Default Expense Categories
INSERT OR IGNORE INTO `expense_categories` (`id`, `showroom_id`, `name`, `is_default`)
SELECT 'cat_rent_' || id, id, 'Rent', 1 FROM `showrooms`;
INSERT OR IGNORE INTO `expense_categories` (`id`, `showroom_id`, `name`, `is_default`)
SELECT 'cat_salaries_' || id, id, 'Salaries', 1 FROM `showrooms`;
INSERT OR IGNORE INTO `expense_categories` (`id`, `showroom_id`, `name`, `is_default`)
SELECT 'cat_electricity_' || id, id, 'Electricity Bill', 1 FROM `showrooms`;
INSERT OR IGNORE INTO `expense_categories` (`id`, `showroom_id`, `name`, `is_default`)
SELECT 'cat_transport_' || id, id, 'Transport & Freight', 1 FROM `showrooms`;
INSERT OR IGNORE INTO `expense_categories` (`id`, `showroom_id`, `name`, `is_default`)
SELECT 'cat_marketing_' || id, id, 'Marketing & Ads', 1 FROM `showrooms`;
INSERT OR IGNORE INTO `expense_categories` (`id`, `showroom_id`, `name`, `is_default`)
SELECT 'cat_misc_' || id, id, 'Miscellaneous', 1 FROM `showrooms`;

-- 9. Backfill Payments -> Link to Default Account & Post Inflows to Ledger
UPDATE `payments`
SET `account_id` = 'acc_cash_drawer_' || `showroom_id`
WHERE `account_id` IS NULL;

-- Post Customer Payment Inflows into Ledger (Idempotent via unique index)
INSERT OR IGNORE INTO `account_transactions` (
  `id`, `showroom_id`, `account_id`, `date`, `direction`, `amount`,
  `type`, `category`, `reference_type`, `reference_id`, `notes`, `created_by`, `reverses_id`, `created_at`
)
SELECT
  'tx_pay_' || p.id,
  p.showroom_id,
  p.account_id,
  p.payment_date,
  'in',
  p.amount,
  'customer_payment',
  CASE WHEN s.sale_type = 'installment' THEN 'Installment Payment' ELSE 'Full Payment' END,
  'payment',
  p.id,
  'Customer payment receipt ' || p.receipt_number,
  p.created_by,
  NULL,
  CAST(strftime('%s', 'now') AS INTEGER)
FROM `payments` p
LEFT JOIN `sales` s ON p.sale_id = s.id;

-- 10. Backfill Reversals for Payments on Already-Voided Sales (Requirement 1)
INSERT OR IGNORE INTO `account_transactions` (
  `id`, `showroom_id`, `account_id`, `date`, `direction`, `amount`,
  `type`, `category`, `reference_type`, `reference_id`, `notes`, `created_by`, `reverses_id`, `created_at`
)
SELECT
  'tx_rev_pay_' || p.id,
  p.showroom_id,
  p.account_id,
  COALESCE(s.voided_at, p.payment_date),
  'out',
  p.amount,
  'adjustment',
  'Voided Sale Reversal',
  'payment',
  p.id,
  'Reversal for voided invoice ' || s.invoice_number || ' - ' || COALESCE(s.void_reason, 'Sale Voided'),
  COALESCE(s.voided_by, p.created_by),
  'tx_pay_' || p.id,
  CAST(strftime('%s', 'now') AS INTEGER)
FROM `payments` p
INNER JOIN `sales` s ON p.sale_id = s.id
WHERE s.is_voided = 1;

-- 11. Backfill Supplier Payments -> Link to Default Account & Post Outflows to Ledger
UPDATE `supplier_transactions`
SET `account_id` = 'acc_cash_drawer_' || `showroom_id`
WHERE `type` = 'payment' AND `account_id` IS NULL;

-- Post Supplier Payment Outflows into Ledger (Idempotent via unique index)
INSERT OR IGNORE INTO `account_transactions` (
  `id`, `showroom_id`, `account_id`, `date`, `direction`, `amount`,
  `type`, `category`, `reference_type`, `reference_id`, `notes`, `created_by`, `reverses_id`, `created_at`
)
SELECT
  'tx_sup_' || st.id,
  st.showroom_id,
  st.account_id,
  st.transaction_date,
  'out',
  st.amount,
  'supplier_payment',
  'Supplier Payment',
  'supplier_transaction',
  st.id,
  'Payment to supplier ' || COALESCE(st.reference, ''),
  st.created_by,
  NULL,
  CAST(strftime('%s', 'now') AS INTEGER)
FROM `supplier_transactions` st
WHERE st.type = 'payment';
