import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class EllipseShape extends Shape {
  constructor(
    id: string,
    private cx: number,
    private cy: number,
    private readonly rx: number,
    private readonly ry: number,
    private readonly fill?: string,
  ) {
    super(id);
    Numeric.finite(cx, 'cx');
    Numeric.finite(cy, 'cy');
    Numeric.nonNegative(rx, 'rx');
    Numeric.nonNegative(ry, 'ry');
  }

  override get label(): string { return `ellipse#${this.id}`; }

  protected override prepareMove(dx: number, dy: number): () => void {
    const nextCx = Numeric.finite(this.cx + dx, 'cx');
    const nextCy = Numeric.finite(this.cy + dy, 'cy');
    return () => {
      this.cx = nextCx;
      this.cy = nextCy;
    };
  }

  override describe(): string {
    const style = this.fill === undefined ? '' : ` fill=${this.fill}`;
    return `${this.label} cx=${this.cx} cy=${this.cy} rx=${this.rx} ry=${this.ry}${style}`;
  }
}
