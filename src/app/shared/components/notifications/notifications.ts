import { Component, inject } from '@angular/core';
import { RepriceNotificationService } from '../../../core/services/reprice-notification.service';

@Component({
  selector: 'app-notifications',
  imports: [],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  readonly notificationSvc = inject(RepriceNotificationService);
}
