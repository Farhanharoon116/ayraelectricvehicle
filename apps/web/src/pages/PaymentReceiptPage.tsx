import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, Share2, ArrowLeft, Check } from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, amountToWords, formatPKTDate } from "@aev/shared";

interface PaymentReceiptData {
  payment: {
    id: string;
    receiptNumber: string;
    paymentDate: number;
    amount: number;
    paymentMethod: string;
    reference?: string;
    notes?: string;
    paymentType?: string;
  };
  sale: {
    id: string;
    invoiceNumber: string;
    saleType: string;
    totalAmount: number;
    customerNameSnap: string;
    customerCnicSnap: string;
  };
  showroom: {
    name: string;
    logoR2Key?: string;
    address: string;
    phoneNumbers: string;
  };
  remainingBalance: number;
  allocations?: Array<{
    installmentNumber: number;
    amount: number;
  }>;
}

function MethodLabel({ method }: { method: string }) {
  const labels: Record<string, string> = {
    cash: "Cash in Hand",
    bank_transfer: "Bank Transfer / Online",
    other: "Cheque / Other",
  };
  return <>{labels[method] ?? method}</>;
}

export function PaymentReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<{ receipt: PaymentReceiptData }>({
    queryKey: ["receipt", paymentId],
    queryFn: () => fetchApi(`/api/payments/${paymentId}`),
    enabled: !!paymentId,
  });

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payment Receipt - ${data?.receipt.payment.receiptNumber}`,
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

  if (error || !data?.receipt) {
    return (
      <div className="p-8 text-center text-slate-500 max-w-md mx-auto space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Receipt Not Found</h2>
        <p className="text-xs">The requested payment receipt could not be located.</p>
        <button onClick={() => navigate("/sales")} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold">
          Back to Sales
        </button>
      </div>
    );
  }

  const { payment, sale, showroom, remainingBalance, allocations } = data.receipt;

  return (
    <div className="min-h-screen bg-slate-100/70 p-3 sm:p-6 print:p-0 print:bg-white text-slate-900">
      {/* Toolbar */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex flex-wrap items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <Link
          to={`/sales/${sale.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sale
        </Link>
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
        id="receipt-document"
        className="max-w-[210mm] mx-auto bg-white p-8 sm:p-12 shadow-xl print:shadow-none print:p-0 border border-slate-200/60 print:border-none rounded-2xl print:rounded-none"
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
              <div className="text-xs text-slate-600 mt-1">{showroom.address}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Phone: {showroom.phoneNumbers}</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              Payment Receipt
            </span>
            <div className="font-mono font-black text-xl text-slate-900 mt-2">{payment.receiptNumber}</div>
            <div className="text-xs text-slate-500 mt-0.5">Date: <strong>{formatPKTDate(payment.paymentDate)}</strong></div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black uppercase tracking-widest text-slate-900">PAYMENT RECEIPT</h2>
          <div className="text-sm text-slate-500 mt-1">Official acknowledgment of payment received</div>
        </div>

        {/* Amount (prominent) */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 text-center mb-8">
          <div className="text-sm text-slate-400 uppercase font-semibold mb-1">Amount Received</div>
          <div className="text-4xl font-black text-white">{formatPKR(payment.amount)}</div>
          <div className="text-sm text-slate-300 italic mt-2">{amountToWords(payment.amount)}</div>
        </div>

        {/* Details Table */}
        <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden mb-6">
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="py-3 px-4 text-slate-500 font-semibold w-1/2 bg-slate-50">Received From</td>
              <td className="py-3 px-4 font-bold text-slate-900">{sale.customerNameSnap}</td>
            </tr>
            <tr>
              <td className="py-3 px-4 text-slate-500 font-semibold bg-slate-50">CNIC</td>
              <td className="py-3 px-4 font-mono text-slate-800">{sale.customerCnicSnap}</td>
            </tr>
            <tr>
              <td className="py-3 px-4 text-slate-500 font-semibold bg-slate-50">Against Invoice</td>
              <td className="py-3 px-4 font-mono font-bold text-brand-700">{sale.invoiceNumber}</td>
            </tr>
            <tr>
              <td className="py-3 px-4 text-slate-500 font-semibold bg-slate-50">Payment Method</td>
              <td className="py-3 px-4 font-semibold text-slate-900">
                <MethodLabel method={payment.paymentMethod} />
              </td>
            </tr>
            {payment.reference && (
              <tr>
                <td className="py-3 px-4 text-slate-500 font-semibold bg-slate-50">Bank Reference</td>
                <td className="py-3 px-4 font-mono text-slate-800">{payment.reference}</td>
              </tr>
            )}
            <tr>
              <td className="py-3 px-4 text-slate-500 font-semibold bg-slate-50">Amount Paid</td>
              <td className="py-3 px-4 font-black text-emerald-700 text-lg">{formatPKR(payment.amount)}</td>
            </tr>
            <tr>
              <td className="py-3 px-4 text-slate-500 font-semibold bg-slate-50">Remaining Balance</td>
              <td className={`py-3 px-4 font-black text-sm ${remainingBalance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {remainingBalance > 0 ? formatPKR(remainingBalance) : "FULLY PAID ✓"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Installment allocation info */}
        {sale.saleType === "installment" && allocations && allocations.length > 0 && (
          <div className="mb-6 p-3.5 bg-brand-50 border border-brand-200 rounded-xl text-xs">
            <div className="font-bold text-brand-800 mb-2">Applied to Installments:</div>
            <div className="space-y-1">
              {allocations.map((a) => (
                <div key={a.installmentNumber} className="flex justify-between">
                  <span className="text-slate-600">Installment #{a.installmentNumber}</span>
                  <span className="font-bold text-slate-900">{formatPKR(a.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature */}
        <div className="mt-10 pt-6 border-t border-slate-300">
          <div className="max-w-xs mx-auto text-center text-xs">
            <div className="border-b border-slate-400 mb-2 h-10" />
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Received By</div>
            <div className="text-slate-500 text-[11px]">{showroom.name}</div>
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
