import { hashPassword } from "../lib/auth";

declare const process: any;

export const SEED_DATA = {
  showroom: {
    id: "showroom_default_01",
    name: "AEV Motors Showroom",
    address: "Main Boulevard, Gulberg III, Lahore, Pakistan",
    phoneNumbers: "0300-1234567, 042-35789000",
    email: "contact@aevmotors.pk",
    invoicePrefix: "INV",
    receiptPrefix: "REC",
    invoiceFooterText: "Thank you for choosing AEV Motors! Drive green, save fuel.",
    defaultWarrantyTerms: "1 Year Battery Warranty, 2 Years Motor Warranty. Physical damage or water submersion voids warranty.",
    minDownPaymentType: "percentage" as const,
    minDownPaymentValue: 20,
    defaultMarkupType: "percentage" as const,
    defaultMarkupValue: 15,
    allowedDurations: "[3,6,9,12]",
    lateFineEnabled: true,
    lateFineType: "fixed" as const,
    lateFineAmount: 500,
    lateFineGraceDays: 5,
    guarantorEnabled: true,
  },
  owner: {
    id: "user_owner_01",
    email: "owner@aevmotors.pk",
    fullName: "Ahmed Khan (Owner)",
    phone: "0300-1234567",
    role: "owner" as const,
    plainPassword: "password123",
  },
  staff: {
    id: "user_staff_01",
    email: "staff@aevmotors.pk",
    fullName: "Bilal Tariq (Sales Staff)",
    phone: "0321-7654321",
    role: "staff" as const,
    plainPassword: "password123",
  },
  brands: [
    { id: "brand_yadea", name: "Yadea" },
    { id: "brand_metro", name: "Metro E-Bikes" },
    { id: "brand_superstar", name: "Super Star EV" },
  ],
  models: [
    {
      id: "model_yadea_t9",
      brandId: "brand_yadea",
      name: "T9",
      variant: "72V 32Ah Graphene",
      colorOptions: JSON.stringify(["Black", "Pearl White", "Matte Grey", "Navy Blue"]),
      batteryCapacity: "72V 32Ah TTFAR Graphene",
      rangeKm: 95,
      defaultSellingPrice: 285000,
    },
    {
      id: "model_yadea_g5",
      brandId: "brand_yadea",
      name: "G5 Pro",
      variant: "Lithium Ion Fast Charge",
      colorOptions: JSON.stringify(["Titanium Silver", "Pearl White"]),
      batteryCapacity: "60V 32Ah Panasonic Lithium",
      rangeKm: 85,
      defaultSellingPrice: 345000,
    },
    {
      id: "model_metro_e8s",
      brandId: "brand_metro",
      name: "E8S Pro",
      variant: "Dual Battery",
      colorOptions: JSON.stringify(["Glossy Red", "Black", "Arctic White"]),
      batteryCapacity: "72V 38Ah Graphene",
      rangeKm: 120,
      defaultSellingPrice: 320000,
    },
  ],
  supplier: {
    id: "supplier_apex",
    name: "Apex EV Importers Karachi",
    phone: "0333-9876543",
    address: "Port Qasim Industrial Area, Karachi",
    cnic: "42201-1234567-1",
  },
  units: [
    {
      id: "unit_001",
      modelId: "model_yadea_t9",
      supplierId: "supplier_apex",
      chassisNumber: "YAD-T9-2026-0001",
      motorNumber: "MOT-72V-89410",
      batterySerialNumbers: "BAT-GR-7232-101",
      color: "Matte Grey",
      purchaseCost: 245000,
      status: "in_stock" as const,
    },
    {
      id: "unit_002",
      modelId: "model_yadea_t9",
      supplierId: "supplier_apex",
      chassisNumber: "YAD-T9-2026-0002",
      motorNumber: "MOT-72V-89411",
      batterySerialNumbers: "BAT-GR-7232-102",
      color: "Pearl White",
      purchaseCost: 245000,
      status: "in_stock" as const,
    },
    {
      id: "unit_003",
      modelId: "model_yadea_g5",
      supplierId: "supplier_apex",
      chassisNumber: "YAD-G5-2026-0003",
      motorNumber: "MOT-60V-99120",
      batterySerialNumbers: "BAT-LI-6032-201",
      color: "Titanium Silver",
      purchaseCost: 295000,
      status: "in_stock" as const,
    },
    {
      id: "unit_004",
      modelId: "model_metro_e8s",
      supplierId: "supplier_apex",
      chassisNumber: "MET-E8S-2026-0004",
      motorNumber: "MOT-72V-77312",
      batterySerialNumbers: "BAT-GR-7238-301",
      color: "Glossy Red",
      purchaseCost: 275000,
      status: "in_stock" as const,
    },
  ],
};

