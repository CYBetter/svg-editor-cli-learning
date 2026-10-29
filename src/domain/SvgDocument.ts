import { GroupShape } from './GroupShape';
import { Numeric } from './Numeric';
import { Shape } from './Shape';

export class SvgDocument {
  private shapes = new Map<string, Shape>();
  private roots: Shape[] = [];

  constructor(private readonly width: number, private readonly height: number) {
    Numeric.positive(width, 'canvas width');
    Numeric.positive(height, 'canvas height');
  }

  get size(): string { return `${this.width}x${this.height}`; }

  clone(): SvgDocument {
    return this.withCanvasSize(this.width, this.height);
  }

  withCanvasSize(width: number, height: number = this.height): SvgDocument {
    // 先验证两项尺寸，再复制图形；修改画布不改变图形的几何值。
    const copy = new SvgDocument(width, height);
    for (const root of this.roots) copy.add(root.clone());
    return copy;
  }

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

  remove(id: string): Shape {
    const shape = this.find(id);
    const parent = this.findParent(shape);
    // 先收集完整子树，摘离后再统一释放全部 id。
    const removed = [...shape.walk()];
    if (parent) parent.removeChild(shape);
    else {
      shape.markDetached();
      this.roots.splice(this.roots.indexOf(shape), 1);
    }
    for (const node of removed) this.shapes.delete(node.id);
    return shape;
  }

  bringToFront(id: string): Shape { return this.reorder(id, true); }

  sendToBack(id: string): Shape { return this.reorder(id, false); }

  group(id: string, memberIds: readonly string[]): GroupShape {
    if (this.shapes.has(id)) throw new Error(`id already exists: ${id}`);
    const group = new GroupShape(id);
    if (memberIds.length < 2) throw new Error('group requires at least two shapes');
    const selected = new Set<Shape>();
    for (const memberId of memberIds) {
      const member = this.find(memberId);
      if (selected.has(member)) throw new Error(`duplicate shape id in group: ${memberId}`);
      selected.add(member);
    }
    for (const member of selected) {
      for (const descendant of member.walk()) {
        if (descendant !== member && selected.has(descendant)) {
          throw new Error(`cannot group a container into its own descendant: ${member.id}`);
        }
      }
    }
    const ordered = this.roots.flatMap(root => [...root.walk()]).filter(shape => selected.has(shape));
    const paths = ordered.map(shape => this.ancestorPath(shape));
    const parent = paths[0].find(candidate => paths.every(path => path.includes(candidate)));
    const siblings = parent?.getChildren() ?? this.roots;
    // 跨父级时，放在最早包含选中节点的分支之前；同父级即首个选中节点的位置。
    const index = siblings.findIndex(branch => [...branch.walk()].some(shape => selected.has(shape)));
    const changes = new Map<Shape | undefined, Shape[]>();
    for (const member of ordered) {
      const previous = this.editChildren(changes, this.findParent(member));
      previous.splice(previous.indexOf(member), 1);
    }
    this.editChildren(changes, parent).splice(index, 0, group);
    changes.set(group, ordered);
    this.applyStructure(changes, group);
    return group;
  }

  addTo(containerId: string, id: string): Shape {
    const target = this.findContainer(containerId);
    const shape = this.find(id);
    if (target === shape) throw new Error(`cannot move a container into itself: ${id}`);
    if ([...shape.walk()].includes(target)) {
      throw new Error(`cannot move a container into its own descendant: ${id}`);
    }
    const changes = new Map<Shape | undefined, Shape[]>();
    const previous = this.editChildren(changes, this.findParent(shape));
    previous.splice(previous.indexOf(shape), 1);
    this.editChildren(changes, target).push(shape);
    this.applyStructure(changes);
    return shape;
  }

