import { afterNextRender, Component, DestroyRef, DOCUMENT, effect, ElementRef, inject, Injector, input, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-bottom-sheet',
  imports: [],
  templateUrl: './bottom-sheet.html',
  styleUrl: './bottom-sheet.scss',
})
export class BottomSheet {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input(false);
  readonly title = input.required<string>();

  readonly closed = output();
  readonly applied = output();

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  private previousActiveElement: HTMLElement | null = null;
  private previousBodyOverflow = '';
  private wasVisible = false;

  private pointerStartY = 0;
  private pointerCurrentY = 0;
  private isDragging = false;

  readonly dragOffset = signal(0);

  constructor() {
    effect(() => {
      const visible = this.visible();

      if (visible && !this.wasVisible) {
        this.openSheet();
      } else if (!visible && this.wasVisible) {
        this.closeSheet();
      }
    })

    this.destroyRef.onDestroy(() => {
      if (this.wasVisible) this.restoreBodyScroll();
    })
  }

  private openSheet() {
    this.wasVisible = true;
    this.dragOffset.set(0);

    this.previousActiveElement = this.document.activeElement as HTMLElement | null;
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';

    afterNextRender(() => {
      this.focusFirstElement();
    }, { injector: this.injector });
  }

  private closeSheet() {
    this.wasVisible = false;

    this.restoreBodyScroll();

    this.previousActiveElement?.focus();
    this.previousActiveElement = null;
  }

  private restoreBodyScroll() {
    this.document.body.style.overflow = this.previousBodyOverflow;
  }

  private focusFirstElement() {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog) return;

    const focusableElements = this.getFocusableElements(dialog);

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      dialog.focus();
    }
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',')

    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      element => element.getClientRects().length > 0
    )
  }

  onDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
      return;
    }

    if (event.key !== 'Tab') return;

    const dialog = this.dialog()?.nativeElement;
    if (!dialog) return;

    const focusableElements = this.getFocusableElements(dialog);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const activeElement = this.document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onDragStart(event: PointerEvent) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    const target = event.currentTarget as HTMLElement;

    this.pointerStartY = event.clientY;
    this.pointerCurrentY = event.clientY;
    this.isDragging = true;

    target.setPointerCapture(event.pointerId);
  }

  onDragMove(event: PointerEvent) {
    if (!this.isDragging) return;

    this.pointerCurrentY = event.clientY;

    const distance = this.pointerCurrentY - this.pointerStartY;

    this.dragOffset.set(Math.max(0, distance));
  }

  onDragEnd() {
    if (!this.isDragging) return;

    this.isDragging = false;

    const dialog = this.dialog()?.nativeElement;
    if (!dialog) return;

    const closeThreshold = dialog.offsetHeight * 0.25;

    if (this.dragOffset() >= closeThreshold) {
      this.dragOffset.set(0);
      this.closed.emit();
    } else {
      this.dragOffset.set(0);
    }
  }

  onDragCancel() {
    this.isDragging = false;
    this.dragOffset.set(0);
  }
}
