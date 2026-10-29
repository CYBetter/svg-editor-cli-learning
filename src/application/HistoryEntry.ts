import { SvgDocument } from '../domain/SvgDocument';

export class HistoryEntry {
  private readonly before: SvgDocument;
  private readonly after: SvgDocument;

  constructor(before: SvgDocument, after: SvgDocument, private readonly summary: string) {
    this.before = before.clone();
    this.after = after.clone();
  }

  get description(): string { return this.summary; }

  restoreBefore(): SvgDocument { return this.before.clone(); }

  restoreAfter(): SvgDocument { return this.after.clone(); }
}
