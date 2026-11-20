import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  showrooms,
  users,
  sessions,
  brands,
  models,
  suppliers,
  supplierTransactions,
  units,
  customers,
  counters,
  sales,
  installmentPlans,
  installmentSchedules,
  payments,
  paymentAllocations,
  auditLogs,
} from "../db/schema";

export type Showroom = InferSelectModel<typeof showrooms>;
export type InsertShowroom = InferInsertModel<typeof showrooms>;

export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;
export type UserRole = "owner" | "staff";

export type Session = InferSelectModel<typeof sessions>;
export type InsertSession = InferInsertModel<typeof sessions>;

export type Brand = InferSelectModel<typeof brands>;
export type InsertBrand = InferInsertModel<typeof brands>;

export type Model = InferSelectModel<typeof models>;
export type InsertModel = InferInsertModel<typeof models>;

export type Supplier = InferSelectModel<typeof suppliers>;
export type InsertSupplier = InferInsertModel<typeof suppliers>;

export type SupplierTransaction = InferSelectModel<typeof supplierTransactions>;
export type InsertSupplierTransaction = InferInsertModel<typeof supplierTransactions>;

export type Unit = InferSelectModel<typeof units>;
export type InsertUnit = InferInsertModel<typeof units>;
export type UnitStatus = "in_stock" | "sold" | "returned";

export type Customer = InferSelectModel<typeof customers>;
export type InsertCustomer = InferInsertModel<typeof customers>;

export type Counter = InferSelectModel<typeof counters>;
export type InsertCounter = InferInsertModel<typeof counters>;

export type Sale = InferSelectModel<typeof sales>;
export type InsertSale = InferInsertModel<typeof sales>;
export type SaleType = "full_payment" | "installment";

export type InstallmentPlan = InferSelectModel<typeof installmentPlans>;
export type InsertInstallmentPlan = InferInsertModel<typeof installmentPlans>;

export type InstallmentSchedule = InferSelectModel<typeof installmentSchedules>;
export type InsertInstallmentSchedule = InferInsertModel<typeof installmentSchedules>;
export type InstallmentStatus = "pending" | "partially_paid" | "paid" | "overdue";

export type Payment = InferSelectModel<typeof payments>;
export type InsertPayment = InferInsertModel<typeof payments>;
export type PaymentMethod = "cash" | "bank_transfer" | "other";

export type PaymentAllocation = InferSelectModel<typeof paymentAllocations>;
export type InsertPaymentAllocation = InferInsertModel<typeof paymentAllocations>;

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type InsertAuditLog = InferInsertModel<typeof auditLogs>;

// Auth context
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  showroomId: string;
}

// Financial / Presentation Helpers
export interface ComputedSaleSummary {
  sale: Sale;
  customer: Customer;
  unit: Unit;
  totalPaid: number;
  remainingBalance: number;
  payments: Payment[];
  installmentPlan?: (InstallmentPlan & { schedules: InstallmentSchedule[] }) | null;
}
