import { Numeric } from './Numeric';

export abstract class Shape {
  private attached = false;
  private readonly styles = new Map<string, string>();

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

  scale(factor: number): void {
    Numeric.finite(factor, 'scale factor');
    if (factor <= 0) throw new Error('scale factor must be positive');
    const apply = this.prepareScale(factor);
    apply();
  }

  setAttribute(attribute: string, value: string): void {
    if (attribute === 'fill' || attribute === 'stroke') {
      this.styles.set(attribute, value);
      return;
    }
    if (attribute === 'stroke-width') {
      const width = Numeric.nonNegative(Numeric.parse(value, attribute), attribute);
      this.styles.set(attribute, String(width));
      return;
    }
    this.setGeometryAttribute(attribute, value);
  }

  details(): readonly string[] {
    const geometry = Object.entries(this.geometryAttributes()).map(([name, value]) =>
      `${name}=${typeof value === 'string' ? JSON.stringify(value) : value}`).join(' ');
    return [geometry, this.describeStyles().trimStart()].filter(line => line.length > 0);
  }

  protected describeStyles(): string {
    return ['fill', 'stroke', 'stroke-width'].filter(name => this.styles.has(name))
      .map(name => ` ${name}=${this.styles.get(name)}`).join('');
  }

  protected geometryAttributes(): Readonly<Record<string, number | string>> { return {}; }

  protected setGeometryAttribute(attribute: string, _value: string): void {
    throw new Error(`unknown attribute: ${attribute}`);
  }

  // 准备阶段只计算与校验；返回的回调只能赋值，并立即同步执行。
  protected abstract prepareMove(dx: number, dy: number): () => void;
  protected abstract prepareScale(factor: number): () => void;

  protected static prepareChildMove(shape: Shape, dx: number, dy: number): () => void {
    return shape.prepareMove(dx, dy);
  }

  protected static prepareChildScale(shape: Shape, factor: number): () => void {
    return shape.prepareScale(factor);
  }

  abstract get label(): string;
  abstract describe(): string;
}
