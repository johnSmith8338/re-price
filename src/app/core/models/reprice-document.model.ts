import { RepriceProduct } from "./reprice-product.model";

export type RepriceDocumentStatus = 'draft' | 'completed';

export interface RepriceDocument {
    id: string;
    formatVersion: number;
    revision: number;
    name: string;
    date: string;
    status: RepriceDocumentStatus;
    products: RepriceProduct[];
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
}