import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RepriceStore } from '../../core/services/reprice.store';
import { RepriceDocument } from '../../core/models/reprice-document.model';
import { RepriceProduct } from '../../core/models/reprice-product.model';
import { RepriceCalculationEngine } from '../../core/engines/reprice-calculation.engine';
import { RepriceNotificationService } from '../../core/services/reprice-notification.service';
import { RepriceSettingsService } from '../../core/services/reprice-settings.service';

@Component({
  selector: 'app-document-editor',
  imports: [],
  templateUrl: './document-editor.html',
  styleUrl: './document-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentEditor {
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly store = inject(RepriceStore);
  private readonly calculationEngine = inject(RepriceCalculationEngine);
  private readonly notification = inject(RepriceNotificationService);
  private readonly settingsSvc = inject(RepriceSettingsService);

  readonly document = signal<RepriceDocument | null>(null);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly summaryExpanded = signal(false);
  readonly completionDialogOpen = signal(false);
  readonly deleteDialogOpen = signal(false);
  readonly productToDelete = signal<string | null>(null);
  readonly validationDialogOpen = signal(false);

  private operationQueue: Promise<void> = Promise.resolve();

  private validationAttempted = false;

  readonly summary = computed(() => {
    const document = this.document();

    return document ? this.calculationEngine.calculateSummary(document.products) : null;
  })

  constructor() {
    void this.initialize();
  }

  get isReadOnly(): boolean {
    return this.document()?.status === 'completed';
  }

  toggleSummary() {
    this.summaryExpanded.update(expanded => !expanded);
  }

  private async initialize(): Promise<void> {
    try {
      await this.store.load();

      const id = this.route.snapshot.paramMap.get('id');
      if (!id) {
        const document = await this.store.createDocument();
        console.log('Created document:', document);
        console.log('Document date:', document.date);

        this.document.set(document);

        await this.router.navigate(
          ['/documents', document.id],
          { replaceUrl: true }
        )

        return;
      }

      const document = this.store.getDocument(id);
      if (!document) {
        this.error.set('Документ не найден');
        return;
      }

      this.document.set(document);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  updateName(event: Event) {
    const name = this.getInputValue(event);

    this.clearFieldError('name');

    this.enqueueOperation(document => this.store.updateDetails(document.id, { name }))
  }

  updateDate(event: Event) {
    const date = this.getInputValue(event);

    this.clearFieldError('date');

    this.enqueueOperation(document => this.store.updateDetails(document.id, { date }))
  }

  updateProductName(productId: string, event: Event) {
    const name = this.getInputValue(event);

    this.updateProduct(productId, { name });
  }

  updateProductArticle(productId: string, event: Event) {
    const article = this.getInputValue(event);

    this.updateProduct(productId, { article });
  }

  updateProductPrice(productId: string, field: 'oldPrice' | 'newPrice', event: Event) {
    const rawValue = this.getInputValue(event).trim();
    const errorKey = `${productId}.${field}`;

    if (!rawValue) {
      this.updateProduct(productId, { [field]: null });
      return;
    }

    const price = Number(rawValue);

    if (!Number.isFinite(price) || price < 0) {
      this.fieldErrors.update(errors => ({
        ...errors,
        [errorKey]: 'Цена должна быть неотрицательным числом'
      }));
      return;
    }

    const priceInMinorUnits = Math.round(price * 100);

    if (!Number.isSafeInteger(priceInMinorUnits)) {
      this.fieldErrors.update(errors => ({
        ...errors,
        [errorKey]: 'Слишком большое значение цены'
      }));
      return;
    }

    if (field === 'oldPrice') {
      this.updateProduct(productId, { oldPrice: priceInMinorUnits });
    } else {
      this.updateProduct(productId, { newPrice: priceInMinorUnits });
    }
  }

  addProduct() {
    this.enqueueOperation(
      document => this.store.addProduct(document.id),
      false,
      'Товар добавлен',
      'Не удалось добавить товар'
    );
  }

  removeProduct(productId: string) {
    this.enqueueOperation(
      document => this.store.removeProduct(document.id, productId),
      false,
      'Товар удален',
      'Не удалось удалить товар'
    );
  }

  requestCompleteDocument(): void {
    this.operationQueue = this.operationQueue.then(async () => {
      const currentDocument = this.document();

      if (!currentDocument) return;
      if (currentDocument.status === 'completed') return;

      this.validationAttempted = true;

      const errors = this.validateDocument(currentDocument);

      this.fieldErrors.set(errors);

      if (Object.keys(errors).length > 0) {
        this.validationDialogOpen.set(true);
        return;
      }

      this.completionDialogOpen.set(true);
    });
  }

  confirmCompletion(): void {
    this.completionDialogOpen.set(false);

    this.operationQueue = this.operationQueue.then(async () => {
      const currentDocument = this.document();

      if (!currentDocument) return;
      if (currentDocument.status === 'completed') return;

      this.saving.set(true);
      this.error.set(null);

      try {
        const completedDocument = await this.store.completeDocument(
          currentDocument.id
        );

        this.document.set(completedDocument);
        this.notification.success('Переоценка завершена');
      } catch (error) {
        this.error.set(this.getErrorMessage(error));
        this.notification.error('Не удалось завершить переоценку');
      } finally {
        this.saving.set(false);
      }
    });
  }

  cancelCompletion(): void {
    this.completionDialogOpen.set(false);
  }

  reopenDocument() {
    this.enqueueOperation(
      document => this.store.reopenDocument(document.id),
      true,
      'Документ возвращен в черновик',
      'Не удалось вернуть документ в черновик'
    );
  }

  formatPrice(price: number | null): string {
    return price === null ? '' : (price / 100).toFixed(2);
  }

  private updateProduct(productId: string, update: Partial<Pick<RepriceProduct, 'name' | 'article' | 'oldPrice' | 'newPrice'>>) {
    this.enqueueOperation(document => this.store.updateProduct(
      document.id,
      productId,
      update
    ))
  }

  private enqueueOperation(
    operation: (document: RepriceDocument) => Promise<RepriceDocument>,
    allowCompleted = false,
    successMessage?: string,
    failureMessage?: string
  ) {
    this.operationQueue = this.operationQueue.then(async () => {
      const currentDocument = this.document();
      if (!currentDocument) return;
      if (currentDocument.status === 'completed' && !allowCompleted) return;

      this.saving.set(true);
      this.error.set(null);

      try {
        const updatedDocument = await operation(currentDocument);

        this.document.set(updatedDocument);

        if (this.validationAttempted) this.fieldErrors.set(this.validateDocument(updatedDocument));
        if (successMessage) this.notification.success(successMessage);

      } catch (error) {
        this.error.set(this.getErrorMessage(error));
        if (failureMessage) this.notification.error(failureMessage);

      } finally {
        this.saving.set(false);
      }
    })
  }

  private getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Произошла неизвестная ошибка';
  }

  fieldError(key: string): string | null {
    return this.fieldErrors()[key] ?? null;
  }

  private clearFieldError(key: string) {
    this.fieldErrors.update(errors => {
      if (!(key in errors)) return errors;

      const updated = { ...errors };
      delete updated[key];

      return updated;
    })
  }

  private validateDocument(document: RepriceDocument): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!document.name.trim()) {
      errors['name'] = 'Введите название документа';
    }

    if (!this.isValidDate(document.date)) {
      errors['date'] = 'Укажите корректную дату переоценки';
    }

    if (document.products.length === 0) {
      errors['products'] = 'Добавьте хотя бы один товар';
    }

    for (const product of document.products) {
      const nameKey = `${product.id}.name`;
      const oldPriceKey = `${product.id}.oldPrice`;
      const newPriceKey = `${product.id}.newPrice`;

      if (!product.name.trim()) {
        errors[nameKey] = 'Введите название товара';
      }

      if (!this.isValidPrice(product.oldPrice)) {
        errors[oldPriceKey] = 'Укажите корректную старую цену';
      }

      if (!this.isValidPrice(product.newPrice)) {
        errors[newPriceKey] = 'Укажите корректную новую цену';
      }
    }

    return errors;
  }

  private isValidPrice(value: number | null): value is number {
    return (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0
    );
  }

  private isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }

  formatMoney(value: number): string {
    return `${(value / 100).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} ₴`
  }

  formatMoneyWithSign(value: number): string {
    const sign = value > 0 ? '+' : '-';

    return `${sign}${this.formatMoney(value)}`;
  }

  formatPercentage(value: number | null): string {
    if (value === null) return '—';

    const sign = value > 0 ? '+' : '-';

    return `${sign}${value.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  requestDeleteProduct(productId: string): void {
    if (this.isReadOnly || this.saving()) return;
    if (!this.settingsSvc.confirmBeforeDelete()) {
      void this.removeProduct(productId);
      return;
    }

    this.productToDelete.set(productId);
    this.deleteDialogOpen.set(true);
  }

  confirmDeleteProduct(): void {
    const productId = this.productToDelete();

    if (!productId) return;

    this.deleteDialogOpen.set(false);
    this.productToDelete.set(null);

    this.removeProduct(productId);
  }

  cancelDeleteProduct(): void {
    this.deleteDialogOpen.set(false);
    this.productToDelete.set(null);
  }

  closeValidationDialog(): void {
    this.validationDialogOpen.set(false);
  }
}
