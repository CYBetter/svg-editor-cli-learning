import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class TextShape extends Shape {
  constructor(
    id: string,
    private x: number,
    private y: number,
    private content: string,
  ) {
    super(id);
    Numeric.finite(x, 'x');
    Numeric.finite(y, 'y');
  }

  override get label(): string { return `text#${this.id}`; }

  protected override cloneGeometry(): TextShape {
    return new TextShape(this.id, this.x, this.y, this.content);
  }

  protected override prepareMove(dx: number, dy: number): () => void {
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
    return () => { this.x = x; this.y = y; };
  }

  protected override setGeometryAttribute(attribute: string, value: string): void {
    if (attribute === 'text') { this.content = value; return; }
    if (attribute === 'x' || attribute === 'y') {
      this[attribute] = Numeric.parse(value, attribute);
      return;
    }
    super.setGeometryAttribute(attribute, value);
  }

  protected override geometryAttributes(): Readonly<Record<string, number | string>> {
    return { x: this.x, y: this.y, text: this.content };
  }

  override describe(): string {
    return `${this.label} (${this.x},${this.y}) ${JSON.stringify(this.content)}${this.describeStyles()}`;
  }
}
