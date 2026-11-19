import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RepriceStore } from '../../core/services/reprice.store';
import { RepriceDocument } from '../../core/models/reprice-document.model';
import { RepriceProduct } from '../../core/models/reprice-product.model';

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

  readonly document = signal<RepriceDocument | null>(null);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  private operationQueue: Promise<void> = Promise.resolve();

  constructor() {
    void this.initialize();
  }

  get isReadOnly(): boolean {
    return this.document()?.status === 'completed';
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

    this.enqueueOperation(document => this.store.updateDetails(document.id, { name }))
  }

  updateDate(event: Event) {
    const date = this.getInputValue(event);

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
    if (!rawValue) {
      if (field === 'oldPrice') {
        this.updateProduct(productId, { oldPrice: null });
      } else {
        this.updateProduct(productId, { newPrice: null });
      }

      return;
    }

    const price = Number(rawValue);

    if (!Number.isFinite(price) || price < 0) {
      this.error.set('Цена должна быть неотрицательным числом');
      return;
    }

    const priceInMinorUnits = Math.round(price * 100);

    if (!Number.isSafeInteger(priceInMinorUnits)) {
      this.error.set('Слишком большое значение цены');
      return;
    }

    if (field === 'oldPrice') {
      this.updateProduct(productId, { oldPrice: priceInMinorUnits });
    } else {
      this.updateProduct(productId, { newPrice: priceInMinorUnits });
    }

    // this.updateProduct(productId, { [field]: priceInMinorUnits });
  }

  addProduct() {
    this.enqueueOperation(document => this.store.addProduct(document.id))
  }

  removeProduct(productId: string) {
    this.enqueueOperation(document => this.store.removeProduct(document.id, productId));
  }

  completeDocument() {
    this.enqueueOperation(document => this.store.completeDocument(document.id));
  }

  reopenDocument() {
    this.enqueueOperation(document => this.store.reopenDocument(document.id), true)
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

  private enqueueOperation(operation: (document: RepriceDocument) => Promise<RepriceDocument>, allowCompleted = false) {
    this.operationQueue = this.operationQueue.then(async () => {
      const currentDocument = this.document();
      if (!currentDocument) return;
      if (currentDocument.status === 'completed' && !allowCompleted) return;

      this.saving.set(true);
      this.error.set(null);

      try {
        const updatedDocument = await operation(currentDocument);

        this.document.set(updatedDocument);
      } catch (error) {
        this.error.set(this.getErrorMessage(error));
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
}
