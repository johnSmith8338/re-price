import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-bottom-sheet',
  imports: [],
  templateUrl: './bottom-sheet.html',
  styleUrl: './bottom-sheet.scss',
})
export class BottomSheet {
  readonly visible = input(false);
  readonly title = input.required<string>();

  readonly closed = output();
  readonly applied = output();
}
