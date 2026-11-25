import { DOCUMENT, inject, Injectable } from "@angular/core";
import { RepriceStore } from "./reprice.store";
import { RepriceSettingsService } from "./reprice-settings.service";
import { RepriceBackupFile, RepriceRestorePlan, RepriceRestoreResult, RepriceRestoreStategy } from "../models/reprice-backup.model";
import { RepriceBackupValidationService } from "./reprice-backup-validation.service";
import { RepriceDocument } from "../models/reprice-document.model";

const BACKUP_FORMAT_VERSION = 1;

@Injectable({
    providedIn: 'root'
})
export class RepriceBackupService {
    private readonly document = inject(DOCUMENT);
    private readonly store = inject(RepriceStore);
    private readonly settingsSvc = inject(RepriceSettingsService);
    private readonly validationSvc = inject(RepriceBackupValidationService);

    async createBackup(): Promise<RepriceBackupFile> {
        await this.store.load();

        return {
            format: 'reprice-backup',
            formatVersion: BACKUP_FORMAT_VERSION,
            createdAt: new Date().toISOString(),
            documents: this.store.documents()
        }
    }

    async exportBackup(): Promise<string> {
        const backup = await this.createBackup();

        const json = JSON.stringify(backup, null, 2);

        const blob = new Blob(
            [json],
            { type: 'application/json;charset=utf-8' }
        );

        const url = URL.createObjectURL(blob);
        const filename = this.createFilename();

        const link = this.document.createElement('a');

        link.href = url;
        link.download = filename;

        this.document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        return filename;
    }

    private createFilename(): string {
        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        return `reprice-backup-${year}-${month}-${day}.reprice-backup`;
    }

    async readBackup(file: File): Promise<RepriceBackupFile> {
        if (file.size === 0) throw new Error('Выбран пустой файл');

        let parsed: unknown;

        try {
            const content = await file.text();
            parsed = JSON.parse(content);
        } catch {
            throw new Error('Не удалось прочитать файл');
        }

        return this.validationSvc.validate(parsed);
    }

    prepareRestore(backup: RepriceBackupFile, strategy: RepriceRestoreStategy): RepriceRestorePlan {
        const currentDocuments = this.store.documents();
        const currentIds = new Set(currentDocuments.map(document => document.id));

        const conflictCount = backup.documents.filter(
            document => currentIds.has(document.id)
        ).length
        const newCount = backup.documents.length - conflictCount;

        let documents: RepriceDocument[] = [];
        let skippedCount = 0;
        let replacedCount = 0;
        let copiedCount = 0;

        switch (strategy) {
            case "skip-existing": {
                documents = backup.documents.filter(
                    document => !currentIds.has(document.id)
                )
                skippedCount = conflictCount;
                break;
            }
            case "replace-existing": {
                documents = [...backup.documents];
                replacedCount = conflictCount;
                break;
            }
            case "copy-all": {
                const now = new Date().toISOString();

                documents = backup.documents.map(document => ({
                    ...document,
                    id: crypto.randomUUID(),
                    revision: 1,
                    name: `${document.name} (копия)`,
                    createdAt: now,
                    updatedAt: now,
                    products: document.products.map(product => ({
                        ...product,
                        id: crypto.randomUUID()
                    }))
                }))

                copiedCount = documents.length;
                break;
            }
        }

        return {
            strategy,
            documents,
            totalCount: backup.documents.length,
            newCount,
            conflictCount,
            skippedCount,
            replacedCount,
            copiedCount
        }
    }

    async restoreBackup(backup: RepriceBackupFile, strategy: RepriceRestoreStategy): Promise<RepriceRestoreResult> {
        await this.store.load();

        const plan = this.prepareRestore(backup, strategy);

        await this.store.importDocuments(
            plan.documents,
            strategy === 'replace-existing'
        )

        return {
            totalCount: plan.totalCount,
            newCount: plan.strategy === 'copy-all' ? 0 : plan.newCount,
            skippedCount: plan.skippedCount,
            replacedCount: plan.replacedCount,
            copiedCount: plan.copiedCount
        }
    }
}