import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class RectShape extends Shape {
  constructor(
    id: string,
    private x: number,
    private y: number,
    private width: number,
    private height: number,
    fill?: string,
  ) {
    super(id);
    Numeric.finite(x, 'x');
    Numeric.finite(y, 'y');
    Numeric.nonNegative(width, 'width');
    Numeric.nonNegative(height, 'height');
    if (fill !== undefined) this.setAttribute('fill', fill);
  }

  override get label(): string { return `rect#${this.id}`; }

  protected override prepareMove(dx: number, dy: number): () => void {
    // 先验证全部结果，再提交修改，避免只移动了一个坐标。
    const nextX = Numeric.finite(this.x + dx, 'x');
    const nextY = Numeric.finite(this.y + dy, 'y');
    return () => {
      this.x = nextX;
      this.y = nextY;
    };
  }

  protected override prepareScale(factor: number): () => void {
    const x = Numeric.finite(this.x * factor, 'x');
    const y = Numeric.finite(this.y * factor, 'y');
    const width = Numeric.finite(this.width * factor, 'width');
    const height = Numeric.finite(this.height * factor, 'height');
    return () => { this.x = x; this.y = y; this.width = width; this.height = height; };
  }

  protected override setGeometryAttribute(attribute: string, value: string): void {
    if (attribute === 'x' || attribute === 'y' || attribute === 'width' || attribute === 'height') {
      const parsed = Numeric.parse(value, attribute);
      if (attribute === 'width' || attribute === 'height') Numeric.nonNegative(parsed, attribute);
      this[attribute] = parsed;
      return;
    }
    super.setGeometryAttribute(attribute, value);
  }

  protected override geometryAttributes(): Readonly<Record<string, number>> {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  override describe(): string {
    return `${this.label} x=${this.x} y=${this.y} w=${this.width} h=${this.height}${this.describeStyles()}`;
  }
}
