import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class SvgDocument {
  private readonly shapes = new Map<string, Shape>();

  constructor(private readonly width: number, private readonly height: number) {
    Numeric.positive(width, 'canvas width');
    Numeric.positive(height, 'canvas height');
  }

  get size(): string { return `${this.width}x${this.height}`; }

  add(shape: Shape): void {
    if (this.shapes.has(shape.id)) throw new Error(`id already exists: ${shape.id}`);
    this.shapes.set(shape.id, shape);
  }

  find(id: string): Shape {
    const shape = this.shapes.get(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }

  tree(id?: string): string {
    if (id !== undefined) return this.find(id).describe();
    const rows = [`svg (${this.size})`];
    const shapes = [...this.shapes.values()];
    shapes.forEach((shape, index) => {
      rows.push(`${index === shapes.length - 1 ? '└──' : '├──'} ${shape.describe()}`);
    });
    return rows.join('\n');
  }
}
