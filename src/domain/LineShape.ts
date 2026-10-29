import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class LineShape extends Shape {
  constructor(
    id: string,
    private x1: number,
    private y1: number,
    private x2: number,
    private y2: number,
    stroke?: string,
  ) {
    super(id);
    Numeric.finite(x1, 'x1');
    Numeric.finite(y1, 'y1');
    Numeric.finite(x2, 'x2');
    Numeric.finite(y2, 'y2');
    if (stroke !== undefined) this.setAttribute('stroke', stroke);
  }

  override get label(): string { return `line#${this.id}`; }

  protected override prepareMove(dx: number, dy: number): () => void {
    // 两个端点共四个坐标，全部计算成功后再一起更新。
    const nextX1 = Numeric.finite(this.x1 + dx, 'x1');
    const nextY1 = Numeric.finite(this.y1 + dy, 'y1');
    const nextX2 = Numeric.finite(this.x2 + dx, 'x2');
    const nextY2 = Numeric.finite(this.y2 + dy, 'y2');
    return () => {
      this.x1 = nextX1;
      this.y1 = nextY1;
      this.x2 = nextX2;
      this.y2 = nextY2;
    };
  }

  protected override prepareScale(factor: number): () => void {
    const x1 = Numeric.finite(this.x1 * factor, 'x1');
    const y1 = Numeric.finite(this.y1 * factor, 'y1');
    const x2 = Numeric.finite(this.x2 * factor, 'x2');
    const y2 = Numeric.finite(this.y2 * factor, 'y2');
    return () => { this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2; };
  }

  protected override setGeometryAttribute(attribute: string, value: string): void {
    if (attribute === 'x1' || attribute === 'y1' || attribute === 'x2' || attribute === 'y2') {
      this[attribute] = Numeric.parse(value, attribute);
      return;
    }
    super.setGeometryAttribute(attribute, value);
  }

  protected override geometryAttributes(): Readonly<Record<string, number>> {
    return { x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2 };
  }

  override describe(): string {
    return `${this.label} (${this.x1},${this.y1}) -> (${this.x2},${this.y2})${this.describeStyles()}`;
  }
}
