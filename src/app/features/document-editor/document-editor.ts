import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-document-editor',
  imports: [],
  templateUrl: './document-editor.html',
  styleUrl: './document-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentEditor {}
