import { SvgDocument } from '../domain/SvgDocument';
import { HistoryEntry } from './HistoryEntry';

export class EditorSession {
  private currentDocument?: SvgDocument;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private historyBlocked = true;

  initialize(width: number, height: number): SvgDocument {
    // 构造完成才替换，非法 init 不丢失旧文档。
    return this.replaceDocument(new SvgDocument(width, height));
  }

  resizeCanvas(width: number, height?: number): SvgDocument {
    return this.replaceDocument(this.document.withCanvasSize(width, height));
  }

  private replaceDocument(document: SvgDocument): SvgDocument {
    // 文档操作成功后才清历史；init 和 canvas 修改共用同一边界。
    this.currentDocument = document;
    this.undoStack = [];
    this.redoStack = [];
    this.historyBlocked = true;
    return document;
  }

  edit(operation: (document: SvgDocument) => string): string {
    const before = this.document;
    const working = before.clone();
    const result = operation(working);
    // 执行和快照都成功才提交，失败不改变原文档及两个历史栈。
    const entry = new HistoryEntry(before, working, result);
    this.currentDocument = working;
    this.undoStack.push(entry);
    this.redoStack = [];
    this.historyBlocked = false;
    return result;
  }

  undo(): string {
    this.checkHistory();
    const entry = this.undoStack.at(-1);
    if (!entry) throw new Error('nothing to undo');
    const restored = entry.restoreBefore();
    this.currentDocument = restored;
    this.undoStack.pop();
    this.redoStack.push(entry);
    return `undone: ${entry.description}`;
  }

  redo(): string {
    this.checkHistory();
    const entry = this.redoStack.at(-1);
    if (!entry) throw new Error('nothing to redo');
    const restored = entry.restoreAfter();
    this.currentDocument = restored;
    this.redoStack.pop();
    this.undoStack.push(entry);
    return `redone: ${entry.description}`;
  }

  private checkHistory(): void {
    // 优先报告未初始化；init 后两种历史操作均使用课设规定的 IO 边界错误。
    void this.document;
    if (this.historyBlocked) throw new Error('undo not allowed after io command');
  }

  get document(): SvgDocument {
    if (!this.currentDocument) {
      throw new Error("no document. use 'init' or 'read' first");
    }
    return this.currentDocument;
  }
}
