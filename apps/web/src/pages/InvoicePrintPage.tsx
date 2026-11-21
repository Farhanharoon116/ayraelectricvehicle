import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  Share2,
  ArrowLeft,
  Check,
  ShieldCheck,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, formatPKTDate } from "@aev/shared";

interface InvoiceData {
  sale: {
    id: string;
    invoiceNumber: string;
    saleType: string;
    saleDate: number;
    basePrice: number;
    discount: number;
    totalAmount: number;
    customerNameSnap: string;
    customerCnicSnap: string;
    customerPhoneSnap: string;
    customerAddressSnap: string;
    unitBrandSnap: string;
    unitModelSnap: string;
    unitVariantSnap?: string;
    unitColorSnap: string;
    unitChassisSnap: string;
    unitMotorSnap: string;
    unitBatterySnap: string;
    isVoided: boolean;
    voidReason?: string;
    notes?: string;
  };
  showroom: {
    name: string;
    logoR2Key?: string;
    address: string;
    phoneNumbers: string;
    email?: string;
    invoiceFooterText?: string;
    defaultWarrantyTerms?: string;
  };
  payments: Array<{
    id: string;
    receiptNumber: string;
    paymentDate: number;
    amount: number;
    paymentMethod: string;
    reference?: string;
  }>;
  totalPaid: number;
  remainingBalance: number;
  totalInWords: string;
}

