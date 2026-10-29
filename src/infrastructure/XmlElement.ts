/** 仅供导入阶段使用的 XML 节点；不作为编辑器的图形模型。 */
export class XmlElement {
  private readonly fields: ReadonlyMap<string, string>;
  private readonly children: XmlElement[] = [];
  private content = '';

  constructor(
    private readonly localName: string,
    private readonly namespaceUri: string,
    attributes: ReadonlyMap<string, string>,
  ) {
    this.fields = new Map(attributes);
  }

  get name(): string { return this.localName; }
  get namespace(): string { return this.namespaceUri; }
  get textContent(): string { return this.content; }

  getAttribute(name: string): string | undefined { return this.fields.get(name); }
  getAttributes(): ReadonlyMap<string, string> { return new Map(this.fields); }
  getChildren(): readonly XmlElement[] { return Object.freeze([...this.children]); }

  /** 解析器构建阶段调用；完成后只读取该临时树。 */
  appendChild(child: XmlElement): void { this.children.push(child); }
  appendText(text: string): void { this.content += text; }

  *walk(): IterableIterator<XmlElement> {
    const pending: XmlElement[] = [this];
    while (pending.length > 0) {
      const element = pending.pop()!;
      yield element;
      for (let index = element.children.length - 1; index >= 0; index--) {
        pending.push(element.children[index]);
      }
    }
  }
}
