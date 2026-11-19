import { describe, expect, it } from 'vitest';
import { RepriceCalculationEngine } from './reprice-calculation.engine';
import { RepriceProduct } from '../models/reprice-product.model';

describe('RepriceCalculationEngine', () => {
    const engine = new RepriceCalculationEngine();

    const createProduct = (
        oldPrice: number,
        newPrice: number,
        name = 'Test product'
    ): RepriceProduct => ({
        id: crypto.randomUUID(),
        name,
        article: '',
        oldPrice,
        newPrice,
        sortOrder: 0
    })

    it('should calculate price increase', () => {
        const product = createProduct(10_000, 15_000);

        expect(engine.calculateProduct(product)).toEqual({
            difference: 5000,
            percentage: 50,
            changeType: 'increase'
        })
    })

    it('should calculate price decrease', () => {
        const product = createProduct(10_000, 8000);

        expect(engine.calculateProduct(product)).toEqual({
            difference: -2000,
            percentage: -20,
            changeType: 'decrease'
        })
    })

    it('should detect unchanged price', () => {
        const product = createProduct(10_000, 10_000);

        expect(engine.calculateProduct(product)).toEqual({
            difference: 0,
            percentage: 0,
            changeType: 'unchanged'
        })
    })

    it('should return null percentage when old price is zero', () => {
        const product = createProduct(0, 10_000);

        expect(engine.calculateProduct(product)).toEqual({
            difference: 10_000,
            percentage: null,
            changeType: 'increase'
        })
    })

    it('should ignore incomplete products in summary', () => {
        const products = [
            createProduct(10_000, 15_000),
            createProduct(20_000, 18_000),
            createProduct(10_000, 10_000),
            createProduct(10_000, 15_000, '')
        ];

        expect(engine.calculateSummary(products)).toEqual({
            productsCount: 3,
            oldPriceTotal: 40000,
            newPriceTotal: 43000,
            differenceTotal: 3000,
            percentageTotal: 7.5,
            increasedCount: 1,
            decreasedCount: 1,
            unchangedCount: 1
        })
    })
})