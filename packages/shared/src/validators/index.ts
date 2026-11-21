import { z } from "zod";

// Pakistan CNIC Regex: 12345-1234567-1
export const CNIC_REGEX = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;
// Pakistan Mobile Phone Regex: 0300-1234567 or 03001234567 or +923001234567
export const PAK_PHONE_REGEX = /^((\+92)|(0092)|(0))?3[0-9]{2}-?[0-9]{7}$/;

// ----------------------------------------------------------------------------
// Auth
// ----------------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().optional(),
  role: z.enum(["owner", "staff"]).default("staff"),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------
export const updateSettingsSchema = z.object({
  name: z.string().min(2, "Showroom name is required"),
  address: z.string().min(5, "Address is required"),
  phoneNumbers: z.string().min(5, "Phone numbers are required"),
  email: z.string().email().optional().or(z.literal("")),
  invoicePrefix: z.string().min(1).max(10).default("INV"),
  receiptPrefix: z.string().min(1).max(10).default("REC"),
  invoiceFooterText: z.string().optional(),
  defaultWarrantyTerms: z.string().optional(),

  minDownPaymentType: z.enum(["percentage", "fixed"]).default("percentage"),
  minDownPaymentValue: z.number().int().nonnegative(),
  defaultMarkupType: z.enum(["flat", "percentage"]).default("percentage"),
  defaultMarkupValue: z.number().int().nonnegative(),
  allowedDurations: z.array(z.number().int().positive()).default([3, 6, 9, 12]),

  lateFineEnabled: z.boolean().default(false),
  lateFineType: z.enum(["fixed", "percentage"]).default("fixed"),
  lateFineAmount: z.number().int().nonnegative().default(0),
  lateFineGraceDays: z.number().int().nonnegative().default(5),

  guarantorEnabled: z.boolean().default(true),
});

// ----------------------------------------------------------------------------
// Catalog: Brands & Models
// ----------------------------------------------------------------------------
export const createBrandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
});

export const createModelSchema = z.object({
  brandId: z.string().min(1, "Brand is required"),
  name: z.string().min(1, "Model name is required"),
  variant: z.string().optional(),
  colorOptions: z.array(z.string()).default([]),
  batteryCapacity: z.string().optional(),
  rangeKm: z.number().int().positive().optional(),
  defaultSellingPrice: z.number().int().positive("Selling price must be positive integer PKR"),
});

// ----------------------------------------------------------------------------
// Suppliers
// ----------------------------------------------------------------------------
export const createSupplierSchema = z.object({
  name: z.string().min(2, "Supplier name is required"),
  phone: z.string().min(7, "Phone number is required"),
  address: z.string().optional(),
  cnic: z.string().regex(CNIC_REGEX, "CNIC must match format 12345-1234567-1").optional().or(z.literal("")),
});

export const createSupplierPaymentSchema = z.object({
  supplierId: z.string().min(1),
  amount: z.number().int().positive("Amount must be positive PKR"),
  reference: z.string().optional(),
  notes: z.string().optional(),
  transactionDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
});

// ----------------------------------------------------------------------------
// Stock-in (Single & Batch)
// ----------------------------------------------------------------------------
export const stockInUnitItemSchema = z.object({
  chassisNumber: z.string().min(3, "Chassis number is required").toUpperCase(),
  motorNumber: z.string().min(3, "Motor number is required").toUpperCase(),
  batterySerialNumbers: z.string().min(3, "Battery serial is required"),
  color: z.string().min(1, "Color is required"),
  purchaseCost: z.number().int().positive("Purchase cost must be positive PKR"),
});

export const batchStockInSchema = z.object({
  modelId: z.string().min(1, "Model is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  receivedDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  units: z.array(stockInUnitItemSchema).min(1, "At least one unit must be added"),
});

// ----------------------------------------------------------------------------
// Customers
// ----------------------------------------------------------------------------
export const customerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  fatherOrHusbandName: z.string().optional(),
  cnic: z.string().regex(CNIC_REGEX, "CNIC must follow format 12345-1234567-1"),
  phone: z.string().min(10, "Valid phone number is required"),
  address: z.string().min(5, "Address is required"),
  notes: z.string().optional(),
});

// ----------------------------------------------------------------------------
// Sales
// ----------------------------------------------------------------------------
export const guarantorSchema = z.object({
  name: z.string().min(2, "Guarantor name is required"),
  cnic: z.string().regex(CNIC_REGEX, "Guarantor CNIC must follow format 12345-1234567-1"),
  phone: z.string().min(10, "Guarantor phone is required"),
  address: z.string().min(5, "Guarantor address is required"),
});

export const createSaleSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  unitId: z.string().min(1, "Unit is required"),
  saleType: z.enum(["full_payment", "installment"]),
  saleDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),

  basePrice: z.number().int().positive("Price must be positive PKR"),
  discount: z.number().int().nonnegative().default(0),

  // Split payment support (works for both full_payment and installment down payment)
  payments: z.array(z.object({
    amount: z.number().int().positive(),
    paymentMethod: z.enum(["cash", "bank_transfer", "other"]),
    reference: z.string().optional(),
    notes: z.string().optional(),
  })).default([]),

  // Installment specific
  installmentPlan: z
    .object({
      durationMonths: z.number().int().positive(),
      downPaymentAmount: z.number().int().nonnegative(),
      markupType: z.enum(["flat", "percentage"]),
      markupValue: z.number().int().nonnegative(),
      startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
      guarantor: guarantorSchema.optional(),
    })
    .optional(),

  notes: z.string().optional(),
});

export const voidSaleSchema = z.object({
  voidReason: z.string().min(5, "A reason of at least 5 characters is required to void a sale"),
});

// ----------------------------------------------------------------------------
// Payments
// ----------------------------------------------------------------------------
export const createPaymentSchema = z.object({
  saleId: z.string().min(1, "Sale ID is required"),
  amount: z.number().int().positive("Payment amount must be positive PKR"),
  paymentDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  paymentMethod: z.enum(["cash", "bank_transfer", "other"]).default("cash"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const waiveFineSchema = z.object({
  installmentScheduleId: z.string().min(1, "Schedule ID is required"),
});
