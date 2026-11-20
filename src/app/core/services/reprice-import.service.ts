import { Injectable } from "@angular/core";
import { RepriceDocument } from "../models/reprice-document.model";

@Injectable({
    providedIn: 'root'
})
export class RepriceImportService {
    private readonly supportedFormatVersion = 1;
    private readonly supportedDocumentVersion = 1;

    async readFile(file: File): Promise<RepriceDocument> {
        const content = await file.text();

        let parsed: unknown;

        try {
            parsed = JSON.parse(content);
        } catch {
            throw new Error('Файл содержит некорректный JSON');
        }

        if (!this.isRecord(parsed)) throw new Error('Некорректная структура файла');

        if (parsed['format'] !== 'reprice') throw new Error('Неизвестный формат файла');

        if (parsed['formatVersion'] !== this.supportedFormatVersion) throw new Error('Версия формата файла не поддерживается');

        if (!this.isValidTimestamp(parsed['exportedAt'])) throw new Error('Некорректная дата экспорта');

        const document = parsed['document'];

        if (!this.isValidDocument(document)) throw new Error('Данные документа повреждены или имеют неверный формат');

        return structuredClone(document);
    }

    private isValidDocument(value: unknown): value is RepriceDocument {
        if (!this.isRecord(value)) return false;

        const document = value;

        if (typeof document['id'] !== 'string' || !document['id'].trim()) return false;

        if (document['formatVersion'] !== this.supportedDocumentVersion) return false;

        if (!Number.isSafeInteger(document['revision']) || (document['revision'] as number) < 1) return false;

        if (typeof document['name'] !== 'string' || !document['name'].trim()) return false;

        if (!this.isValidDate(document['date'])) return false;

        if (document['status'] !== 'draft' && document['status'] !== 'completed') return false;

        if (!this.isValidTimestamp(document['createdAt']) || !this.isValidTimestamp(document['updatedAt'])) return false;

        if (document['completedAt'] !== null && !this.isValidTimestamp(document['completedAt'])) return false;

        if (!Array.isArray(document['products'])) return false;

        const productIds = new Set<string>();

        for (const product of document['products']) {
            if (!this.isValidProduct(product)) return false;
            if (productIds.has(product.id)) return false;

            productIds.add(product.id);
        }

        if (document['status'] === 'completed' && document['completedAt'] === null) return false;

        return true;
    }

    private isValidProduct(value: unknown): value is RepriceDocument['products'][number] {
        if (!this.isRecord(value)) return false;

        const product = value;

        if (typeof product['id'] !== 'string' || !product['id'].trim()) return false;

        if (typeof product['name'] !== 'string') return false;
        if (typeof product['article'] !== 'string') return false;

        if (!this.isValidPrice(product['oldPrice'])) return false;
        if (!this.isValidPrice(product['newPrice'])) return false;

        if (!Number.isSafeInteger(product['sortOrder']) || (product['sortOrder'] as number) < 0) return false;

        return true;
    }

    private isValidPrice(value: unknown): boolean {
        return value === null || (
            typeof value === 'number' &&
            Number.isSafeInteger(value) &&
            value >= 0
        )
    }

    private isValidDate(value: unknown): boolean {
        if (
            typeof value !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value)
        ) return false;

        const date = new Date(`${value}T00:00:00.000Z`);

        return (
            !Number.isNaN(date.getTime()) &&
            date.toISOString().slice(0, 10) === value
        );
    }

    private isValidTimestamp(value: unknown): boolean {
        if (typeof value !== 'string') return false;

        const timestamp = Date.parse(value);

        return (
            Number.isFinite(timestamp) &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
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