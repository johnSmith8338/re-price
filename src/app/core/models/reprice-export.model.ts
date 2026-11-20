import { RepriceDocument } from "./reprice-document.model";

export interface RepriceExportFile {
    format: 'reprice';
    formatVersion: number;
    exportedAt: string;
    document: RepriceDocument;
}