INSERT OR REPLACE INTO showrooms (
    id, name, address, phone_numbers, email, invoice_prefix, receipt_prefix,
    invoice_footer_text, default_warranty_terms, min_down_payment_type, min_down_payment_value,
    default_markup_type, default_markup_value, allowed_durations, late_fine_enabled,
    late_fine_type, late_fine_amount, late_fine_grace_days, guarantor_enabled, created_at, updated_at
  ) VALUES (
    'showroom_default_01', 'AEV Motors Showroom', 'Main Boulevard, Gulberg III, Lahore, Pakistan', '0300-1234567, 042-35789000', 'contact@aevmotors.pk', 'INV', 'REC',
    'Thank you for choosing AEV Motors! Drive green, save fuel.', '1 Year Battery Warranty, 2 Years Motor Warranty. Physical damage or water submersion voids warranty.', 'percentage', 20,
    'percentage', 15, '[3,6,9,12]', 1,
    'fixed', 500, 5, 1, 1795157230, 1795157230
  );
INSERT OR REPLACE INTO users (id, showroom_id, email, password_hash, role, full_name, phone, is_active, created_at, updated_at)
  VALUES ('user_owner_01', 'showroom_default_01', 'owner@aevmotors.pk', 'pbkdf2:e57224ba3af65e17754c9c67cb42ca5d:cc9b4bb9bbb59580a74df6606caef6a77284474355cfbdf562120c97f68d80ea', 'owner', 'Ahmed Khan (Owner)', '0300-1234567', 1, 1795157230, 1795157230);
INSERT OR REPLACE INTO users (id, showroom_id, email, password_hash, role, full_name, phone, is_active, created_at, updated_at)
  VALUES ('user_staff_01', 'showroom_default_01', 'staff@aevmotors.pk', 'pbkdf2:17590e0ec51f5d03ee94cc1ec163f8ab:eeaf5059630bd7e635a83e4ee16542173e68fdd4bed80e06197d9b753b0498cb', 'staff', 'Bilal Tariq (Sales Staff)', '0321-7654321', 1, 1795157230, 1795157230);
INSERT OR REPLACE INTO brands (id, showroom_id, name, created_at, updated_at)
    VALUES ('brand_yadea', 'showroom_default_01', 'Yadea', 1795157230, 1795157230);
INSERT OR REPLACE INTO brands (id, showroom_id, name, created_at, updated_at)
    VALUES ('brand_metro', 'showroom_default_01', 'Metro E-Bikes', 1795157230, 1795157230);
INSERT OR REPLACE INTO brands (id, showroom_id, name, created_at, updated_at)
    VALUES ('brand_superstar', 'showroom_default_01', 'Super Star EV', 1795157230, 1795157230);
INSERT OR REPLACE INTO models (id, showroom_id, brand_id, name, variant, color_options, battery_capacity, range_km, default_selling_price, is_active, created_at, updated_at)
    VALUES ('model_yadea_t9', 'showroom_default_01', 'brand_yadea', 'T9', '72V 32Ah Graphene', '["Black","Pearl White","Matte Grey","Navy Blue"]', '72V 32Ah TTFAR Graphene', 95, 285000, 1, 1795157230, 1795157230);
INSERT OR REPLACE INTO models (id, showroom_id, brand_id, name, variant, color_options, battery_capacity, range_km, default_selling_price, is_active, created_at, updated_at)
    VALUES ('model_yadea_g5', 'showroom_default_01', 'brand_yadea', 'G5 Pro', 'Lithium Ion Fast Charge', '["Titanium Silver","Pearl White"]', '60V 32Ah Panasonic Lithium', 85, 345000, 1, 1795157230, 1795157230);
INSERT OR REPLACE INTO models (id, showroom_id, brand_id, name, variant, color_options, battery_capacity, range_km, default_selling_price, is_active, created_at, updated_at)
    VALUES ('model_metro_e8s', 'showroom_default_01', 'brand_metro', 'E8S Pro', 'Dual Battery', '["Glossy Red","Black","Arctic White"]', '72V 38Ah Graphene', 120, 320000, 1, 1795157230, 1795157230);
INSERT OR REPLACE INTO suppliers (id, showroom_id, name, phone, address, cnic, created_at, updated_at)
  VALUES ('supplier_apex', 'showroom_default_01', 'Apex EV Importers Karachi', '0333-9876543', 'Port Qasim Industrial Area, Karachi', '42201-1234567-1', 1795157230, 1795157230);
INSERT OR REPLACE INTO units (id, showroom_id, model_id, supplier_id, chassis_number, motor_number, battery_serial_numbers, color, purchase_cost, status, received_date, created_at, updated_at)
    VALUES ('unit_001', 'showroom_default_01', 'model_yadea_t9', 'supplier_apex', 'YAD-T9-2026-0001', 'MOT-72V-89410', 'BAT-GR-7232-101', 'Matte Grey', 245000, 'in_stock', 1795157230, 1795157230, 1795157230);
INSERT OR REPLACE INTO units (id, showroom_id, model_id, supplier_id, chassis_number, motor_number, battery_serial_numbers, color, purchase_cost, status, received_date, created_at, updated_at)
    VALUES ('unit_002', 'showroom_default_01', 'model_yadea_t9', 'supplier_apex', 'YAD-T9-2026-0002', 'MOT-72V-89411', 'BAT-GR-7232-102', 'Pearl White', 245000, 'in_stock', 1795157230, 1795157230, 1795157230);
INSERT OR REPLACE INTO units (id, showroom_id, model_id, supplier_id, chassis_number, motor_number, battery_serial_numbers, color, purchase_cost, status, received_date, created_at, updated_at)
    VALUES ('unit_003', 'showroom_default_01', 'model_yadea_g5', 'supplier_apex', 'YAD-G5-2026-0003', 'MOT-60V-99120', 'BAT-LI-6032-201', 'Titanium Silver', 295000, 'in_stock', 1795157230, 1795157230, 1795157230);
INSERT OR REPLACE INTO units (id, showroom_id, model_id, supplier_id, chassis_number, motor_number, battery_serial_numbers, color, purchase_cost, status, received_date, created_at, updated_at)
    VALUES ('unit_004', 'showroom_default_01', 'model_metro_e8s', 'supplier_apex', 'MET-E8S-2026-0004', 'MOT-72V-77312', 'BAT-GR-7238-301', 'Glossy Red', 275000, 'in_stock', 1795157230, 1795157230, 1795157230);
INSERT OR REPLACE INTO counters (id, showroom_id, type, year, last_sequence, updated_at)
  VALUES ('cnt_inv_2026', 'showroom_default_01', 'invoice', 2026, 0, 1795157230);
INSERT OR REPLACE INTO counters (id, showroom_id, type, year, last_sequence, updated_at)
  VALUES ('cnt_rec_2026', 'showroom_default_01', 'receipt', 2026, 0, 1795157230);
