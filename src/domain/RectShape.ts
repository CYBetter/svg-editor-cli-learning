import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class RectShape extends Shape {
  constructor(
    id: string,
    private x: number,
    private y: number,
    private readonly width: number,
    private readonly height: number,
    private readonly fill?: string,
  ) {
    super(id);
    Numeric.finite(x, 'x');
    Numeric.finite(y, 'y');
    Numeric.nonNegative(width, 'width');
    Numeric.nonNegative(height, 'height');
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

  override describe(): string {
    const style = this.fill === undefined ? '' : ` fill=${this.fill}`;
    return `${this.label} x=${this.x} y=${this.y} w=${this.width} h=${this.height}${style}`;
  }
}
