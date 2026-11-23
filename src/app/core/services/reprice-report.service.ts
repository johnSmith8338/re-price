import { inject, Injectable } from "@angular/core";
import { RepriceCalculationEngine } from "../engines/reprice-calculation.engine";
import { RepriceDocument } from "../models/reprice-document.model";
import { RepriceReport } from "../models/reprice-report.model";

@Injectable({
    providedIn: 'root'
})
export class RepriceReportService {
    private readonly calculationEngine = inject(RepriceCalculationEngine);

    createReport(document: RepriceDocument): RepriceReport {
        const products = [...document.products]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .filter(product => this.calculationEngine.isCalculableProduct(product))
            .map(product => {
                const calculation = this.calculationEngine.calculateProduct(product);
                if (!calculation) throw new Error(`Не удалось расчитать товар ${product.name}`);

                return {
                    id: product.id,
                    name: product.name.trim(),
                    article: product.article.trim(),
                    oldPrice: product.oldPrice,
                    newPrice: product.newPrice,
                    calculation
                }
            })

        const summary = this.calculationEngine.calculateSummary(document.products);

        return {
            name: document.name,
            date: document.date,
            products,
            summary
        }
    }
}