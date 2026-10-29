import { Numeric } from './Numeric';

export abstract class Shape {
  private attached = false;

  constructor(private readonly shapeId: string) {
    if (shapeId.length === 0) throw new Error('id must not be empty');
  }

  get id(): string { return this.shapeId; }
  get isContainer(): boolean { return false; }
  get isAttached(): boolean { return this.attached; }

  /** 树结构内部接口，仅由 SvgDocument / 容器插入流程调用。 */
  markAttached(): void {
    if (this.attached) throw new Error(`shape already attached: ${this.id}`);
    this.attached = true;
  }

  getChildren(): readonly Shape[] { return Object.freeze([]); }

  /** 树结构内部接口；编辑命令应通过 SvgDocument 插入。 */
  appendChild(_shape: Shape): void {
    throw new Error(`not a container: ${this.id}`);
  }

  *walk(): IterableIterator<Shape> {
    yield this;
    for (const child of this.getChildren()) yield* child.walk();
  }

  move(dx: number, dy: number): void {
    Numeric.finite(dx, 'dx');
    Numeric.finite(dy, 'dy');
    const apply = this.prepareMove(dx, dy);
    apply();
  }

  // 准备阶段只计算与校验；返回的回调只能赋值，并立即同步执行。
  protected abstract prepareMove(dx: number, dy: number): () => void;

  protected static prepareChildMove(shape: Shape, dx: number, dy: number): () => void {
    return shape.prepareMove(dx, dy);
  }

  abstract get label(): string;
  abstract describe(): string;
}
