import { RepriceProductCalculation, RepriceSummary } from "./reprice-calculation.model";

export interface RepriceReportProduct {
    id: string;
    name: string;
    article: string;
    oldPrice: number;
    newPrice: number;
    calculation: RepriceProductCalculation;
}

export interface RepriceReport {
    name: string;
    date: string;
    products: RepriceReportProduct[];
    summary: RepriceSummary;
}