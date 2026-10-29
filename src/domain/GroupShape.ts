import { Shape } from './Shape';

export class GroupShape extends Shape {
  private readonly children: Shape[] = [];

  override get label(): string { return `g#${this.id}`; }
  override get isContainer(): boolean { return true; }

  override getChildren(): readonly Shape[] {
    return Object.freeze([...this.children]);
  }

  /** 内部挂接接口：已有文档的插入统一从 SvgDocument.add 进入。 */
  override appendChild(shape: Shape): void {
    const incoming = [...shape.walk()];
    if (incoming.includes(this)) throw new Error(`cannot create a cycle: ${shape.id}`);
    if (shape.isAttached) throw new Error(`shape already attached: ${shape.id}`);
    const ids = new Set([...this.walk()].map(node => node.id));
    for (const node of incoming) {
      if (ids.has(node.id)) throw new Error(`id already exists: ${node.id}`);
      ids.add(node.id);
    }
    shape.markAttached();
    this.children.push(shape);
  }

  override removeChild(shape: Shape): void {
    const index = this.childIndex(shape);
    shape.markDetached();
    this.children.splice(index, 1);
  }

  override reorderChild(shape: Shape, toFront: boolean): void {
    const index = this.childIndex(shape);
    this.children.splice(index, 1);
    if (toFront) this.children.push(shape);
    else this.children.unshift(shape);
  }

  private childIndex(shape: Shape): number {
    const index = this.children.indexOf(shape);
    if (index < 0) throw new Error(`not a direct child: ${shape.id}`);
    return index;
  }

  protected override prepareMove(dx: number, dy: number): () => void {
    // 所有子树准备成功后，才执行其中任何一个更新。
    const updates = this.children.map(child => GroupShape.prepareChildMove(child, dx, dy));
    return () => { for (const apply of updates) apply(); };
  }

  protected override prepareScale(factor: number): () => void {
    const updates = this.children.map(child => GroupShape.prepareChildScale(child, factor));
    return () => { for (const apply of updates) apply(); };
  }

  override describe(): string { return this.label + this.describeStyles(); }
}
