import { sql, relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

// ============================================================================
// 1. SHOWROOMS & SETTINGS (Customizable Profile & Invoice Config)
// ============================================================================
export const showrooms = sqliteTable("showrooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logoR2Key: text("logo_r2_key"),
  address: text("address").notNull(),
  phoneNumbers: text("phone_numbers").notNull(), // Comma-separated or JSON
  email: text("email"),

  // A4 Invoice & Document Customization
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  receiptPrefix: text("receipt_prefix").notNull().default("REC"),
  invoiceFooterText: text("invoice_footer_text"),
  defaultWarrantyTerms: text("default_warranty_terms"),

  // Installment Rules & Policies
  minDownPaymentType: text("min_down_payment_type", { enum: ["percentage", "fixed"] })
    .notNull()
    .default("percentage"),
  minDownPaymentValue: integer("min_down_payment_value").notNull().default(20), // 20% or flat PKR
  defaultMarkupType: text("default_markup_type", { enum: ["flat", "percentage"] })
    .notNull()
    .default("percentage"),
  defaultMarkupValue: integer("default_markup_value").notNull().default(15), // e.g. 15% or flat PKR
  allowedDurations: text("allowed_durations").notNull().default("[3,6,9,12]"), // JSON array of months

  // Late Fine Configuration
  lateFineEnabled: integer("late_fine_enabled", { mode: "boolean" }).notNull().default(false),
  lateFineType: text("late_fine_type", { enum: ["fixed", "percentage"] }).default("fixed"),
  lateFineAmount: integer("late_fine_amount").default(0), // PKR integer or percentage basis points
  lateFineGraceDays: integer("late_fine_grace_days").notNull().default(5),

  // Guarantor Requirement
  guarantorEnabled: integer("guarantor_enabled", { mode: "boolean" }).notNull().default(true),

  // High Discount Threshold for Reporting (Percentage, default 10%)
  highDiscountThresholdPercent: integer("high_discount_threshold_percent").notNull().default(10),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// ============================================================================
// 2. USERS & SESSIONS
// ============================================================================
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["owner", "staff"] }).notNull().default("staff"),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    emailShowroomUnique: uniqueIndex("idx_users_email_showroom").on(table.showroomId, table.email),
  })
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    userSessionIdx: index("idx_sessions_user").on(table.userId),
    expiresIdx: index("idx_sessions_expires").on(table.expiresAt),
  })
);