  ungroup(id: string): Shape {
    const group = this.find(id);
    if (!group.isContainer) throw new Error(`not a container: ${id}`);
    const parent = this.findParent(group);
    if (!parent) throw new Error(`cannot ungroup top-level container: ${id}`);
    const siblings = parent.getChildren();
    const index = siblings.indexOf(group);
    const changes = new Map<Shape | undefined, Shape[]>([
      [parent, [...siblings.slice(0, index), ...group.getChildren(), ...siblings.slice(index + 1)]],
      [group, []],
    ]);
    this.applyStructure(changes, undefined, group);
    return group;
  }

  private ancestorPath(shape: Shape): (Shape | undefined)[] {
    const path: (Shape | undefined)[] = [];
    let parent = this.findParent(shape);
    while (parent) { path.push(parent); parent = this.findParent(parent); }
    path.push(undefined); // undefined 表示真实 SVG 根，不伪造可寻址的 g。
    return path;
  }

  private editChildren(changes: Map<Shape | undefined, Shape[]>, parent: Shape | undefined): Shape[] {
    let children = changes.get(parent);
    if (!children) {
      children = [...(parent?.getChildren() ?? this.roots)];
      changes.set(parent, children);
    }
    return children;
  }

  private applyStructure(
    changes: ReadonlyMap<Shape | undefined, readonly Shape[]>, added?: Shape, removed?: Shape,
  ): void {
    const expected = new Set(this.shapes.values());
    if (added) {
      if (added.isAttached) throw new Error(`shape already attached: ${added.id}`);
      expected.add(added);
    }
    if (removed) {
      if (!removed.isAttached) throw new Error(`shape is not attached: ${removed.id}`);
      expected.delete(removed);
    }
    const nextRoots = [...(changes.get(undefined) ?? this.roots)];
    const nextShapes = new Map<string, Shape>();
    const pending = [...nextRoots].reverse();
    // 检查拟议的新树，而不修改当前树：重复节点/环会重复访问同一 id。
    while (pending.length > 0) {
      const shape = pending.pop()!;
      if (!expected.has(shape)) throw new Error(`unexpected shape in tree: ${shape.id}`);
      if (nextShapes.has(shape.id)) throw new Error(`id already exists: ${shape.id}`);
      nextShapes.set(shape.id, shape);
      const children = changes.get(shape) ?? shape.getChildren();
      if (!shape.isContainer && children.length > 0) throw new Error(`not a container: ${shape.id}`);
      for (let index = children.length - 1; index >= 0; index--) pending.push(children[index]);
    }
    if (nextShapes.size !== expected.size) throw new Error('tree edit would lose shapes');
    const updates: (() => void)[] = [];
    for (const [parent, children] of changes) {
      if (parent) updates.push(parent.prepareChildren(children));
    }
    // 所有检查和列表副本已就绪；下面同步提交，不再查找或重新挂接节点。
    if (added) added.markAttached();
    if (removed) removed.markDetached();
    for (const apply of updates) apply();
    this.roots = nextRoots;
    this.shapes = nextShapes;
  }

  private reorder(id: string, toFront: boolean): Shape {
    const shape = this.find(id);
    const parent = this.findParent(shape);
    if (parent) parent.reorderChild(shape, toFront);
    else {
      this.roots.splice(this.roots.indexOf(shape), 1);
      // SVG 后绘制的同级节点位于前景，因此 front 对应数组末尾。
      if (toFront) this.roots.push(shape);
      else this.roots.unshift(shape);
    }
    return shape;
  }

  private findParent(shape: Shape): Shape | undefined {
    if (this.roots.includes(shape)) return undefined;
    for (const candidate of this.shapes.values()) {
      if (candidate.getChildren().includes(shape)) return candidate;
    }
    throw new Error(`shape is not attached to document: ${shape.id}`);
  }

  tree(id?: string): string {
    const shape = id === undefined ? undefined : this.find(id);
    const rows = [shape ? shape.describe() : `svg (${this.size})`];
    this.appendTreeRows(shape ? shape.getChildren() : this.roots, '', rows);
    return rows.join('\n');
  }

  show(id: string): string {
    const shape = this.find(id);
    const parent = this.findParent(shape)?.label ?? 'svg';
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
