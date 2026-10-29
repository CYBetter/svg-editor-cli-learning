import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class SvgDocument {
  private readonly shapes = new Map<string, Shape>();
  private readonly roots: Shape[] = [];

  constructor(private readonly width: number, private readonly height: number) {
    Numeric.positive(width, 'canvas width');
    Numeric.positive(height, 'canvas height');
  }

  get size(): string { return `${this.width}x${this.height}`; }

  add(shape: Shape, containerId?: string): void {
    const parent = containerId === undefined ? undefined : this.findContainer(containerId);
    const incoming = [...shape.walk()];
    const ids = new Set<string>();
    for (const node of incoming) {
      if (this.shapes.has(node.id) || ids.has(node.id)) throw new Error(`id already exists: ${node.id}`);
      ids.add(node.id);
    }
    if (shape.isAttached) throw new Error(`shape already attached: ${shape.id}`);
    if (parent) parent.appendChild(shape);
    else {
      shape.markAttached();
      this.roots.push(shape);
    }
    for (const node of incoming) this.shapes.set(node.id, node);
  }

  private findContainer(id: string): Shape {
    const shape = this.shapes.get(id);
    if (!shape) throw new Error(`no such container: ${id}`);
    if (!shape.isContainer) throw new Error(`not a container: ${id}`);
    return shape;
  }

  find(id: string): Shape {
    const shape = this.shapes.get(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }

  tree(id?: string): string {
    const shape = id === undefined ? undefined : this.find(id);
    const rows = [shape ? shape.describe() : `svg (${this.size})`];
    this.appendTreeRows(shape ? shape.getChildren() : this.roots, '', rows);
    return rows.join('\n');
  }

  show(id: string): string {
    const shape = this.find(id);
    let parent = 'svg';
    for (const candidate of this.shapes.values()) {
      if (candidate.getChildren().includes(shape)) { parent = candidate.label; break; }
    }
    return [`${shape.label}  parent=${parent}`, ...shape.details().map(line => `  ${line}`)].join('\n');
  }

  private appendTreeRows(shapes: readonly Shape[], prefix: string, rows: string[]): void {
    shapes.forEach((shape, index) => {
      const last = index === shapes.length - 1;
      rows.push(`${prefix}${last ? '└──' : '├──'} ${shape.describe()}`);
      this.appendTreeRows(shape.getChildren(), prefix + (last ? '    ' : '│   '), rows);
    });
  }
}
