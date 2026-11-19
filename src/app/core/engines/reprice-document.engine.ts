import { Injectable } from "@angular/core";
import { RepriceProduct } from "../models/reprice-product.model";
import { RepriceDocument } from "../models/reprice-document.model";

export interface CreateRepriceDocumentOptions {
    name?: 'string';
    date?: string;
}

export type RepriceProductUpdate = Partial<Pick<RepriceProduct, 'name' | 'article' | 'oldPrice' | 'newPrice'>>;


export interface RepriceDocumentUpdate {
    name?: string;
    date?: string;
}

@Injectable({
    providedIn: 'root'
})
export class RepriceDocumentEngine {
    private readonly formatVersion = 1;

    /** создаем новый документ */
    createDocument(options: CreateRepriceDocumentOptions = {}): RepriceDocument {
        const now = new Date();
        const date = options.date ?? this.getLocalDate(now);

        return {
            id: crypto.randomUUID(),
            formatVersion: this.formatVersion,
            revision: 1,
            name: options.name?.trim() || 'Новая переоценка',
            date,
            status: 'draft',
            products: [],
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            completedAt: null
        }
    }

    /** добавляет пустую карточку товара */
    addProduct(document: RepriceDocument): RepriceDocument {
        this.assertDraft(document);

        const product: RepriceProduct = {
            id: crypto.randomUUID(),
            name: '',
            article: '',
            oldPrice: null,
            newPrice: null,
            sortOrder: document.products.length
        }

        return this.updateDocumentState(document, {
            products: [...document.products, product]
        })
    }

    /** изменяет данные товара */
    updateProduct(document: RepriceDocument, productId: string, update: RepriceProductUpdate): RepriceDocument {
        this.assertDraft(document);

        const productExists = document.products.some(product => product.id === productId);
        if (!productExists) throw new Error('Товар не найден');

        this.validateProductUpdate(update);

        const products = document.products.map(product =>
            product.id === productId ? { ...product, ...update } : product
        )

        return this.updateDocumentState(document, { products });
    }

    /** удаляем товар */
    removeProduct(document: RepriceDocument, productId: string): RepriceDocument {
        this.assertDraft(document);

        const products = document.products.filter(product => product.id !== productId);
        if (products.length === document.products.length) throw new Error('Товар не найден');

        const reorderedProducts = products.map((product, index) => ({
            ...product,
            sortOrder: index
        }))

        return this.updateDocumentState(document, { products: reorderedProducts })
    }

    /** изменяем название и дату документа */
    updateDetails(document: RepriceDocument, update: RepriceDocumentUpdate): RepriceDocument {
        this.assertDraft(document);

        const name = update.name?.trim() ?? document.name;
        const date = update.date ?? document.date;

        if (!name) throw new Error('Название документа не может быть пустым');
        if (!this.isValidDate(date)) throw new Error('Некорректная дата');

        return this.updateDocumentState(document, { name, date });
    }

    /** завершам документ */
    completeDocument(document: RepriceDocument): RepriceDocument {
        this.assertDraft(document);

        if (document.products.length === 0) throw new Error('Добавьте хотя бы один товар');

        const hasIncompleteProducts = document.products.some(
            product => !this.isCompleteProduct(product)
        )

        if (hasIncompleteProducts) throw new Error('Заполните все карточки товаров');

        const now = new Date().toISOString();

        return {
            ...document,
            status: 'completed',
            completedAt: now,
            updatedAt: now,
            revision: document.revision + 1
        }
    }

    /** возвращает завершенный документ в черновик */
    reopenDocument(document: RepriceDocument): RepriceDocument {
        if (document.status !== 'completed') throw new Error('Документ уже находится в черновике');

        return {
            ...document,
            status: 'draft',
            completedAt: null,
            updatedAt: new Date().toISOString(),
            revision: document.revision + 1
        }
    }

    /** проверяет заполнены ли обязательные поля товара */
    private isCompleteProduct(product: RepriceProduct): boolean {
        return (
            product.name.trim().length > 0 &&
            product.oldPrice !== null &&
            product.newPrice !== null &&
            Number.isSafeInteger(product.oldPrice) &&
            Number.isSafeInteger(product.newPrice) &&
            product.oldPrice >= 0 &&
            product.newPrice >= 0
        )
    }

    /** проверяет входящие изменения товара */
    private validateProductUpdate(update: RepriceProductUpdate) {
        if (update.oldPrice !== undefined &&
            update.oldPrice !== null &&
            (!Number.isSafeInteger(update.oldPrice) || update.oldPrice < 0)) {
            throw new Error('Некорректная старая цена');
        }

        if (update.newPrice !== undefined &&
            update.newPrice !== null &&
            (!Number.isSafeInteger(update.newPrice) || update.newPrice < 0)) {
            throw new Error('Некорректная новая цена');
        }

        if (update.name !== undefined && typeof update.name !== 'string') {
            throw new Error('Некорректная название товара');
        }

        if (update.article !== undefined && typeof update.article !== 'string') {
            throw new Error('Некорректная артикул');
        }
    }

    /** проверяем дату в формате YYYY-MM-DD */
    private isValidDate(value: string): boolean {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

        const date = new Date(`${value} T00:00:00.000Z`);

        return (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value);
    }

    /** возвращает текущую дату */
    private getLocalDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    /** проверяет, что документ доступен для редактирования */
    private assertDraft(document: RepriceDocument) {
        if (document.status !== 'draft') throw new Error('Завершенный документ нельзя редактировать');
    }

    /** создает новую версию документа после изменения */
    private updateDocumentState(document: RepriceDocument, changes: Partial<RepriceDocument>): RepriceDocument {
        return {
            ...document,
            ...changes,
            revision: document.revision + 1,
            updatedAt: new Date().toISOString()
        }
    }
}