export async function generateSeedSql(): Promise<string> {
  const ownerHash = await hashPassword(SEED_DATA.owner.plainPassword);
  const staffHash = await hashPassword(SEED_DATA.staff.plainPassword);
  const now = Math.floor(Date.now() / 1000);

  const lines: string[] = [];

  // 1. Showroom
  const s = SEED_DATA.showroom;
  lines.push(`INSERT OR REPLACE INTO showrooms (
    id, name, address, phone_numbers, email, invoice_prefix, receipt_prefix,
    invoice_footer_text, default_warranty_terms, min_down_payment_type, min_down_payment_value,
    default_markup_type, default_markup_value, allowed_durations, late_fine_enabled,
    late_fine_type, late_fine_amount, late_fine_grace_days, guarantor_enabled, created_at, updated_at
  ) VALUES (
    '${s.id}', '${s.name}', '${s.address}', '${s.phoneNumbers}', '${s.email}', '${s.invoicePrefix}', '${s.receiptPrefix}',
    '${s.invoiceFooterText.replace(/'/g, "''")}', '${s.defaultWarrantyTerms.replace(/'/g, "''")}', '${s.minDownPaymentType}', ${s.minDownPaymentValue},
    '${s.defaultMarkupType}', ${s.defaultMarkupValue}, '${s.allowedDurations}', ${s.lateFineEnabled ? 1 : 0},
    '${s.lateFineType}', ${s.lateFineAmount}, ${s.lateFineGraceDays}, ${s.guarantorEnabled ? 1 : 0}, ${now}, ${now}
  );`);

  // 2. Users
  lines.push(`INSERT OR REPLACE INTO users (id, showroom_id, email, password_hash, role, full_name, phone, is_active, created_at, updated_at)
  VALUES ('${SEED_DATA.owner.id}', '${s.id}', '${SEED_DATA.owner.email}', '${ownerHash}', 'owner', '${SEED_DATA.owner.fullName}', '${SEED_DATA.owner.phone}', 1, ${now}, ${now});`);

  lines.push(`INSERT OR REPLACE INTO users (id, showroom_id, email, password_hash, role, full_name, phone, is_active, created_at, updated_at)
  VALUES ('${SEED_DATA.staff.id}', '${s.id}', '${SEED_DATA.staff.email}', '${staffHash}', 'staff', '${SEED_DATA.staff.fullName}', '${SEED_DATA.staff.phone}', 1, ${now}, ${now});`);

  // 3. Brands
  for (const b of SEED_DATA.brands) {
    lines.push(`INSERT OR REPLACE INTO brands (id, showroom_id, name, created_at, updated_at)
    VALUES ('${b.id}', '${s.id}', '${b.name}', ${now}, ${now});`);
  }

  // 4. Models
  for (const m of SEED_DATA.models) {
    lines.push(`INSERT OR REPLACE INTO models (id, showroom_id, brand_id, name, variant, color_options, battery_capacity, range_km, default_selling_price, is_active, created_at, updated_at)
    VALUES ('${m.id}', '${s.id}', '${m.brandId}', '${m.name}', '${m.variant}', '${m.colorOptions}', '${m.batteryCapacity}', ${m.rangeKm}, ${m.defaultSellingPrice}, 1, ${now}, ${now});`);
  }

  // 5. Supplier
  const sup = SEED_DATA.supplier;
  lines.push(`INSERT OR REPLACE INTO suppliers (id, showroom_id, name, phone, address, cnic, created_at, updated_at)
  VALUES ('${sup.id}', '${s.id}', '${sup.name}', '${sup.phone}', '${sup.address}', '${sup.cnic}', ${now}, ${now});`);

  // 6. Units
  for (const u of SEED_DATA.units) {
    lines.push(`INSERT OR REPLACE INTO units (id, showroom_id, model_id, supplier_id, chassis_number, motor_number, battery_serial_numbers, color, purchase_cost, status, received_date, created_at, updated_at)
    VALUES ('${u.id}', '${s.id}', '${u.modelId}', '${u.supplierId}', '${u.chassisNumber}', '${u.motorNumber}', '${u.batterySerialNumbers}', '${u.color}', ${u.purchaseCost}, '${u.status}', ${now}, ${now}, ${now});`);
  }

  // 7. Counters (Initial 2026 sequences)
  const currentYear = new Date().getFullYear();
  lines.push(`INSERT OR REPLACE INTO counters (id, showroom_id, type, year, last_sequence, updated_at)
  VALUES ('cnt_inv_${currentYear}', '${s.id}', 'invoice', ${currentYear}, 0, ${now});`);
  lines.push(`INSERT OR REPLACE INTO counters (id, showroom_id, type, year, last_sequence, updated_at)
  VALUES ('cnt_rec_${currentYear}', '${s.id}', 'receipt', ${currentYear}, 0, ${now});`);

  return lines.join("\n");
}

if (process.argv[1]?.includes("seed.ts")) {
  generateSeedSql().then((sql) => {
    console.log(sql);
  });
}
