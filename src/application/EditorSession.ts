import { SvgDocument } from '../domain/SvgDocument';

export class EditorSession {
  private currentDocument?: SvgDocument;

  initialize(width: number, height: number): SvgDocument {
    // 构造完成才替换，非法 init 不丢失旧文档。
    const document = new SvgDocument(width, height);
    this.currentDocument = document;
    return document;
  }

  get document(): SvgDocument {
    if (!this.currentDocument) {
      throw new Error("no document. use 'init' or 'read' first");
    }
    return this.currentDocument;
  }
}
