/**
 * Format integer PKR into "Rs 1,250,000" display format.
 */
export function formatPKR(amount: number): string {
  const rounded = Math.round(amount);
  return `Rs ${rounded.toLocaleString("en-PK")}`;
}

/**
 * Convert integer amount to words (Rupees Only) for invoices
 */
export function amountToWords(amount: number): string {
  if (amount === 0) return "Zero Rupees Only";

  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function numToWordsUnderThousand(num: number): string {
    let str = "";
    if (num > 99) {
      str += a[Math.floor(num / 100)] + "Hundred ";
      num %= 100;
    }
    if (num > 19) {
      str += b[Math.floor(num / 10)] + " " + a[num % 10];
    } else if (num > 0) {
      str += a[num];
    }
    return str;
  }

  let n = Math.abs(Math.round(amount));
  let result = "";

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  if (crore > 0) {
    result += numToWordsUnderThousand(crore) + "Crore ";
  }
  if (lakh > 0) {
    result += numToWordsUnderThousand(lakh) + "Lakh ";
  }
  if (thousand > 0) {
    result += numToWordsUnderThousand(thousand) + "Thousand ";
  }
  if (remainder > 0) {
    result += numToWordsUnderThousand(remainder);
  }

  return (result.trim() + " Rupees Only").replace(/\s+/g, " ");
}

/**
 * Pure installment calculation engine.
 * All math uses integer PKR.
 */
export interface InstallmentCalculationInput {
  basePrice: number;
  discount: number;
  downPaymentAmount: number;
  durationMonths: number;
  markupType: "flat" | "percentage";
  markupValue: number; // percentage (e.g. 15 for 15%) or flat PKR
  startDate: string | Date;
}

export interface InstallmentScheduleProjected {
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  amount: number;
}

export interface InstallmentCalculationResult {
  netPrice: number; // basePrice - discount
  financedAmount: number; // netPrice - downPaymentAmount
  markupAmount: number;
  totalPayable: number; // netPrice + markupAmount
  remainingBalance: number; // totalPayable - downPaymentAmount
  monthlyInstallmentAmount: number;
  schedules: InstallmentScheduleProjected[];
}

export function calculateInstallmentPlan(
  input: InstallmentCalculationInput
): InstallmentCalculationResult {
  const netPrice = Math.max(0, Math.round(input.basePrice - input.discount));
  const downPayment = Math.max(0, Math.round(input.downPaymentAmount));
  const financedAmount = Math.max(0, netPrice - downPayment);

  let markupAmount = 0;
  if (input.markupType === "flat") {
    markupAmount = Math.max(0, Math.round(input.markupValue));
  } else {
    // Percentage of the financed (remaining) balance
    markupAmount = Math.max(0, Math.round((financedAmount * input.markupValue) / 100));
  }

  const remainingBalance = financedAmount + markupAmount;
  const months = Math.max(1, input.durationMonths);

  // Divide into integer monthly installments, distributing remainder into last installment
  const baseMonthly = Math.floor(remainingBalance / months);
  const remainder = remainingBalance - baseMonthly * months;

  const start = new Date(input.startDate);
  const schedules: InstallmentScheduleProjected[] = [];

  for (let i = 1; i <= months; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);

    // Give remainder to the last installment so sum strictly equals remainingBalance
    const amount = i === months ? baseMonthly + remainder : baseMonthly;

    schedules.push({
      installmentNumber: i,
      dueDate: dueDate.toISOString().split("T")[0]!,
      amount,
    });
  }

  return {
    netPrice,
    financedAmount,
    markupAmount,
    totalPayable: netPrice + markupAmount,
    remainingBalance,
    monthlyInstallmentAmount: baseMonthly,
    schedules,
  };
}
