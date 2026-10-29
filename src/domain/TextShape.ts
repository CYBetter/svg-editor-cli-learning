import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class TextShape extends Shape {
  constructor(
    id: string,
    private x: number,
    private y: number,
    private readonly content: string,
  ) {
    super(id);
    Numeric.finite(x, 'x');
    Numeric.finite(y, 'y');
  }

  override get label(): string { return `text#${this.id}`; }

  protected override prepareMove(dx: number, dy: number): () => void {
    const nextX = Numeric.finite(this.x + dx, 'x');
    const nextY = Numeric.finite(this.y + dy, 'y');
    return () => {
      this.x = nextX;
      this.y = nextY;
    };
  }

  override describe(): string {
    return `${this.label} (${this.x},${this.y}) ${JSON.stringify(this.content)}`;
  }
}
