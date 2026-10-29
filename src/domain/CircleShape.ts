import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class CircleShape extends Shape {
  constructor(
    id: string,
    private cx: number,
    private cy: number,
    private readonly radius: number,
    private readonly fill?: string,
  ) {
    super(id);
    Numeric.finite(cx, 'cx');
    Numeric.finite(cy, 'cy');
    Numeric.nonNegative(radius, 'r');
  }

  override get label(): string { return `circle#${this.id}`; }

  override move(dx: number, dy: number): void {
    Numeric.finite(dx, 'dx');
    Numeric.finite(dy, 'dy');
    // 移动只改变圆心；同样先检查全部结果再修改。
    const nextCx = Numeric.finite(this.cx + dx, 'cx');
    const nextCy = Numeric.finite(this.cy + dy, 'cy');
    this.cx = nextCx;
    this.cy = nextCy;
  }

  override describe(): string {
    const style = this.fill === undefined ? '' : ` fill=${this.fill}`;
    return `${this.label} cx=${this.cx} cy=${this.cy} r=${this.radius}${style}`;
  }
}
