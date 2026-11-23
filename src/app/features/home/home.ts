import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RepriceStore } from '../../core/services/reprice.store';
import { Router } from '@angular/router';
import { RepriceDocument } from '../../core/models/reprice-document.model';
import { RepriceExportService } from '../../core/services/reprice-export.service';
import { RepriceImportService } from '../../core/services/reprice-import.service';
import { RepriceReportService } from '../../core/services/reprice-report.service';
import { RepriceSvgReportService } from '../../core/services/reprice-svg-report.service';
import { RepricePngExportService } from '../../core/services/reprice-png-export.service';
import { RepriceNotificationService } from '../../core/services/reprice-notification.service';
import { BottomSheet } from '../../shared/components/bottom-sheet/bottom-sheet';

type DocumentFilter = 'all' | 'draft' | 'completed';

type DocumentSort = 'updated-desc' | 'updated-asc' | 'name-asc' | 'products-desc';

@Component({
  selector: 'app-home',
  imports: [BottomSheet],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly store = inject(RepriceStore);
  private readonly router = inject(Router);
  private readonly exportSvc = inject(RepriceExportService);
  private readonly importSvc = inject(RepriceImportService);
  private readonly reportSvc = inject(RepriceReportService);
  private readonly svgReportSvc = inject(RepriceSvgReportService);
  private readonly pngExportSvc = inject(RepricePngExportService);
  private readonly notification = inject(RepriceNotificationService);

  readonly creating = signal(false);
  readonly deletingId = signal<string | null>(null);

  readonly importing = signal(false);
  readonly importedDocument = signal<RepriceDocument | null>(null);
  readonly exportingReportId = signal<string | null>(null);

  readonly pendingImport = signal<RepriceDocument | null>(null);
  readonly importConflict = signal<RepriceDocument | null>(null);
  readonly importWarning = signal<RepriceDocument | null>(null);

  readonly deleteDialogOpen = signal(false);
  readonly documentToDelete = signal<RepriceDocument | null>(null);
  readonly outdatedImportDialogOpen = signal(false);
  readonly expandedActionsId = signal<string | null>(null);

  // поиск
  readonly searchQuery = signal('');

  // фильтр по статусу
  readonly activeFilter = signal<DocumentFilter>('all');

  // сортировка
  readonly activeSort = signal<DocumentSort>('updated-desc');

  readonly filtersOpen = signal(false);
  readonly draftFilter = signal<DocumentFilter>('all');
  readonly draftSort = signal<DocumentSort>('updated-desc');

  // счетчики
  readonly documentCounts = computed(() => {
    const documents = this.store.documents();

    return {
      all: documents.length,
      draft: documents.filter(doc => doc.status === 'draft').length,
      completed: documents.filter(doc => doc.status === 'completed').length
    }
  })

  // отфильтрованный и отсортированный список
  readonly filterDocuments = computed(() => {
    const documents = this.store.documents();
    const query = this.searchQuery().trim().toLocaleLowerCase('ru-RU');
    const filter = this.activeFilter();
    const sort = this.activeSort();

    const result = documents.filter(document => {
      // по статусу
      if (filter !== 'all' && document.status !== filter) return false;

      // поиск по названию и дате
      if (query) {
        const name = document.name.toLocaleLowerCase('ru-RU');
        const date = this.getSearchableDate(document.date);

        if (!name.includes(query) && !date.includes(query)) return false;
      }

      return true;
    })

    // сортировка
    return result.sort((a, b) => {
      switch (sort) {
        case 'updated-asc':
          return a.updatedAt.localeCompare(b.updatedAt);
        case 'name-asc':
          return a.name.localeCompare(b.name, 'ru-RU');
        case 'products-desc':
          return b.products.length - a.products.length;
        case 'updated-desc':
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    })
  })

  openFilters() {
    this.draftFilter.set(this.activeFilter());
    this.draftSort.set(this.activeSort());
    this.filtersOpen.set(true);
  }

  closeFilters() {
    this.filtersOpen.set(false);
  }

  applyFilters() {
    this.activeFilter.set(this.draftFilter());
    this.activeSort.set(this.draftSort());
    this.filtersOpen.set(false);
  }

  readonly activeFiltersCount = computed(() => {
    let count = 0;

    if (this.activeFilter() !== 'all') count++;
    if (this.activeSort() !== 'updated-desc') count++;

    return count;
  })

  async createDocument(): Promise<void> {
    if (this.creating()) return;

    this.creating.set(true);

    try {
      const document = await this.store.createDocument();
      this.notification.success('Документ успешно создан');
      await this.router.navigate(['/documents', document.id]);
    } catch (error) {
      console.error('Не удалось создать документ', error);
      this.notification.error('Не удалось создать документ');
    } finally {
      this.creating.set(false);
    }
  }

  openDocument(documentId: string) {
    void this.router.navigate(['/documents', documentId]);
  }

  requestDeleteDocument(document: RepriceDocument): void {
    this.closeActions();

    if (this.deletingId()) return;

    this.documentToDelete.set(document);
    this.deleteDialogOpen.set(true);
  }

  async confirmDeleteDocument(): Promise<void> {
    const document = this.documentToDelete();

    if (!document || this.deletingId()) return;

    this.deleteDialogOpen.set(false);
    this.deletingId.set(document.id);

    try {
      await this.store.deleteDocument(document.id);
      this.notification.success('Документ успешно удален');
    } catch (error) {
      console.error('Не удалось удалить документ', error);
      this.notification.error('Не удалось удалить документ');
    } finally {
      this.deletingId.set(null);
      this.documentToDelete.set(null);
    }
  }

  cancelDeleteDocument(): void {
    this.deleteDialogOpen.set(false);
    this.documentToDelete.set(null);
  }

  formatDate(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'Некорректная дата';
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return 'Некорректная дата';
    }

    return new Intl.DateTimeFormat('ru-RU').format(date);
  }

  getStatusLabel(status: RepriceDocument['status']): string {
    return status === 'draft' ? 'Черновик' : 'Завершен';
  }

  private getSearchableDate(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value.toLocaleLowerCase('ru-RU');
    }

    const [year, month, day] = value.split('-');

    return [
      value,
      `${day}.${month}.${year}`,
      `${day}.${month}`,
      `${day}${month}${year}`
    ].join(' ').toLocaleLowerCase('ru-RU');
  }

  exportDocument(document: RepriceDocument) {
    this.closeActions();

    try {
      this.exportSvc.exportDocument(document);
      this.notification.success('Документ успешно экспортирован');
    } catch (error) {
      console.error('Не удалось экспортировать документ', error);
      this.notification.error('Не удалось экспортировать документ');
    }
  }

  async selectImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.importing()) return;

    this.importing.set(true);
    this.importWarning.set(null);
    this.pendingImport.set(null);
    this.importConflict.set(null);
    this.importedDocument.set(null);

    try {
      const document = await this.importSvc.readFile(file);

      const existing = this.store.getDocument(document.id);

      if (!existing) {
        await this.store.importDocument(document);
        this.importedDocument.set(document);
        this.notification.success('Документ успешно импортирован');
        return;
      }

      this.pendingImport.set(document);
      this.importConflict.set(existing);

    } catch (error) {
      console.error('Не удалось импортировать документ', error);
      this.notification.error('Не удалось импортировать документ');

    } finally {
      this.importing.set(false);
      input.value = '';
    }
  }

  async updateExistingDocument(): Promise<void> {
    const imported = this.pendingImport();
    const existing = this.importConflict();

    if (!imported || !existing || this.importing()) return;

    if (imported.revision < existing.revision) {
      this.outdatedImportDialogOpen.set(true);
      return;
    }

    await this.applyExistingImport(imported);
  }

  private async applyExistingImport(imported: RepriceDocument): Promise<void> {
    await this.performImport(async () => {
      await this.store.importDocument(imported);
      this.importedDocument.set(imported);
    }, 'Документ успешно обновлен');
  }

  async confirmOutdatedImport(): Promise<void> {
    const imported = this.pendingImport();

    if (!imported || this.importing()) return;

    this.outdatedImportDialogOpen.set(false);

    await this.applyExistingImport(imported);
  }

  cancelOutdatedImport(): void {
    this.outdatedImportDialogOpen.set(false);
  }

  async importAsCopy(): Promise<void> {
    const imported = this.pendingImport();
    if (!imported || this.importing()) return;

    const now = new Date().toISOString();

    const copy: RepriceDocument = {
      ...structuredClone(imported),
      id: crypto.randomUUID(),
      revision: 1,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      products: imported.products.map(product => ({
        ...product,
        id: crypto.randomUUID()
      }))
    }

    await this.performImport(async () => {
      await this.store.importDocument(copy);
      this.importedDocument.set(copy);
    }, 'Документ успешно импортирован как копия');
  }

  cancelImport() {
    this.pendingImport.set(null);
    this.importConflict.set(null);
    this.importWarning.set(null);
    this.outdatedImportDialogOpen.set(false);
  }

  private async performImport(operation: () => Promise<void>, successMessage: string): Promise<void> {
    this.importing.set(true);

    try {
      await operation();

      this.pendingImport.set(null);
      this.importConflict.set(null);

      this.notification.success(successMessage);

    } catch (error) {
      console.error('Ошибка импорта документа', error);
      this.notification.error(
        error instanceof Error ? error.message : 'Не удалось сохранить импортированный документ'
      )

    } finally {
      this.importing.set(false);
    }
  }

  async exportReport(document: RepriceDocument): Promise<void> {
    this.closeActions();

    if (this.exportingReportId()) return;

    this.exportingReportId.set(document.id);

    try {
      const report = this.reportSvc.createReport(document);

      if (report.products.length === 0) {
        this.notification.warning('Нет товаров с заполненными ценами для формирования отчёта');
        return;
      }

      const svg = this.svgReportSvc.createSvg(report);

      await this.pngExportSvc.exportSvg(
        svg,
        `reprice_${document.date}.png`
      );

      this.notification.success('PNG-отчёт успешно экспортирован');

    } catch (error) {
      console.error('Failed to export PNG report:', error);
      this.notification.error(error instanceof Error ? error.message : 'Не удалось экспортировать PNG-отчёт');

    } finally {
      this.exportingReportId.set(null);
    }
  }

  toggleActions(documentId: string): void {
    this.expandedActionsId.update(current =>
      current === documentId ? null : documentId
    );
  }

  closeActions(): void {
    this.expandedActionsId.set(null);
  }
}
