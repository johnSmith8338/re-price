import { Injectable, signal } from "@angular/core";

export type RepriceNotificationType = 'success' | 'error' | 'warning' | 'info';

export interface RepriceNotification {
    id: number;
    type: RepriceNotificationType;
    message: string;
}

@Injectable({
    providedIn: 'root'
})
export class RepriceNotificationService {
    private readonly _notifications = signal<RepriceNotification[]>([]);

    readonly notifications = this._notifications.asReadonly();

    private nextId = 0;

    private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

    show(message: string, type: RepriceNotificationType = 'info', duration = 4000) {
        const id = ++this.nextId;
        const notification: RepriceNotification = {
            id,
            type,
            message
        }

        this._notifications.update(notifications => [
            ...notifications,
            notification
        ])

        if (duration > 0) {
            const timer = setTimeout(() => {
                this.dismiss(id);
            }, duration)

            this.timers.set(id, timer);
        }
    }

    success(message: string, duration = 4000) {
        this.show(message, 'success', duration);
    }

    error(message: string, duration = 6000) {
        this.show(message, 'error', duration);
    }

    warning(message: string, duration = 5000) {
        this.show(message, 'warning', duration);
    }

    info(message: string, duration = 4000) {
        this.show(message, 'info', duration);
    }

    dismiss(id: number) {
        const timer = this.timers.get(id);

        if (timer !== undefined) {
            clearTimeout(timer);
            this.timers.delete(id);
        }

        this._notifications.update(notifications =>
            notifications.filter(notification => notification.id !== id)
        )
    }

    clear() {
        for (const timer of this.timers.values()) clearTimeout(timer);

        this.timers.clear();
        this._notifications.set([]);
    }
}