// ============================================================================
// 3. CATALOG & SUPPLIERS
// ============================================================================
export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  showroomId: text("showroom_id")
    .notNull()
    .references(() => showrooms.id),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const models = sqliteTable("models", {
  id: text("id").primaryKey(),
  showroomId: text("showroom_id")
    .notNull()
    .references(() => showrooms.id),
  brandId: text("brand_id")
    .notNull()
    .references(() => brands.id),
  name: text("name").notNull(),
  variant: text("variant"),
  colorOptions: text("color_options").notNull().default("[]"), // JSON string array
  batteryCapacity: text("battery_capacity"), // e.g. "72V 32Ah"
  rangeKm: integer("range_km"), // e.g. 80
  defaultSellingPrice: integer("default_selling_price").notNull(), // Integer PKR
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  showroomId: text("showroom_id")
    .notNull()
    .references(() => showrooms.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  cnic: text("cnic"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const supplierTransactions = sqliteTable("supplier_transactions", {
  id: text("id").primaryKey(),
  showroomId: text("showroom_id")
    .notNull()
    .references(() => showrooms.id),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  type: text("type", { enum: ["purchase", "payment"] }).notNull(),
  amount: integer("amount").notNull(), // Integer PKR
  accountId: text("account_id"), // Linked account for payment outflow
  reference: text("reference"),
  notes: text("notes"),
  transactionDate: integer("transaction_date", { mode: "timestamp" }).notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// ============================================================================
// 4. INVENTORY UNITS
// ============================================================================
export const units = sqliteTable(
  "units",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    chassisNumber: text("chassis_number").notNull(),
    motorNumber: text("motor_number").notNull(),
    batterySerialNumbers: text("battery_serial_numbers").notNull(),
    color: text("color").notNull(),
    purchaseCost: integer("purchase_cost").notNull(), // Integer PKR (restricted to owner)
    status: text("status", { enum: ["in_stock", "sold", "returned"] })
      .notNull()
      .default("in_stock"),
    receivedDate: integer("received_date", { mode: "timestamp" }).notNull(),
    soldAt: integer("sold_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    chassisShowroomUnique: uniqueIndex("idx_units_chassis_showroom").on(table.showroomId, table.chassisNumber),
    statusIdx: index("idx_units_status").on(table.showroomId, table.status),
  })
);

// ============================================================================
// 5. CUSTOMERS
// ============================================================================
export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    name: text("name").notNull(),
    fatherOrHusbandName: text("father_or_husband_name"),
    cnic: text("cnic").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    cnicFrontR2Key: text("cnic_front_r2_key"),
    cnicBackR2Key: text("cnic_back_r2_key"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    cnicShowroomUnique: uniqueIndex("idx_customers_cnic_showroom").on(table.showroomId, table.cnic),
    phoneIdx: index("idx_customers_phone").on(table.showroomId, table.phone),
  })
);

// ============================================================================
// 6. COUNTERS & SALES
// ============================================================================
export const counters = sqliteTable(
  "counters",
  {
    id: text("id").primaryKey(), // e.g. "invoice_2026", "receipt_2026"
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    type: text("type", { enum: ["invoice", "receipt"] }).notNull(),
    year: integer("year").notNull(),
    lastSequence: integer("last_sequence").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    counterUnique: uniqueIndex("idx_counters_type_year").on(table.showroomId, table.type, table.year),
  })
);

export const sales = sqliteTable(
  "sales",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    invoiceNumber: text("invoice_number").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    unitId: text("unit_id")
      .notNull()
      .references(() => units.id),
    saleType: text("sale_type", { enum: ["full_payment", "installment"] }).notNull(),
    saleDate: integer("sale_date", { mode: "timestamp" }).notNull(),

    // Financial Values (All in Integer PKR)
    basePrice: integer("base_price").notNull(),
    discount: integer("discount").notNull().default(0),
    markupAmount: integer("markup_amount").notNull().default(0),
    totalAmount: integer("total_amount").notNull(),
    downPaymentAmount: integer("down_payment_amount").notNull().default(0),

    // Immutable Snapshots
    customerNameSnap: text("customer_name_snap").notNull(),
    customerCnicSnap: text("customer_cnic_snap").notNull(),
    customerPhoneSnap: text("customer_phone_snap").notNull(),
    customerAddressSnap: text("customer_address_snap").notNull(),

    unitBrandSnap: text("unit_brand_snap").notNull(),
    unitModelSnap: text("unit_model_snap").notNull(),
    unitVariantSnap: text("unit_variant_snap"),
    unitColorSnap: text("unit_color_snap").notNull(),
    unitChassisSnap: text("unit_chassis_snap").notNull(),
    unitMotorSnap: text("unit_motor_snap").notNull(),
    unitBatterySnap: text("unit_battery_snap").notNull(),

    // Guarantor Snapshot
    guarantorName: text("guarantor_name"),
    guarantorCnic: text("guarantor_cnic"),
    guarantorPhone: text("guarantor_phone"),
    guarantorAddress: text("guarantor_address"),
    guarantorCnicR2Key: text("guarantor_cnic_r2_key"),

    // Void Auditing
    isVoided: integer("is_voided", { mode: "boolean" }).notNull().default(false),
    voidReason: text("void_reason"),
    voidedBy: text("voided_by").references(() => users.id),
    voidedAt: integer("voided_at", { mode: "timestamp" }),

    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    invoiceShowroomUnique: uniqueIndex("idx_sales_invoice_showroom").on(table.showroomId, table.invoiceNumber),
    customerIdx: index("idx_sales_customer").on(table.showroomId, table.customerId),
    unitIdx: index("idx_sales_unit").on(table.unitId),
  })
);

