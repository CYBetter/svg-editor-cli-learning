import { DrawingWriter } from './DrawingWriter';
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

  /** 树结构内部接口：只解除子树根的归属，后代仍属于该子树。 */
  markDetached(): void {
    if (!this.attached) throw new Error(`shape is not attached: ${this.id}`);
    this.attached = false;
  }

  getChildren(): readonly Shape[] { return Object.freeze([]); }

  /** 树结构内部接口；编辑命令应通过 SvgDocument 插入。 */
  appendChild(_shape: Shape): void {
    throw new Error(`not a container: ${this.id}`);
  }

  /** 树结构内部接口；编辑命令应通过 SvgDocument 删除。 */
  removeChild(_shape: Shape): void {
    throw new Error(`not a container: ${this.id}`);
  }

  /** 同级重排内部接口；不改变对象的归属或几何值。 */
  reorderChild(_shape: Shape, _toFront: boolean): void {
    throw new Error(`not a container: ${this.id}`);
  }

  /** @internal 仅供 SvgDocument 验证完整树后同步提交，不保存为历史。 */
  prepareChildren(_children: readonly Shape[]): () => void {
    throw new Error(`not a container: ${this.id}`);
  }

  *walk(): IterableIterator<Shape> {
    yield this;
    for (const child of this.getChildren()) yield* child.walk();
  }

  clone(): Shape {
    const copy = this.cloneGeometry();
    for (const [name, value] of this.styles) copy.styles.set(name, value);
    return copy;
  }

  protected abstract cloneGeometry(): Shape;

  writeTo(writer: DrawingWriter): string {
    return writer.element(
      this.elementName,
      { id: this.id, ...this.outputAttributes(), ...Object.fromEntries(this.styles) },
      this.getChildren().map(child => child.writeTo(writer)),
      this.textContent,
    );
  }

  protected abstract get elementName(): string;
  protected get textContent(): string | undefined { return undefined; }
  protected outputAttributes(): Readonly<Record<string, number | string>> {
    return this.geometryAttributes();
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
