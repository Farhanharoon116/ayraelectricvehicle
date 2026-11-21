import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, Share2, ArrowLeft, Check, ShieldCheck, Calendar } from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, formatPKTDate } from "@aev/shared";

interface AgreementData {
  sale: {
    id: string;
    invoiceNumber: string;
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
    guarantorName?: string;
    guarantorCnic?: string;
    guarantorPhone?: string;
    guarantorAddress?: string;
    isVoided: boolean;
  };
  showroom: {
    name: string;
    logoR2Key?: string;
    address: string;
    phoneNumbers: string;
    email?: string;
    invoiceFooterText?: string;
    defaultWarrantyTerms?: string;
    lateFineEnabled: boolean;
    lateFineType: string;
    lateFineAmount: number;
    lateFineGraceDays: number;
  };
  installmentPlan: {
    durationMonths: number;
    downPaymentAmount: number;
    markupType: string;
    markupValue: number;
    markupAmount: number;
    monthlyInstallmentAmount: number;
    totalPayable: number;
    startDate: string;
  };
  schedules: Array<{
    installmentNumber: number;
    dueDate: string;
    amount: number;
    status: string;
    paidDate?: string;
  }>;
}

export function InstallmentAgreementPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<{ agreement: AgreementData }>({
    queryKey: ["agreement", saleId],
    queryFn: () => fetchApi(`/api/sales/${saleId}/agreement`),
    enabled: !!saleId,
  });

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Installment Agreement - ${data?.agreement.sale.invoiceNumber}`,
          url,
        });
      } catch {
        // User cancelled
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (error || !data?.agreement) {
    return (
      <div className="p-8 text-center text-slate-500 max-w-md mx-auto space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Agreement Not Found</h2>
        <p className="text-xs">The requested installment agreement could not be located.</p>
        <button onClick={() => navigate("/sales")} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold">
          Back to Sales
        </button>
      </div>
    );
  }

  const { sale, showroom, installmentPlan, schedules } = data.agreement;
  const netPrice = sale.basePrice - sale.discount;

  return (
    <div className="min-h-screen bg-slate-100/70 p-3 sm:p-6 print:p-0 print:bg-white text-slate-900">
      {/* Toolbar */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex flex-wrap items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={() => navigate(`/sales/${sale.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sale
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            {copied ? "Copied!" : "Share"}
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* A4 Document */}
      <div
        id="agreement-document"
        className="relative max-w-[210mm] min-h-[297mm] mx-auto bg-white p-8 sm:p-12 shadow-xl print:shadow-none print:p-0 border border-slate-200/60 print:border-none rounded-2xl print:rounded-none flex flex-col"
        style={{ fontSize: "10px" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 mb-6">
          <div className="flex items-center gap-3">
            {showroom.logoR2Key ? (
              <img src={`/api/settings/file/${showroom.logoR2Key}`} alt="Logo" className="w-14 h-14 object-contain" />
            ) : (
              <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-lg">AEV</div>
            )}
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">{showroom.name}</h1>
              <div className="text-[10px] text-slate-600 mt-1">{showroom.address}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Phone: {showroom.phoneNumbers}{showroom.email ? ` • ${showroom.email}` : ""}</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-black uppercase tracking-widest text-brand-700 bg-brand-50 px-2.5 py-1 rounded border border-brand-200">
              Installment Agreement
            </div>
            <div className="font-mono font-black text-base text-slate-900 mt-2">{sale.invoiceNumber}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 justify-end">
              <Calendar className="w-3 h-3" />
              Date: <strong>{formatPKTDate(sale.saleDate)}</strong>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 border-2 border-slate-900 inline-block px-8 py-2 rounded">
            INSTALLMENT AGREEMENT
          </h2>
        </div>

        {/* Customer & Unit table */}
        <div className="grid grid-cols-2 gap-5 mb-6 text-[10px]">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block border-b border-slate-200 pb-1">Customer Details</span>
            <div className="font-bold text-slate-900 text-sm">{sale.customerNameSnap}</div>
            <div className="font-mono text-slate-700">CNIC: {sale.customerCnicSnap}</div>
            <div className="text-slate-600">Phone: {sale.customerPhoneSnap}</div>
            <div className="text-slate-500 leading-relaxed">Address: {sale.customerAddressSnap}</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block border-b border-slate-200 pb-1">Vehicle Details</span>
            <div className="font-bold text-slate-900 text-sm">{sale.unitBrandSnap} - {sale.unitModelSnap}</div>
            <div className="text-slate-600">Color: <strong>{sale.unitColorSnap}</strong></div>
            <div className="font-mono text-slate-800 space-y-0.5">
              <div>Chassis: <strong>{sale.unitChassisSnap}</strong></div>
              <div>Motor: <strong>{sale.unitMotorSnap}</strong></div>
              <div>Battery: {sale.unitBatterySnap}</div>
            </div>
          </div>
        </div>

        {/* Financial Summary table */}
        <div className="mb-6">
          <table className="w-full text-[10px] border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-900 text-white uppercase text-[9px] tracking-wider">
              <tr>
                <th className="py-2 px-3 text-left">Description</th>
                <th className="py-2 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              <tr><td className="py-2 px-3">Vehicle Price</td><td className="py-2 px-3 text-right font-semibold">{formatPKR(sale.basePrice)}</td></tr>
              {sale.discount > 0 && <tr><td className="py-2 px-3 text-rose-600">Discount</td><td className="py-2 px-3 text-right text-rose-600 font-semibold">-{formatPKR(sale.discount)}</td></tr>}
              <tr><td className="py-2 px-3 font-semibold">Net Price</td><td className="py-2 px-3 text-right font-bold">{formatPKR(netPrice)}</td></tr>
              <tr><td className="py-2 px-3">Down Payment</td><td className="py-2 px-3 text-right font-semibold text-emerald-700">{formatPKR(installmentPlan.downPaymentAmount)}</td></tr>
              <tr>
                <td className="py-2 px-3">Markup ({installmentPlan.markupType === "percentage" ? `${installmentPlan.markupValue}%` : "Flat"})</td>
                <td className="py-2 px-3 text-right font-semibold text-amber-700">{formatPKR(installmentPlan.markupAmount)}</td>
              </tr>
              <tr className="bg-slate-50 font-black">
                <td className="py-2 px-3 text-slate-900">Total Payable</td>
                <td className="py-2 px-3 text-right text-slate-900">{formatPKR(installmentPlan.totalPayable)}</td>
              </tr>
              <tr className="bg-brand-50">
                <td className="py-2 px-3 font-bold text-brand-900">Monthly Installment</td>
                <td className="py-2 px-3 text-right font-black text-brand-900 text-sm">{formatPKR(installmentPlan.monthlyInstallmentAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Installment Schedule */}
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Installment Schedule</div>
          <table className="w-full text-[10px] border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-900 text-white uppercase text-[9px] tracking-wider">
              <tr>
                <th className="py-2 px-3 text-left w-10">No.</th>
                <th className="py-2 px-3 text-left">Due Date</th>
                <th className="py-2 px-3 text-right">Amount (Rs)</th>
                <th className="py-2 px-3 text-left">Paid Date</th>
                <th className="py-2 px-3 text-left">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {schedules.map((s) => (
                <tr key={s.installmentNumber} className={s.installmentNumber % 2 === 0 ? "bg-slate-50/50" : "bg-white"}>
                  <td className="py-1.5 px-3 font-semibold text-slate-700">{s.installmentNumber}</td>
                  <td className="py-1.5 px-3 font-mono text-slate-700">{s.dueDate}</td>
                  <td className="py-1.5 px-3 text-right font-bold text-slate-900">{formatPKR(s.amount)}</td>
                  <td className="py-1.5 px-3 font-mono text-slate-500 text-[9px]">{s.paidDate ?? ""}</td>
                  <td className="py-1.5 px-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Terms */}
        <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[9px] text-slate-600 space-y-2">
          <div className="font-bold text-slate-800 flex items-center gap-1 uppercase tracking-wider text-[9px]">
            <ShieldCheck className="w-3 h-3 text-brand-600" /> Terms & Conditions
          </div>
          {showroom.lateFineEnabled && (
            <p className="text-rose-700 font-semibold">
              A late fine of {showroom.lateFineType === "fixed" ? formatPKR(showroom.lateFineAmount) : `${showroom.lateFineAmount}%`} will be charged after {showroom.lateFineGraceDays} days grace period.
            </p>
          )}
          {showroom.defaultWarrantyTerms && <p className="leading-relaxed">{showroom.defaultWarrantyTerms}</p>}
          {showroom.invoiceFooterText && <p className="text-slate-500 italic">{showroom.invoiceFooterText}</p>}
        </div>

        {/* Guarantor Section */}
        {sale.guarantorName && (
          <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] space-y-1">
            <div className="font-bold text-amber-800 uppercase text-[9px]">Guarantor Details</div>
            <div className="font-bold text-slate-900">{sale.guarantorName}</div>
            <div className="font-mono text-slate-700">CNIC: {sale.guarantorCnic}</div>
            <div className="text-slate-600">Phone: {sale.guarantorPhone}</div>
            <div className="text-slate-500">Address: {sale.guarantorAddress}</div>
          </div>
        )}

        {/* Signature Blocks */}
        <div className="mt-auto pt-10 border-t border-slate-300">
          <div className="grid grid-cols-3 gap-6 text-center text-[10px]">
            <div>
              <div className="border-b border-slate-400 mb-2 h-10" />
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[9px]">Customer</div>
              <div className="text-[9px] text-slate-500">{sale.customerNameSnap}</div>
            </div>
            <div>
              <div className="border-b border-slate-400 mb-2 h-10" />
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[9px]">Guarantor</div>
              <div className="text-[9px] text-slate-500">{sale.guarantorName ?? "N/A"}</div>
            </div>
            <div>
              <div className="border-b border-slate-400 mb-2 h-10" />
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[9px]">Showroom Representative</div>
              <div className="text-[9px] text-slate-500">{showroom.name}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