// ============================================================================
// 7. INSTALLMENTS & PAYMENT ALLOCATION
// ============================================================================
export const installmentPlans = sqliteTable("installment_plans", {
  id: text("id").primaryKey(),
  showroomId: text("showroom_id")
    .notNull()
    .references(() => showrooms.id),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  durationMonths: integer("duration_months").notNull(),
  monthlyInstallmentAmount: integer("monthly_installment_amount").notNull(),
  markupType: text("markup_type", { enum: ["flat", "percentage"] }).notNull(),
  markupRate: integer("markup_rate").notNull(),
  markupAmount: integer("markup_amount").notNull(),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const installmentSchedules = sqliteTable(
  "installment_schedules",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    installmentPlanId: text("installment_plan_id")
      .notNull()
      .references(() => installmentPlans.id, { onDelete: "cascade" }),
    installmentNumber: integer("installment_number").notNull(),
    dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
    amount: integer("amount").notNull(),
    fineAmount: integer("fine_amount").notNull().default(0),
    fineWaived: integer("fine_waived", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["pending", "partially_paid", "paid", "overdue"] })
      .notNull()
      .default("pending"),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    dueStatusIdx: index("idx_installment_schedule_due").on(table.showroomId, table.status, table.dueDate),
  })
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id),
    receiptNumber: text("receipt_number").notNull(),
    accountId: text("account_id"), // Destination account receiving payment
    paymentDate: integer("payment_date", { mode: "timestamp" }).notNull(),
    amount: integer("amount").notNull(),
    paymentMethod: text("payment_method", { enum: ["cash", "bank_transfer", "other"] }).notNull(),
    reference: text("reference"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    receiptShowroomUnique: uniqueIndex("idx_payments_receipt_showroom").on(table.showroomId, table.receiptNumber),
    salePaymentsIdx: index("idx_payments_sale").on(table.saleId),
  })
);

export const paymentAllocations = sqliteTable("payment_allocations", {
  id: text("id").primaryKey(),
  showroomId: text("showroom_id")
    .notNull()
    .references(() => showrooms.id),
  paymentId: text("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "cascade" }),
  installmentScheduleId: text("installment_schedule_id")
    .notNull()
    .references(() => installmentSchedules.id),
  allocatedAmount: integer("allocated_amount").notNull(),
  fineAllocatedAmount: integer("fine_allocated_amount").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// ============================================================================
// 8. AUDIT LOGS
// ============================================================================
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    userId: text("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    details: text("details"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    showroomActionIdx: index("idx_audit_logs_action").on(table.showroomId, table.action, table.createdAt),
  })
);

// ============================================================================
// 9. ACCOUNTS & FINANCIAL LEDGER
// ============================================================================
export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    name: text("name").notNull(),
    type: text("type", { enum: ["cash", "bank", "mobile_wallet", "other"] }).notNull(),
    bankName: text("bank_name"),
    accountTitle: text("account_title"),
    accountNumber: text("account_number"),
    openingBalance: integer("opening_balance").notNull().default(0), // Integer PKR
    openingDate: integer("opening_date", { mode: "timestamp" }).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    showroomNameUnique: uniqueIndex("idx_accounts_showroom_name").on(table.showroomId, table.name),
  })
);

