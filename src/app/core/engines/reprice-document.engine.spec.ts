
import { describe, expect, it } from 'vitest';

import { RepriceDocumentEngine } from './reprice-document.engine';

describe('RepriceDocumentEngine', () => {

    const engine = new RepriceDocumentEngine();

    it('should create a new draft document', () => {

        const document = engine.createDocument();

        expect(document.id).toBeTruthy();
        expect(document.formatVersion).toBe(1);
        expect(document.revision).toBe(1);
        expect(document.status).toBe('draft');
        expect(document.products).toEqual([]);
        expect(document.completedAt).toBeNull();
        expect(document.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should add a new empty product', () => {

        const document = engine.createDocument();

        const updated = engine.addProduct(document);

        expect(document.products).toHaveLength(0);
        expect(updated.products).toHaveLength(1);
        expect(updated.products[0].name).toBe('');
        expect(updated.products[0].oldPrice).toBeNull;
        expect(updated.revision).toBe(2);
    });

    it('should update a product', () => {

        const document = engine.createDocument();
        const withProduct = engine.addProduct(document);

        const productId = withProduct.products[0].id;

        const updated = engine.updateProduct(
            withProduct,
            productId,
            {
                name: 'Test product',
                article: 'ABC-123',
                oldPrice: 10000,
                newPrice: 15000
            }
        );

        expect(updated.products[0]).toMatchObject({
            name: 'Test product',
            article: 'ABC-123',
            oldPrice: 10000,
            newPrice: 15000
        });

        expect(updated.revision).toBe(3);
    });

    it('should remove a product', () => {

        const document = engine.createDocument();
        const withProduct = engine.addProduct(document);

        const updated = engine.removeProduct(
            withProduct,
            withProduct.products[0].id
        );

        expect(updated.products).toHaveLength(0);
        expect(updated.revision).toBe(3);
    });

    it('should not allow completing an empty document', () => {

        const document = engine.createDocument();

        expect(() => engine.completeDocument(document))
            .toThrow('Добавьте хотя бы один товар');
    });

    it('should not allow completing a document with empty products', () => {

        const document = engine.createDocument();
        const updated = engine.addProduct(document);

        expect(() => engine.completeDocument(updated))
            .toThrow('Заполните все карточки товаров');
    });

    it('should complete a valid document', () => {

        let document = engine.createDocument();

        document = engine.addProduct(document);

        document = engine.updateProduct(
            document,
            document.products[0].id,
            {
                name: 'Test product',
                oldPrice: 10000,
                newPrice: 15000
            }
        );

        const completed = engine.completeDocument(document);

        expect(completed.status).toBe('completed');
        expect(completed.completedAt).toBeTruthy();
        expect(completed.revision).toBe(4);
    });

    it('should not allow editing a completed document', () => {

        let document = engine.createDocument();

        document = engine.addProduct(document);

        document = engine.updateProduct(
            document,
            document.products[0].id,
            {
                name: 'Test product'
            }
        );

        document = engine.updateProduct(
            document,
            document.products[0].id,
            {
                oldPrice: 10000,
                newPrice: 15000
            }
        );

        const completed = engine.completeDocument(document);

        expect(() => engine.addProduct(completed))
            .toThrow('Завершенный документ нельзя редактировать');
    });

    it('should reopen a completed document', () => {

        let document = engine.createDocument();

        document = engine.addProduct(document);

        document = engine.updateProduct(
            document,
            document.products[0].id,
            {
                name: 'Test product',
                oldPrice: 10000,
                newPrice: 15000
            }
        );

        document = engine.completeDocument(document);

        const reopened = engine.reopenDocument(document);

        expect(reopened.status).toBe('draft');
        expect(reopened.completedAt).toBeNull();
        expect(reopened.revision).toBe(document.revision + 1);
    });

    it('should reject negative prices', () => {

        const document = engine.createDocument();
        const updated = engine.addProduct(document);

        expect(() => engine.updateProduct(
            updated,
            updated.products[0].id,
            { oldPrice: -100 }
        )).toThrow('Некорректная старая цена');
    });
});
