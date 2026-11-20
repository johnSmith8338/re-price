import { Injectable } from "@angular/core";
import { RepriceDocument } from "../models/reprice-document.model";
import { RepriceExportFile } from "../models/reprice-export.model";

@Injectable({
    providedIn: 'root'
})
export class RepriceExportService {
    private readonly formatVersion = 1;

    exportDocument(document: RepriceDocument) {
        const exportFile: RepriceExportFile = {
            format: 'reprice',
            formatVersion: this.formatVersion,
            exportedAt: new Date().toISOString(),
            document: structuredClone(document)
        }

        const content = JSON.stringify(exportFile, null, 2);
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement('a');

        link.href = url;
        link.download = this.getFileName(document);
        link.click();

        URL.revokeObjectURL(url);
    }

    private getFileName(document: RepriceDocument): string {
        const name = document.name
            .trim()
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 60)

        return `reprice_${name}_${document.date}.reprice`;
    }
}