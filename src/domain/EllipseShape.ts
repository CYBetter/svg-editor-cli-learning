import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class EllipseShape extends Shape {
  constructor(
    id: string,
    private cx: number,
    private cy: number,
    private rx: number,
    private ry: number,
    fill?: string,
  ) {
    super(id);
    Numeric.finite(cx, 'cx');
    Numeric.finite(cy, 'cy');
    Numeric.nonNegative(rx, 'rx');
    Numeric.nonNegative(ry, 'ry');
    if (fill !== undefined) this.setAttribute('fill', fill);
  }

  override get label(): string { return `ellipse#${this.id}`; }

  protected override cloneGeometry(): EllipseShape {
    return new EllipseShape(this.id, this.cx, this.cy, this.rx, this.ry);
  }

  protected override prepareMove(dx: number, dy: number): () => void {
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
    const rx = Numeric.finite(this.rx * factor, 'rx');
    const ry = Numeric.finite(this.ry * factor, 'ry');
    return () => { this.cx = cx; this.cy = cy; this.rx = rx; this.ry = ry; };
  }

  protected override setGeometryAttribute(attribute: string, value: string): void {
    if (attribute === 'cx' || attribute === 'cy' || attribute === 'rx' || attribute === 'ry') {
      const parsed = Numeric.parse(value, attribute);
      if (attribute === 'rx' || attribute === 'ry') Numeric.nonNegative(parsed, attribute);
      this[attribute] = parsed;
      return;
    }
    super.setGeometryAttribute(attribute, value);
  }

  protected override geometryAttributes(): Readonly<Record<string, number>> {
    return { cx: this.cx, cy: this.cy, rx: this.rx, ry: this.ry };
  }

  override describe(): string {
    return `${this.label} cx=${this.cx} cy=${this.cy} rx=${this.rx} ry=${this.ry}${this.describeStyles()}`;
  }
}
