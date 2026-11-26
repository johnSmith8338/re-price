import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RepriceSettingsService } from '../../core/services/reprice-settings.service';
import { RepriceDateFormat, RepriceTheme } from '../../core/models/reprice-settings.model';
import { RepriceBackupService } from '../../core/services/reprice-backup.service';
import { RepriceNotificationService } from '../../core/services/reprice-notification.service';
import { RepriceBackupFile, RepriceRestoreStategy } from '../../core/models/reprice-backup.model';
import { BottomSheet } from '../../shared/components/bottom-sheet/bottom-sheet';

@Component({
  selector: 'app-settings',
  imports: [BottomSheet],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly settingsSvc = inject(RepriceSettingsService);
  private readonly backupSvc = inject(RepriceBackupService);
  private readonly notification = inject(RepriceNotificationService);

  readonly settings = this.settingsSvc.settings;

  readonly backupInProgress = signal(false);
  readonly backupPreview = signal<RepriceBackupFile | null>(null);
  readonly backupReadInProgress = signal(false);
  readonly restoreStrategy = signal<RepriceRestoreStategy>('skip-existing');
  readonly restoreInProgress = signal(false);

  readonly backupPreviewOpen = signal(false);
  readonly restoreConfirmationOpen = signal(false);

  readonly backupPreviewSummary = computed(() => {
    const backup = this.backupPreview();
    if (!backup) return null;

    return {
      total: backup.documents.length,
      drafts: backup.documents.filter(document =>
        document.status === 'draft'
      ).length,
      completed: backup.documents.filter(document =>
        document.status === 'completed'
      ).length,
      products: backup.documents.reduce((total, document) =>
        total + document.products.length, 0
      )
    }
  })

  readonly restorePlan = computed(() => {
    const backup = this.backupPreview();
    if (!backup) return null;

    return this.backupSvc.prepareRestore(
      backup,
      this.restoreStrategy()
    )
  })

  async onBackupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.backupReadInProgress()) {
      return;
    }

    this.backupReadInProgress.set(true);
    this.backupPreview.set(null);

    try {
      const backup = await this.backupSvc.readBackup(file);

      this.backupPreview.set(backup);
      this, this.restoreStrategy.set('skip-existing');
      this.backupPreviewOpen.set(true);

      this.notification.success('Резервная копия успешно проверена');
    } catch (error) {
      console.error('Ошибка чтения резервной копии', error);

      const message = error instanceof Error
        ? error.message
        : 'Не удалось прочитать резервную копию';

      this.notification.error(message);
    } finally {
      this.backupReadInProgress.set(false);
      input.value = '';
    }
  }

  clearBackupPreview(): void {
    this.backupPreview.set(null);
    this.backupPreviewOpen.set(false);
    this.restoreConfirmationOpen.set(false);
    this.restoreStrategy.set('skip-existing');
  }

  onThemeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;

    if (this.isTheme(value)) {
      this.settingsSvc.updateSettings({
        theme: value
      })
    }
  }

  onDateFormatChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (this.isDateFormat(value)) {
      this.settingsSvc.updateSettings({
        dateFormat: value
      });
    }
  }

  onConfirmBeforeDeleteChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    this.settingsSvc.updateSettings({
      confirmBeforeDelete: checked
    });
  }

  resetSettings() {
    this.settingsSvc.resetSettings();
  }

  private isTheme(value: string): value is RepriceTheme {
    return value === 'system' ||
      value === 'light' ||
      value === 'dark';
  }

  private isDateFormat(value: string): value is RepriceDateFormat {
    return value === 'dd.MM.yyyy' ||
      value === 'yyyy-MM-dd';
  }

  async createBackup(): Promise<void> {
    if (this.backupInProgress()) return;

    this.backupInProgress.set(true);

    try {
      const filename = await this.backupSvc.exportBackup();

      this.notification.success(`Резервная копия создана: ${filename}`);
    } catch (error) {
      console.error('Не удалось создать резервную копию', error);
      this.notification.error('Не удалось создать резервную копию');
    } finally {
      this.backupInProgress.set(false);
    }
  }

  onRestoreStrategyChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;

    if (value === 'skip-existing' || value === 'replace-existing' || value === 'copy-all') this.restoreStrategy.set(value);
  }

  async restoreBackup(): Promise<void> {
    const backup = this.backupPreview();
    if (!backup || this.restoreInProgress()) return;

    const strategy = this.restoreStrategy();
    const plan = this.restorePlan();

    if (!plan || plan.documents.length === 0) {
      this.notification.warning('Нет документов для восстановления');
      return;
    }

    this.restoreInProgress.set(true);

    try {
      const result = await this.backupSvc.restoreBackup(
        backup,
        strategy
      );

      this.notification.success(
        `Восстановление завершено. ` +
        `Добавлено: ${result.newCount}, ` +
        `заменено: ${result.replacedCount}, ` +
        `пропущено: ${result.skippedCount}, ` +
        `копий: ${result.copiedCount}`
      );

      this.clearBackupPreview();

    } catch (error) {
      console.error('Ошибка восстановления резервной копии', error);

      this.notification.error(
        error instanceof Error ? error.message : 'Не удалось восстановить резервную копию'
      );

      this.restoreConfirmationOpen.set(false);
      this.backupPreviewOpen.set(true);

    } finally {
      this.restoreInProgress.set(false);
    }
  }

  requestRestore() {
    const plan = this.restorePlan();
    if (!plan || plan.documents.length === 0 || this.restoreInProgress()) return;

    this.restoreConfirmationOpen.set(true);
  }

  cancelRestore() {
    this.restoreConfirmationOpen.set(false);
  }

  onBackupSheetClosed() {
    if (this.restoreConfirmationOpen()) {
      this.restoreConfirmationOpen.set(false);
      return;
    }

    this.clearBackupPreview();
  }
}
