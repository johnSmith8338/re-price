import { Injectable } from "@angular/core";
import { RepriceProduct } from "../models/reprice-product.model";
import { RepriceProductCalculation, RepriceSummary } from "../models/reprice-calculation.model";

@Injectable({
    providedIn: 'root'
})
export class RepriceCalculationEngine {
    /** проверяем, учитывать товар в расчетах или нет */
    isCalculableProduct(product: RepriceProduct): product is RepriceProduct & {
        oldPrice: number;
        newPrice: number;
    } {
        return (
            product.name.trim().length > 0 &&
            typeof product.oldPrice === 'number' &&
            typeof product.newPrice === 'number' &&
            Number.isSafeInteger(product.oldPrice) &&
            Number.isSafeInteger(product.newPrice) &&
            product.oldPrice >= 0 &&
            product.newPrice >= 0
        )
    }

    /** расчитываем изменение цены одного товара */
    calculateProduct(product: RepriceProduct): RepriceProductCalculation | null {
        if (!this.isCalculableProduct(product)) return null;

        const difference = product.newPrice - product.oldPrice;
        const percentage = product.oldPrice === 0 ? null : difference / product.oldPrice * 100;
        const changeType =
            difference > 0 ? 'increase' :
                difference < 0 ? 'decrease' :
                    'unchanged';

        return {
            difference,
            percentage,
            changeType
        }
    }

    /** расчитываем общую статистику документа */
    calculateSummary(products: RepriceProduct[]): RepriceSummary {
        const validProducts = products.filter(product => this.isCalculableProduct(product));

        const summary: RepriceSummary = {
            productsCount: validProducts.length,
            oldPriceTotal: 0,
            newPriceTotal: 0,
            differenceTotal: 0,
            percentageTotal: null,
            increasedCount: 0,
            decreasedCount: 0,
            unchangedCount: 0
        }

        for (const product of validProducts) {
            const calculation = this.calculateProduct(product);
            if (!calculation) continue;

            summary.oldPriceTotal += product.oldPrice;
            summary.newPriceTotal += product.newPrice;
            summary.differenceTotal += calculation.difference;

            switch (calculation.changeType) {
                case "increase":
                    summary.increasedCount++;
                    break;
                case "decrease":
                    summary.decreasedCount++;
                    break;
                case "unchanged":
                    summary.unchangedCount++;
                    break;
            }
        }

        if (summary.oldPriceTotal > 0) summary.percentageTotal = summary.differenceTotal / summary.oldPriceTotal * 100;

        return summary;
    }
}