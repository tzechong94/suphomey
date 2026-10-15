/**
 * Rent vs buy over a horizon, in today's dollars, ignoring tax. It compares
 * money that is gone for good on each side:
 *
 * - Renting: rent paid.
 * - Buying: mortgage interest, upfront costs (stamp duty, legal and agent
 *   fees), and the investment return the down payment would have earned
 *   (opportunity cost), minus any gain (or plus any loss) on the flat's value.
 *   Repaid principal is not a cost: it is still yours as equity.
 *
 * HDB leases run down to zero, so flats tend to lose value as they age; the
 * annual price change can be set negative to reflect that.
 */
export type RentVsBuyInput = {
  price: number;
  monthlyRent: number;
  /** Fraction of the price paid upfront, e.g. 0.25. */
  downPayment: number;
  /** Annual mortgage rate, e.g. 0.026. */
  loanRate: number;
  loanYears: number;
  /** One-off buying costs as a fraction of price, e.g. 0.03. */
  upfrontCosts: number;
  /** Annual change in the flat's value, e.g. -0.01. */
  priceChange: number;
  /** Annual rent increase, e.g. 0.02. */
  rentChange: number;
  /** Annual return the down payment could earn elsewhere, e.g. 0.025. */
  investmentReturn: number;
  horizonYears: number;
};

export type YearRow = { year: number; rentCost: number; buyCost: number; equity: number };

export type RentVsBuyResult = {
  rows: YearRow[];
  /** First year in which buying has cost less than renting, or null within the horizon. */
  breakEvenYear: number | null;
  monthlyInstalment: number;
  /** Annual rent divided by price. */
  grossYield: number;
};

/** Standard amortised loan payment. */
export function monthlyInstalment(principal: number, annualRate: number, years: number): number {
  const n = years * 12;
  const r = annualRate / 12;
  if (principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

export function rentVsBuy(input: RentVsBuyInput): RentVsBuyResult {
  const loan = input.price * (1 - input.downPayment);
  const instalment = monthlyInstalment(loan, input.loanRate, input.loanYears);
  const upfront = input.price * input.upfrontCosts;
  const cash = input.price * input.downPayment + upfront;

  let balance = loan;
  let rentPaid = 0;
  let interestPaid = 0;
  let monthlyRent = input.monthlyRent;
  const rows: YearRow[] = [];
  let breakEvenYear: number | null = null;

  for (let year = 1; year <= input.horizonYears; year++) {
    for (let m = 0; m < 12; m++) {
      rentPaid += monthlyRent;
      if (balance > 0) {
        const interest = (balance * input.loanRate) / 12;
        interestPaid += interest;
        balance = Math.max(0, balance - (instalment - interest));
      }
    }
    monthlyRent *= 1 + input.rentChange;

    const value = input.price * (1 + input.priceChange) ** year;
    const opportunityCost = cash * ((1 + input.investmentReturn) ** year - 1);
    const buyCost = interestPaid + upfront + opportunityCost + (input.price - value);
    rows.push({ year, rentCost: Math.round(rentPaid), buyCost: Math.round(buyCost), equity: Math.round(value - balance) });
    if (breakEvenYear === null && buyCost < rentPaid) breakEvenYear = year;
  }

  return {
    rows,
    breakEvenYear,
    monthlyInstalment: Math.round(instalment),
    grossYield: Math.round(((input.monthlyRent * 12) / input.price) * 10_000) / 10_000,
  };
}

/** Defaults shown in the UI; every one is editable there. */
export const RENT_VS_BUY_DEFAULTS = {
  downPayment: 0.25,
  // HDB's concessionary loan rate is pegged 0.1 percentage points above the CPF Ordinary Account rate (2.5%).
  loanRate: 0.026,
  loanYears: 25,
  upfrontCosts: 0.03,
  priceChange: 0,
  rentChange: 0.02,
  investmentReturn: 0.025,
  horizonYears: 15,
} satisfies Omit<RentVsBuyInput, 'price' | 'monthlyRent'>;
