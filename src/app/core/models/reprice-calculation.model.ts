export type PriceChangeType = 'increase' | 'decrease' | 'unchanged';

export interface RepriceProductCalculation {
    difference: number;
    percentage: number | null;
    changeType: PriceChangeType;
}

export interface RepriceSummary {
    productsCount: number;
    oldPriceTotal: number;
    newPriceTotal: number;
    differenceTotal: number;
    percentageTotal: number | null;
    increasedCount: number;
    decreasedCount: number;
    unchangedCount: number;
}