export const accountTransactions = sqliteTable(
  "account_transactions",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    date: integer("date", { mode: "timestamp" }).notNull(),
    direction: text("direction", { enum: ["in", "out"] }).notNull(),
    amount: integer("amount").notNull(), // Integer PKR, always positive
    type: text("type", {
      enum: [
        "customer_payment",
        "supplier_payment",
        "expense",
        "transfer",
        "owner_investment",
        "owner_withdrawal",
        "adjustment",
      ],
    }).notNull(),
    category: text("category"), // e.g. "Down Payment", "Installment", "Rent", "Supplier Bill"
    referenceType: text("reference_type", {
      enum: [
        "payment",
        "supplier_transaction",
        "expense",
        "transfer",
        "reconciliation",
        "owner_equity",
      ],
    }),
    referenceId: text("reference_id"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    reversesId: text("reverses_id"), // Self reference for reversing entries
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    accountDateIdx: index("idx_acc_tx_account_date").on(table.showroomId, table.accountId, table.date),
    idempotencyIdx: uniqueIndex("idx_acc_tx_idempotent")
      .on(table.showroomId, table.referenceType, table.referenceId, table.type)
      .where(sql`${table.reversesId} IS NULL`),
  })
);

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  showroomId: text("showroom_id")
    .notNull()
    .references(() => showrooms.id),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  category: text("category").notNull(),
  amount: integer("amount").notNull(), // Integer PKR
  date: integer("date", { mode: "timestamp" }).notNull(),
  notes: text("notes"),
  receiptR2Key: text("receipt_r2_key"),
  isVoided: integer("is_voided", { mode: "boolean" }).notNull().default(false),
  voidReason: text("void_reason"),
  voidedBy: text("voided_by").references(() => users.id),
  voidedAt: integer("voided_at", { mode: "timestamp" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const expenseCategories = sqliteTable("expense_categories", {
  id: text("id").primaryKey(),
  showroomId: text("showroom_id")
    .notNull()
    .references(() => showrooms.id),
  name: text("name").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const accountTransfers = sqliteTable("account_transfers", {
  id: text("id").primaryKey(),
  showroomId: text("showroom_id")
    .notNull()
    .references(() => showrooms.id),
  fromAccountId: text("from_account_id")
    .notNull()
    .references(() => accounts.id),
  toAccountId: text("to_account_id")
    .notNull()
    .references(() => accounts.id),
  amount: integer("amount").notNull(), // Integer PKR
  date: integer("date", { mode: "timestamp" }).notNull(),
  notes: text("notes"),
  fromTransactionId: text("from_transaction_id"),
  toTransactionId: text("to_transaction_id"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// ============================================================================
// RELATIONS
// ============================================================================
export const showroomsRelations = relations(showrooms, ({ many }) => ({
  users: many(users),
  brands: many(brands),
  models: many(models),
  units: many(units),
  customers: many(customers),
  sales: many(sales),
  suppliers: many(suppliers),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  showroom: one(showrooms, {
    fields: [users.showroomId],
    references: [showrooms.id],
  }),
  sessions: many(sessions),
  sales: many(sales),
  payments: many(payments),
}));

export const modelsRelations = relations(models, ({ one, many }) => ({
  brand: one(brands, {
    fields: [models.brandId],
    references: [brands.id],
  }),
  units: many(units),
}));

export const unitsRelations = relations(units, ({ one }) => ({
  model: one(models, {
    fields: [units.modelId],
    references: [models.id],
  }),
  supplier: one(suppliers, {
    fields: [units.supplierId],
    references: [suppliers.id],
  }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  unit: one(units, {
    fields: [sales.unitId],
    references: [units.id],
  }),
  creator: one(users, {
    fields: [sales.createdBy],
    references: [users.id],
  }),
  installmentPlan: one(installmentPlans, {
    fields: [sales.id],
    references: [installmentPlans.saleId],
  }),
  payments: many(payments),
}));

export const installmentPlansRelations = relations(installmentPlans, ({ one, many }) => ({
  sale: one(sales, {
    fields: [installmentPlans.saleId],
    references: [sales.id],
  }),
  schedules: many(installmentSchedules),
}));

export const installmentSchedulesRelations = relations(installmentSchedules, ({ one, many }) => ({
  plan: one(installmentPlans, {
    fields: [installmentSchedules.installmentPlanId],
    references: [installmentPlans.id],
  }),
  allocations: many(paymentAllocations),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  sale: one(sales, {
    fields: [payments.saleId],
    references: [sales.id],
  }),
  creator: one(users, {
    fields: [payments.createdBy],
    references: [users.id],
  }),
  allocations: many(paymentAllocations),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentAllocations.paymentId],
    references: [payments.id],
  }),
  schedule: one(installmentSchedules, {
    fields: [paymentAllocations.installmentScheduleId],
    references: [installmentSchedules.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  showroom: one(showrooms, {
    fields: [accounts.showroomId],
    references: [showrooms.id],
  }),
  transactions: many(accountTransactions),
  expenses: many(expenses),
}));

export const accountTransactionsRelations = relations(accountTransactions, ({ one }) => ({
  account: one(accounts, {
    fields: [accountTransactions.accountId],
    references: [accounts.id],
  }),
  creator: one(users, {
    fields: [accountTransactions.createdBy],
    references: [users.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  account: one(accounts, {
    fields: [expenses.accountId],
    references: [accounts.id],
  }),
  creator: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
  }),
}));

export const accountTransfersRelations = relations(accountTransfers, ({ one }) => ({
  fromAccount: one(accounts, {
    fields: [accountTransfers.fromAccountId],
    references: [accounts.id],
  }),
  toAccount: one(accounts, {
    fields: [accountTransfers.toAccountId],
    references: [accounts.id],
  }),
  creator: one(users, {
    fields: [accountTransfers.createdBy],
    references: [users.id],
  }),
}));
