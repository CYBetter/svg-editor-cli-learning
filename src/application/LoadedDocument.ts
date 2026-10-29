import { SvgDocument } from '../domain/SvgDocument';

/** 完整导入结果；警告在会话成功接收文档后才呈现。 */
export class LoadedDocument {
  private readonly messages: readonly string[];

  constructor(
    private readonly imported: SvgDocument,
    private readonly originPath: string,
    warnings: readonly string[],
  ) {
    this.messages = Object.freeze([...warnings]);
  }

  get document(): SvgDocument { return this.imported; }
  get sourcePath(): string { return this.originPath; }

  describe(displayPath: string): string {
    return [...this.messages, `read ${displayPath} (${this.imported.elementCount} elements)`].join('\n');
  }
}
