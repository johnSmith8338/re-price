import { inject, Injectable, signal } from "@angular/core";
import { CreateRepriceDocumentOptions, RepriceDocumentEngine, RepriceDocumentUpdate, RepriceProductUpdate } from "../engines/reprice-document.engine";
import { RepriceStorageService } from "./reprice-storage.service";
import { RepriceDocument } from "../models/reprice-document.model";

@Injectable({
    providedIn: 'root'
})
export class RepriceStore {
    private readonly documentEngine = inject(RepriceDocumentEngine);
    private readonly storage = inject(RepriceStorageService);

    private readonly _documents = signal<RepriceDocument[]>([]);

    readonly documents = this._documents.asReadonly();

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    private loaded = false;
    private loadPromise: Promise<void> | null = null;

    /**
     * загружаем документы из хранилища
     * повторные вызовы не запускают повторную загрузку
     */
    load(): Promise<void> {
        if (this.loaded) return Promise.resolve();
        if (this.loadPromise) return this.loadPromise;

        this.loading.set(true);
        this.error.set(null);

        this.loadPromise = this.storage.getAll()
            .then(documents => {
                this._documents.set(this.sortDocuments(documents));
                this.loaded = true;
            })
            .catch(error => {
                this.error.set(this.getErrorMessage(error));
                throw error;
            })
            .finally(() => {
                this.loading.set(false);
                this.loadPromise = null;
            })

        return this.loadPromise;
    }

    /** возвращает документ из текущего состояния store */
    getDocument(id: string): RepriceDocument | null {
        return this._documents().find(document => document.id === id) ?? null;
    }

    /** создает и сохраняет новый документ */
    async createDocument(options: CreateRepriceDocumentOptions = {}): Promise<RepriceDocument> {
        await this.load();

        const document = this.documentEngine.createDocument(options);

        await this.storage.save(document);

        this._documents.update(documents => this.sortDocuments([...documents, document]));

        return document;
    }

    /** удаляет документ */
    async deleteDocument(id: string): Promise<void> {
        await this.load();
        await this.storage.delete(id);

        this._documents.update(documents =>
            documents.filter(document => document.id !== id)
        )
    }

    /** добавляем пустую карточку товара */
    async addProduct(documentId: string): Promise<RepriceDocument> {
        const document = await this.requireDocument(documentId);
        const updatedDocument = this.documentEngine.addProduct(document);

        return this.saveDocument(updatedDocument);
    }

    /** изменяет поля товара */
    async updateProduct(documentId: string, productId: string, update: RepriceProductUpdate): Promise<RepriceDocument> {
        const document = await this.requireDocument(documentId);
        const updatedDocument = this.documentEngine.updateProduct(
            document,
            productId,
            update
        )

        return this.saveDocument(updatedDocument);
    }

    /** удаляет карточку товара */
    async removeProduct(documentId: string, productId: string): Promise<RepriceDocument> {
        const document = await this.requireDocument(documentId);
        const updatedDocument = this.documentEngine.removeProduct(
            document,
            productId
        )

        return this.saveDocument(updatedDocument);
    }

    /** изменяет название и дату документа */
    async updateDetails(documentId: string, update: RepriceDocumentUpdate): Promise<RepriceDocument> {
        const document = await this.requireDocument(documentId);
        const updatedDocument = this.documentEngine.updateDetails(
            document,
            update
        )

        return this.saveDocument(updatedDocument);
    }

    /** завершает документ */
    async completeDocument(documentId: string): Promise<RepriceDocument> {
        const document = await this.requireDocument(documentId);
        const updatedDocument = this.documentEngine.completeDocument(document);

        return this.saveDocument(updatedDocument);
    }

    /** возвращает завершенный документ в черновик */
    async reopenDocument(documentId: string): Promise<RepriceDocument> {
        const document = await this.requireDocument(documentId);
        const updatedDocument = this.documentEngine.reopenDocument(document);

        return this.saveDocument(updatedDocument);
    }

    private async requireDocument(id: string): Promise<RepriceDocument> {
        await this.load();

        const document = this.getDocument(id);
        if (!document) throw new Error('Документ не найден');

        return document;
    }

    /** сохраняет документ и обновляет состояние store */
    private async saveDocument(document: RepriceDocument): Promise<RepriceDocument> {
        try {
            await this.storage.save(document);

            this._documents.update(documents =>
                this.sortDocuments([
                    ...documents.filter(item => item.id !== document.id),
                    document
                ])
            )

            this.error.set(null);

            return document;
        } catch (error) {
            this.error.set(this.getErrorMessage(error));
            throw error;
        }
    }

    private sortDocuments(documents: RepriceDocument[]): RepriceDocument[] {
        return [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    private getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : 'Произошла неизвестная ошибка';
    }
}