export function InvoicePrintPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<{ invoice: InvoiceData }>({
    queryKey: ["invoice", saleId],
    queryFn: () => fetchApi(`/api/sales/${saleId}/invoice`),
    enabled: !!saleId,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Sales Invoice - ${data?.invoice.sale.invoiceNumber}`,
          text: `Invoice for ${data?.invoice.sale.customerNameSnap} from ${data?.invoice.showroom.name}`,
          url,
        });
      } catch {
        // User cancelled or not supported
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (error || !data?.invoice) {
    return (
      <div className="p-8 text-center text-slate-500 max-w-md mx-auto space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Invoice Not Found</h2>
        <p className="text-xs">The requested invoice could not be located.</p>
        <button
          onClick={() => navigate("/sales")}
          className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold"
        >
          Back to Sales
        </button>
      </div>
    );
  }

  const { sale, showroom, totalPaid, remainingBalance, totalInWords } = data.invoice;

  return (
    <div className="min-h-screen bg-slate-100/70 p-3 sm:p-6 print:p-0 print:bg-white text-slate-900">
      {/* Action Toolbar (Hidden during print) */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex flex-wrap items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={() => navigate("/sales")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sales</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? "Link Copied!" : "Share Invoice"}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* A4 Document Container */}
      <div
        id="invoice-document"
        className="relative max-w-[210mm] min-h-[297mm] mx-auto bg-white p-8 sm:p-12 shadow-xl print:shadow-none print:p-0 border border-slate-200/60 print:border-none rounded-2xl print:rounded-none flex flex-col justify-between"
      >
        {/* VOID Watermark if voided */}
        {sale.isVoided && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none z-50">
            <div className="text-[120px] font-black text-rose-500/15 rotate-[-30deg] tracking-widest border-8 border-rose-500/20 px-12 py-4 rounded-3xl">
              VOID
            </div>
          </div>
        )}

        <div>
          {/* Header & Logo */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
            <div className="flex items-center gap-3">
              {showroom.logoR2Key ? (
                <img
                  src={`/api/settings/file/${showroom.logoR2Key}`}
                  alt="Logo"
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl">
                  AEV
                </div>
              )}
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                  {showroom.name}
                </h1>
                <div className="text-xs text-slate-600 mt-1 max-w-sm">{showroom.address}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Phone: {showroom.phoneNumbers} {showroom.email ? `• ${showroom.email}` : ""}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200">
                Official Sales Invoice
              </span>
              <div className="font-mono font-black text-lg text-slate-900 mt-2">
                {sale.invoiceNumber}
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Date: <strong>{formatPKTDate(sale.saleDate)}</strong>
              </div>
            </div>
          </div>

          {/* Customer & Vehicle Information Grid */}
          <div className="grid grid-cols-2 gap-6 my-6 text-xs">
            {/* Buyer Details */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block border-b border-slate-200/60 pb-1">
                Customer Details
              </span>
              <div className="font-bold text-slate-900 text-sm pt-0.5">{sale.customerNameSnap}</div>
              <div className="font-mono text-slate-700 font-semibold">CNIC: {sale.customerCnicSnap}</div>
              <div className="text-slate-600">Phone: {sale.customerPhoneSnap}</div>
              <div className="text-slate-500 text-[11px] leading-relaxed pt-0.5">
                Address: {sale.customerAddressSnap}
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block border-b border-slate-200/60 pb-1">
                Vehicle Specifications
              </span>
              <div className="font-bold text-slate-900 text-sm pt-0.5">
                {sale.unitBrandSnap} - {sale.unitModelSnap}
              </div>
              <div className="text-slate-600">
                Variant: {sale.unitVariantSnap || "Standard"} • Color: <strong>{sale.unitColorSnap}</strong>
              </div>
              <div className="font-mono text-slate-800 text-[11px] pt-1 space-y-0.5">
                <div>Chassis No: <strong className="select-all">{sale.unitChassisSnap}</strong></div>
                <div>Motor No: <strong className="select-all">{sale.unitMotorSnap}</strong></div>
                <div>Battery Serial: <span className="select-all">{sale.unitBatterySnap}</span></div>
              </div>
            </div>
          </div>

          {/* Itemized Financial Table */}
          <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden mb-6">
            <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3 text-left">Description</th>
                <th className="py-2.5 px-3 text-center">Unit Identifiers</th>
                <th className="py-2.5 px-3 text-right">Selling Price</th>
                <th className="py-2.5 px-3 text-right">Discount</th>
                <th className="py-2.5 px-3 text-right">Net Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              <tr>
                <td className="py-3 px-3">
                  <div className="font-bold text-slate-900">
                    {sale.unitBrandSnap} {sale.unitModelSnap}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Electric Scooty ({sale.unitColorSnap})
                  </div>
                </td>
                <td className="py-3 px-3 text-center font-mono text-[10px] text-slate-600">
                  {sale.unitChassisSnap}
                </td>
                <td className="py-3 px-3 text-right font-semibold">
                  {formatPKR(sale.basePrice)}
                </td>
                <td className="py-3 px-3 text-right text-rose-600 font-semibold">
                  {sale.discount > 0 ? `-${formatPKR(sale.discount)}` : "—"}
                </td>
                <td className="py-3 px-3 text-right font-bold text-slate-900">
                  {formatPKR(sale.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Amount In Words & Financial Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start border-t-2 border-slate-200 pt-4 text-xs">
            {/* Left: Words and Notes */}
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Amount in Words
                </span>
                <span className="font-bold text-slate-800 italic text-[11px] leading-relaxed">
                  {totalInWords}
                </span>
              </div>

              {sale.notes && (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="font-semibold block">Notes:</span>
                  <span>{sale.notes}</span>
                </div>
              )}
            </div>

            {/* Right: Balance Calculations */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Vehicle Total:</span>
                <span className="font-bold text-slate-900">{formatPKR(sale.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Amount Paid:</span>
                <span className="font-bold text-emerald-700">{formatPKR(totalPaid)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 font-black text-sm">
                <span className="text-slate-900">Remaining Balance:</span>
                <span className={remainingBalance > 0 ? "text-amber-700" : "text-emerald-700"}>
                  {formatPKR(remainingBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Warranty Terms */}
          {showroom.defaultWarrantyTerms && (
            <div className="mt-6 p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 text-[10px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1 uppercase tracking-wider text-[10px]">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                <span>Warranty Policy & Terms</span>
              </div>
              <p className="leading-relaxed">{showroom.defaultWarrantyTerms}</p>
            </div>
          )}
        </div>

        {/* Footer: Signatures & Slogan */}
        <div className="mt-12 pt-6 border-t border-slate-300 space-y-8">
          <div className="grid grid-cols-2 gap-12 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 mb-2 w-48 mx-auto" />
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                Customer Signature
              </div>
              <div className="text-[10px] text-slate-400">{sale.customerNameSnap}</div>
            </div>

            <div>
              <div className="border-b border-slate-400 mb-2 w-48 mx-auto" />
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                Authorized Signatory
              </div>
              <div className="text-[10px] text-slate-400">{showroom.name}</div>
            </div>
          </div>

          {showroom.invoiceFooterText && (
            <div className="text-center text-[10px] text-slate-400 italic">
              {showroom.invoiceFooterText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
