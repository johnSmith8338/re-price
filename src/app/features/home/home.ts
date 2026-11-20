import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RepriceStore } from '../../core/services/reprice.store';
import { Router } from '@angular/router';
import { RepriceDocument } from '../../core/models/reprice-document.model';
import { RepriceExportService } from '../../core/services/reprice-export.service';
import { RepriceImportService } from '../../core/services/reprice-import.service';

type DocumentFilter = 'all' | 'draft' | 'completed';

type DocumentSort = 'updated-desc' | 'updated-asc' | 'name-asc' | 'products-desc';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly store = inject(RepriceStore);
  private readonly router = inject(Router);
  private readonly exportSvc = inject(RepriceExportService);
  private readonly importSvc = inject(RepriceImportService);

  readonly creating = signal(false);
  readonly deletingId = signal<string | null>(null);

  readonly importing = signal(false);
  readonly importedDocument = signal<RepriceDocument | null>(null);
  readonly importError = signal<string | null>(null);

  readonly pendingImport = signal<RepriceDocument | null>(null);
  readonly importConflict = signal<RepriceDocument | null>(null);
  readonly importWarning = signal<RepriceDocument | null>(null);

  // поиск
  readonly searchQuery = signal('');

  // фильтр по статусу
  readonly activeFilter = signal<DocumentFilter>('all');

  // сортировка
  readonly activeSort = signal<DocumentSort>('updated-desc');

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
    const query = this.searchQuery().trim().toLocaleLowerCase('ru-Ru');
    const filter = this.activeFilter();
    const sort = this.activeSort();

    const result = documents.filter(document => {
      // по статусу
      if (filter !== 'all' && document.status !== filter) return false;

      // поиск по названию и дате
      if (query) {
        const name = document.name.toLocaleLowerCase('ru-Ru');
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
          return a.name.localeCompare(b.name, 'ru-Ru');
        case 'products-desc':
          return b.products.length - a.products.length;
        case 'updated-desc':
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    })
  })

  async createDocument(): Promise<void> {
    if (this.creating()) return;

    this.creating.set(true);

    try {
      const document = await this.store.createDocument();
      await this.router.navigate(['/documents', document.id]);
    } catch (error) {
      console.error('Не удалось создать документ', error);
    } finally {
      this.creating.set(false);
    }
  }

  openDocument(documentId: string) {
    void this.router.navigate(['/documents', documentId]);
  }

  async deleteDocument(document: RepriceDocument): Promise<void> {
    if (this.deletingId()) return;

    const confirmed = confirm(
      `Удалить документ «${document.name}»?\nЭто действие нельзя отменить.`
    )

    if (!confirmed) return;

    this.deletingId.set(document.id);

    try {
      await this.store.deleteDocument(document.id);
    } catch (error) {
      console.error('Не удалось удалить документ', error);
    } finally {
      this.deletingId.set(null);
    }
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
    try {
      this.exportSvc.exportDocument(document);
    } catch (error) {
      console.error('Не удалось экспортировать документ', error);
    }
  }

  async selectImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.importing()) return;

    this.importing.set(true);
    this.importError.set(null);
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
        return;
      }

      this.pendingImport.set(document);
      this.importConflict.set(existing);
    } catch (error) {
      this.importError.set(error instanceof Error ? error.message : 'Не удалось импортировать документ');
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
      const confirmed = confirm(
        `Импортируемая версия (${imported.revision}) старее текущей (${existing.revision}).\n\n` +
        'Обновление может привести к потере более новых изменений. Продолжить?'
      )

      if (!confirmed) return;
    }

    await this.performImport(async () => {
      await this.store.importDocument(imported);
      this.importedDocument.set(imported);
    })
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
    })
  }

  cancelImport() {
    this.pendingImport.set(null);
    this.importConflict.set(null);
    this.importWarning.set(null);
  }

  private async performImport(operation: () => Promise<void>): Promise<void> {
    this.importing.set(true);
    this.importError.set(null);

    try {
      await operation();

      this.pendingImport.set(null);
      this.importConflict.set(null);
    } catch (error) {
      this.importError.set(error instanceof Error ? error.message : 'Не удалось сохранить импортированный документ');
    } finally {
      this.importing.set(false);
    }
  }
}
