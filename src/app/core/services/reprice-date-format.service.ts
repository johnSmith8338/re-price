import { inject, Injectable } from "@angular/core";
import { RepriceSettingsService } from "./reprice-settings.service";

@Injectable({
    providedIn: 'root'
})
export class RepriceDateFormatService {
    private readonly settingsSvc = inject(RepriceSettingsService);

    format(value: string | Date | null | undefined): string {
        if (value === null || value === undefined || value === '') return '—';

        const date = this.parseDate(value);
        if (!date) return '—';

        const day = this.pad(date.getDate());
        const month = this.pad(date.getMonth() + 1);
        const year = date.getFullYear();

        return this.settingsSvc.dateFormat() === 'dd.MM.yyyy'
            ? `${day}.${month}.${year}` : `${year}-${month}-${day}`
    }

    private parseDate(value: string | Date): Date | null {
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
        }

        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);

            const date = new Date(year, month - 1, day);

            if (
                date.getFullYear() !== year ||
                date.getMonth() !== month - 1 ||
                date.getDate() !== day
            ) {
                return null;
            }

            return date;
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    private pad(value: number): string {
        return String(value).padStart(2, '0');
    }
}