import { Injectable } from "@angular/core";
import { RepriceBackupFile } from "../models/reprice-backup.model";
import { RepriceDocument } from "../models/reprice-document.model";
import { RepriceProduct } from "../models/reprice-product.model";
import { RepriceDateFormat, RepriceSettings, RepriceTheme } from "../models/reprice-settings.model";

@Injectable({
    providedIn: 'root'
})
export class RepriceBackupValidationService {
    private readonly supportedFormatVersion = 1;

    validate(value: unknown): RepriceBackupFile {
        if (!this.isRecord(value)) {
            throw new Error('Некорректная структура резервной копии');
        }

        if (value['format'] !== 'reprice-backup') {
            throw new Error('Файл не является резервной копией RePrice');
        }

        if (value['formatVersion'] !== this.supportedFormatVersion) {
            throw new Error('Неподдерживаемая версия резервной копии');
        }

        if (!this.isValidTimestamp(value['createdAt'])) {
            throw new Error('Некорректная дата создания резервной копии');
        }

        if (!Array.isArray(value['documents'])) {
            throw new Error('В резервной копии отсутствует список документов');
        }

        const documentIds = new Set<string>();

        for (const document of value['documents']) {
            if (!this.isValidDocument(document)) {
                throw new Error('В резервной копии обнаружен некорректный документ');
            }

            if (documentIds.has(document.id)) {
                throw new Error('В резервной копии обнаружены повторяющиеся ID документов');
            }

            documentIds.add(document.id);
        }

        return value as unknown as RepriceBackupFile;
    }

    private isValidDocument(value: unknown): value is RepriceDocument {
        if (!this.isRecord(value)) {
            return false;
        }

        if (
            typeof value['id'] !== 'string' ||
            !value['id'].trim() ||
            !Number.isSafeInteger(value['formatVersion']) ||
            !Number.isSafeInteger(value['revision']) ||
            (value['formatVersion'] as number) < 1 ||
            (value['revision'] as number) < 1 ||
            typeof value['name'] !== 'string' ||
            typeof value['date'] !== 'string' ||
            !this.isValidCalendarDate(value['date']) ||
            (value['status'] !== 'draft' && value['status'] !== 'completed') ||
            !Array.isArray(value['products']) ||
            !this.isValidTimestamp(value['createdAt']) ||
            !this.isValidTimestamp(value['updatedAt']) ||
            !(
                value['completedAt'] === null ||
                this.isValidTimestamp(value['completedAt'])
            )
        ) {
            return false;
        }

        if (
            value['status'] === 'completed' &&
            value['completedAt'] === null
        ) {
            return false;
        }

        const productIds = new Set<string>();

        for (const product of value['products']) {
            if (!this.isValidProduct(product)) {
                return false;
            }

            if (productIds.has(product.id)) {
                return false;
            }

            productIds.add(product.id);
        }

        return true;
    }

    private isValidProduct(value: unknown): value is RepriceProduct {
        if (!this.isRecord(value)) {
            return false;
        }

        return (
            typeof value['id'] === 'string' &&
            !!value['id'].trim() &&
            typeof value['name'] === 'string' &&
            typeof value['article'] === 'string' &&
            this.isValidPrice(value['oldPrice']) &&
            this.isValidPrice(value['newPrice']) &&
            Number.isSafeInteger(value['sortOrder']) &&
            (value['sortOrder'] as number) >= 0
        );
    }

    private isValidPrice(value: unknown): boolean {
        return value === null ||
            (
                typeof value === 'number' &&
                Number.isSafeInteger(value) &&
                value >= 0
            );
    }

    private isValidSettings(value: unknown): value is RepriceSettings {
        if (!this.isRecord(value)) {
            return false;
        }

        return (
            this.isTheme(value['theme']) &&
            this.isDateFormat(value['dateFormat']) &&
            typeof value['confirmBeforeDelete'] === 'boolean'
        );
    }

    private isTheme(value: unknown): value is RepriceTheme {
        return value === 'system' ||
            value === 'light' ||
            value === 'dark';
    }

    private isDateFormat(value: unknown): value is RepriceDateFormat {
        return value === 'dd.MM.yyyy' ||
            value === 'yyyy-MM-dd';
    }

    private isValidCalendarDate(value: string): boolean {
        if (value === '') {
            return true;
        }

        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

        if (!match) {
            return false;
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);

        const date = new Date(year, month - 1, day);

        return (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        );
    }

    private isValidTimestamp(value: unknown): boolean {
        return (
            typeof value === 'string' &&
            value.trim() !== '' &&
            !Number.isNaN(Date.parse(value))
        );
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
        );
    }
}