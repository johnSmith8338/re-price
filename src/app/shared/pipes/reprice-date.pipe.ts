import { inject, Pipe, PipeTransform } from "@angular/core";
import { RepriceDateFormatService } from "../../core/services/reprice-date-format.service";

@Pipe({
    name: 'repriceDate',
    standalone: true,
    pure: false
})
export class RepriceDatePipe implements PipeTransform {
    private readonly dateFormatSvc = inject(RepriceDateFormatService);

    transform(value: string | Date | null | undefined): string {
        return this.dateFormatSvc.format(value);
    }
}