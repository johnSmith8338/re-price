import { Injectable } from "@angular/core";
import { RepriceDocument } from "../models/reprice-document.model";

@Injectable({
    providedIn: 'root'
})
export class RepriceStorageService {
    private readonly databaseName = 'reprice-db';
    private readonly databaseVersion = 1;
    private readonly storeName = 'documents';

    private databasePromise: Promise<IDBDatabase> | null = null;

    async getAll(): Promise<RepriceDocument[]> {
        const database = await this.getDatabase();
        const transaction = database.transaction(this.storeName, 'readonly');
        const completed = this.waitForTransaction(transaction);
        const request = transaction.objectStore(this.storeName).getAll() as IDBRequest<RepriceDocument[]>;
        const documents = await this.requestToPromise(request);

        await completed;

        return documents;
    }

    async getById(id: string): Promise<RepriceDocument | null> {
        const database = await this.getDatabase();
        const transaction = database.transaction(this.storeName, 'readonly');
        const completed = this.waitForTransaction(transaction);
        const request = transaction.objectStore(this.storeName).get(id) as IDBRequest<RepriceDocument | undefined>;
        const document = await this.requestToPromise(request);

        await completed;

        return document ?? null;
    }

    async save(document: RepriceDocument): Promise<void> {
        const database = await this.getDatabase();
        const transaction = database.transaction(this.storeName, 'readwrite');
        const completed = this.waitForTransaction(transaction);
        const request = transaction.objectStore(this.storeName).put(document);

        await this.requestToPromise(request);
        await completed;
    }

    async delete(id: string): Promise<void> {
        const database = await this.getDatabase();
        const transaction = database.transaction(this.storeName, 'readwrite');
        const completed = this.waitForTransaction(transaction);
        const request = transaction.objectStore(this.storeName).delete(id);

        await this.requestToPromise(request);
        await completed;
    }

    private getDatabase(): Promise<IDBDatabase> {
        if (!('indexedDB' in globalThis)) {
            return Promise.reject(new Error('IndexedDB не поддерживается в этом окружении'));
        }

        if (!this.databasePromise) {
            this.databasePromise = this.openDatabase().catch(error => {
                this.databasePromise = null;
                throw error;
            })
        }

        return this.databasePromise;
    }

    private openDatabase(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(
                this.databaseName,
                this.databaseVersion
            )

            request.onupgradeneeded = () => {
                const database = request.result;

                if (!database.objectStoreNames.contains(this.storeName)) {
                    const store = database.createObjectStore(
                        this.storeName,
                        { keyPath: 'id' }
                    )

                    store.createIndex('updatedAt', 'updatedAt');
                    store.createIndex('date', 'date');
                    store.createIndex('status', 'status');
                }
            }

            request.onsuccess = () => {
                const database = request.result;

                database.onversionchange = () => {
                    database.close();
                    this.databasePromise = null;
                }

                resolve(database);
            }

            request.onerror = () => {
                reject(request.error ?? new Error('Не удалось открыть базу данных'));
            }

            request.onblocked = () => {
                reject(new Error('Открытие базы данных заблокировано другой вкладкой'));
            }
        })
    }

    private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);

            request.onerror = () => {
                reject(request.error ?? new Error('Ошибка операции IndexedDB'));
            }
        })
    }

    private waitForTransaction(transaction: IDBTransaction): Promise<void> {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();

            transaction.onerror = () => {
                reject(transaction.error ?? new Error('Ошибка транзакции IndexedDB'));
            }

            transaction.onabort = () => {
                reject(transaction.error ?? new Error('Транзакция IndexedDb отменена'));
            }
        })
    }

    async saveMany(documents: RepriceDocument[]): Promise<void> {
        if (documents.length === 0) return;

        const db = await this.getDatabase();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction('documents', 'readwrite');
            const objectStore = transaction.objectStore('documents');

            transaction.oncomplete = () => {
                resolve();
            }

            transaction.onerror = () => {
                reject(transaction.error ?? new Error('Не удалось сохранить документы'));
            }

            transaction.onabort = () => {
                reject(transaction.error ?? new Error('Операция сохранения была отменена'));
            }

            try {
                for (const document of documents) objectStore.put(document);
            } catch (error) {
                transaction.abort();
                reject(error);
            }
        })
    }
}