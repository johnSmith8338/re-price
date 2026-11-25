import { RepriceDocument } from "./reprice-document.model";
import { RepriceSettings } from "./reprice-settings.model";

export type RepriceRestoreStategy = 'skip-existing' | 'replace-existing' | 'copy-all';

export interface RepriceRestorePlan {
    strategy: RepriceRestoreStategy;
    documents: RepriceDocument[];
    totalCount: number;
    newCount: number;
    conflictCount: number;
    skippedCount: number;
    replacedCount: number;
    copiedCount: number;
}

export interface RepriceRestoreResult {
    totalCount: number;
    newCount: number;
    skippedCount: number;
    replacedCount: number;
    copiedCount: number;
}

export interface RepriceBackupFile {
    format: 'reprice-backup';
    formatVersion: number;
    createdAt: string;
    documents: RepriceDocument[];
}