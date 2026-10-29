import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class CircleShape extends Shape {
  constructor(
    id: string,
    private cx: number,
    private cy: number,
    private radius: number,
    fill?: string,
  ) {
    super(id);
    Numeric.finite(cx, 'cx');
    Numeric.finite(cy, 'cy');
    Numeric.nonNegative(radius, 'r');
    if (fill !== undefined) this.setAttribute('fill', fill);
  }

  override get label(): string { return `circle#${this.id}`; }

  protected override prepareMove(dx: number, dy: number): () => void {
    // 移动只改变圆心；同样先检查全部结果再修改。
    const nextCx = Numeric.finite(this.cx + dx, 'cx');
    const nextCy = Numeric.finite(this.cy + dy, 'cy');
    return () => {
      this.cx = nextCx;
      this.cy = nextCy;
    };
  }

  protected override prepareScale(factor: number): () => void {
    const cx = Numeric.finite(this.cx * factor, 'cx');
    const cy = Numeric.finite(this.cy * factor, 'cy');
    const radius = Numeric.finite(this.radius * factor, 'r');
    return () => { this.cx = cx; this.cy = cy; this.radius = radius; };
  }

  protected override setGeometryAttribute(attribute: string, value: string): void {
    if (attribute === 'cx' || attribute === 'cy') {
      this[attribute] = Numeric.parse(value, attribute);
      return;
    }
    if (attribute === 'r') {
      this.radius = Numeric.nonNegative(Numeric.parse(value, attribute), attribute);
      return;
    }
    super.setGeometryAttribute(attribute, value);
  }

  protected override geometryAttributes(): Readonly<Record<string, number>> {
    return { cx: this.cx, cy: this.cy, r: this.radius };
  }

  override describe(): string {
    return `${this.label} cx=${this.cx} cy=${this.cy} r=${this.radius}${this.describeStyles()}`;
  }
}
