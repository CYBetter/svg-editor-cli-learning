import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession';
import { CommandDispatcher } from '../src/cli/CommandDispatcher';
import { GroupShape } from '../src/domain/GroupShape';
import { RectShape } from '../src/domain/RectShape';
import { SvgDocument } from '../src/domain/SvgDocument';

function editor(): (line: string) => string | undefined {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher();
  return line => dispatcher.parse(line)?.execute(session);
}

test('五类叶子可从根或组中删除，保留兄弟顺序并释放 id', () => {
  for (const form of ['rect target 1 2 3 4', 'circle target 1 2 3', 'ellipse target 1 2 3 4', 'line target 1 2 3 4', 'text target 1 2 "文字"']) {
    for (const suffix of ['', ' in parent']) {
      const run = editor();
      run('init');
      run('create g parent');
      run(`create rect before 0 0 1 1${suffix}`);
      run(`create ${form}${suffix}`);
      run(`create circle after 0 0 1${suffix}`);
      const before = run('tree')!;
      assert.equal(run('delete target'), `${form.split(' ')[0]}#target deleted`);
      assert.equal(run('tree'), before.split('\n').filter(row => !row.includes('#target ')).join('\n'));
      assert.throws(() => run('show target'), { message: 'no such shape: target' });
      run(`create g target${suffix}`);
      assert.equal(run('show target'), `g#target  parent=${suffix ? 'g#parent' : 'svg'}`);
    }
  }
});

test('删除嵌套子树释放全部后代 id，原父级和外部兄弟保持不变', () => {
  const run = editor();
  run('init');
  run('create g outer');
  run('create text keep 1 2 "保留" in outer');
  run('create g target in outer');
  run('create g inner in target');
  run('create rect r 1 2 3 4 red in inner');
  run('create circle c 1 2 3 in inner');
  run('create ellipse e 1 2 3 4 in target');
  run('create line l 1 2 3 4 in target');
  run('create text t 1 2 "删除" in target');
  run('create rect outside 10 20 30 40');
  run('delete target');
  assert.equal(run('tree'), 'svg (800x600)\n├── g#outer\n│   └── text#keep (1,2) "保留"\n└── rect#outside x=10 y=20 w=30 h=40');
  for (const id of ['target', 'inner', 'r', 'c', 'e', 'l', 't']) {
    for (const command of [`show ${id}`, `move ${id} 1 1`, `delete ${id}`, `front ${id}`, `back ${id}`]) {
      assert.throws(() => run(command), { message: `no such shape: ${id}` });
    }
    run(`create circle ${id} 0 0 1 in outer`);
    assert.equal(run(`show ${id}`), `circle#${id}  parent=g#outer\n  cx=0 cy=0 r=1`);
  }
});

test('整组摘离保留内部结构和归属，可整体重新加入；冲突失败不破坏子树', () => {
  const doc = new SvgDocument(800, 600);
  const outer = new GroupShape('outer');
  const inner = new GroupShape('inner');
  const leaf = new RectShape('leaf', 1, 2, 3, 4, 'red');
  inner.appendChild(leaf);
  outer.appendChild(inner);
  doc.add(outer);
  assert.equal(doc.remove('outer'), outer);
  assert.equal(doc.tree(), 'svg (800x600)');
  assert.equal(outer.isAttached, false);
  assert.equal(inner.isAttached, true);
  assert.equal(leaf.isAttached, true);
  assert.deepEqual([...outer.walk()], [outer, inner, leaf]);
  assert.throws(() => doc.add(leaf), { message: 'shape already attached: leaf' });
  doc.add(new GroupShape('leaf'));
  const before = doc.tree();
  assert.throws(() => doc.add(outer), { message: 'id already exists: leaf' });
  assert.equal(doc.tree(), before);
  assert.equal(outer.isAttached, false);
  doc.remove('leaf');
  doc.add(outer);
  assert.equal(doc.find('leaf'), leaf);
  assert.equal(doc.show('leaf'), 'rect#leaf  parent=g#inner\n  x=1 y=2 width=3 height=4\n  fill=red');
  doc.remove('leaf');
  assert.equal(leaf.isAttached, false);
  assert.equal(inner.isAttached, true);
  assert.equal(doc.tree('inner'), 'g#inner');
  doc.remove('outer');
  assert.equal(doc.tree(), 'svg (800x600)');
});

test('根级 front 移到末尾、back 移到开头，其他兄弟保持相对顺序与属性', () => {
  const run = editor();
  run('init');
  run('create rect a 1 2 3 4 red');
  run('create circle b 5 6 7 blue');
  run('create text c 8 9 "文字"');
  run('create ellipse d 10 11 12 13');
  const details = ['a', 'b', 'c', 'd'].map(id => run(`show ${id}`));
  assert.equal(run('front b'), 'circle#b brought to front');
  assert.equal(run('tree'), 'svg (800x600)\n├── rect#a x=1 y=2 w=3 h=4 fill=red\n├── text#c (8,9) "文字"\n├── ellipse#d cx=10 cy=11 rx=12 ry=13\n└── circle#b cx=5 cy=6 r=7 fill=blue');
  assert.equal(run('back d'), 'ellipse#d sent to back');
  assert.equal(run('tree'), 'svg (800x600)\n├── ellipse#d cx=10 cy=11 rx=12 ry=13\n├── rect#a x=1 y=2 w=3 h=4 fill=red\n├── text#c (8,9) "文字"\n└── circle#b cx=5 cy=6 r=7 fill=blue');
  assert.deepEqual(['a', 'b', 'c', 'd'].map(id => run(`show ${id}`)), details);
});

test('嵌套组只在自身同级重排，内部顺序、父级、几何和其他层级保持不变', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create line edge 0 0 10 10 in scene');
  run('create g node in scene');
  run('create rect box 1 2 3 4 red in node');
  run('create text label 5 6 "标签" in node');
  run('create circle dot 10 20 3 in scene');
  run('create g outside');
  const subtree = run('tree node');
  run('front node');
  assert.equal(run('tree'), 'svg (800x600)\n├── g#scene\n│   ├── line#edge (0,0) -> (10,10)\n│   ├── circle#dot cx=10 cy=20 r=3\n│   └── g#node\n│       ├── rect#box x=1 y=2 w=3 h=4 fill=red\n│       └── text#label (5,6) "标签"\n└── g#outside');
  run('back node');
  assert.equal(run('tree scene'), 'g#scene\n├── g#node\n│   ├── rect#box x=1 y=2 w=3 h=4 fill=red\n│   └── text#label (5,6) "标签"\n├── line#edge (0,0) -> (10,10)\n└── circle#dot cx=10 cy=20 r=3');
  assert.equal(run('tree node'), subtree);
  assert.equal(run('show node'), 'g#node  parent=g#scene');
  run('front box');
  assert.equal(run('tree node'), 'g#node\n├── text#label (5,6) "标签"\n└── rect#box x=1 y=2 w=3 h=4 fill=red');
  assert.equal(run('show box'), 'rect#box  parent=g#node\n  x=1 y=2 width=3 height=4\n  fill=red');
});

test('只有一个孩子、已经在目标位置和空组重排均安全且可重复', () => {
  const run = editor();
  run('init');
  run('create g only');
  const empty = run('tree');
  run('front only');
  run('back only');
  assert.equal(run('tree'), empty);
  run('create rect child 1 2 3 4 in only');
  const before = run('tree');
  for (const command of ['front child', 'front child', 'back child', 'back child']) run(command);
  assert.equal(run('tree'), before);
  run('create circle second 0 0 1 in only');
  const ordered = run('tree');
  for (const command of ['front second', 'front second', 'back child', 'back child']) run(command);
  assert.equal(run('tree'), ordered);
  run('delete only');
  assert.equal(run('tree'), 'svg (800x600)');
  run('create g only');
  run('delete only');
  assert.equal(run('tree'), 'svg (800x600)');
});

test('新命令检查初始化、参数和目标；失败不改变顺序、属性或 id 占用', () => {
  const run = editor();
  for (const name of ['delete', 'front', 'back']) {
    assert.throws(() => run(`${name} target`), { message: "no document. use 'init' or 'read' first" });
  }
  run('init');
  run('create g parent');
  run('create rect target 1 2 3 4 red in parent');
  run('create circle last 1 2 3 in parent');
  const before = run('tree');
  for (const name of ['delete', 'front', 'back']) {
    for (const command of [name, `${name} target extra`]) {
      assert.throws(() => run(command), { message: `usage: ${name} <id>` });
      assert.equal(run('tree'), before);
    }
    for (const id of ['missing', 'Target']) {
      assert.throws(() => run(`${name} ${id}`), { message: `no such shape: ${id}` });
      assert.equal(run('tree'), before);
    }
  }
  assert.throws(() => run('create circle target 0 0 1'), { message: 'id already exists: target' });
  run('create g missing');
  assert.equal(run('show missing'), 'g#missing  parent=svg');
});

test('内部摘离和重排按对象归属校验，错误对象不会误删末尾或同 id 节点', () => {
  const parent = new GroupShape('parent');
  const child = new RectShape('child', 1, 2, 3, 4);
  const stranger = new RectShape('child', 5, 6, 7, 8);
  parent.appendChild(child);
  const snapshot = parent.getChildren();
  assert.throws(() => parent.removeChild(stranger), { message: 'not a direct child: child' });
  assert.throws(() => parent.reorderChild(stranger, true), { message: 'not a direct child: child' });
  assert.deepEqual(parent.getChildren(), [child]);
  assert.equal(child.isAttached, true);
  parent.removeChild(child);
  assert.equal(child.isAttached, false);
  assert.deepEqual(parent.getChildren(), []);
  assert.deepEqual(snapshot, [child]);
  assert.ok(Object.isFrozen(snapshot));
  assert.throws(() => parent.removeChild(child), { message: 'not a direct child: child' });
  assert.throws(() => child.removeChild(stranger), { message: 'not a container: child' });
  assert.throws(() => child.reorderChild(stranger, false), { message: 'not a container: child' });
  parent.appendChild(child);
  assert.equal(child.isAttached, true);
});

test('重排后删除只影响目标，复用 id 的新对象接受正确的父级移动', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create rect a 1 2 3 4 in scene');
  run('create circle b 5 6 7 in scene');
  run('create line c 10 20 30 40 in scene');
  run('front a');
  run('back c');
  run('delete b');
  run('create text b 0 0 "新对象"');
  run('move scene 10 20');
  assert.equal(run('tree scene'), 'g#scene\n├── line#c (20,40) -> (40,60)\n└── rect#a x=11 y=22 w=3 h=4');
  assert.equal(run('show b'), 'text#b  parent=svg\n  x=0 y=0 text="新对象"');
  run('delete scene');
  assert.equal(run('tree'), 'svg (800x600)\n└── text#b (0,0) "新对象"');
});

test('第六轮真实 CLI 回放验证同级顺序、删除后错误与后代 id 复用', () => {
  const input = readFileSync(path.resolve(__dirname, '../../examples/step-06.commands.txt'), 'utf8');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.replace(/\r\n/g, '\n'), 'error: no such shape: label\n');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.ok(output.includes('g#scene\n├── rect#blue x=40 y=40 w=100 h=60 fill=blue\n├── g#node'));
  assert.ok(output.includes('└── rect#red x=10 y=20 w=100 h=60 fill=red\nrect#red sent to back'));
  assert.ok(output.includes('g#node deleted\ncircle#label created in g#scene\n'));
  assert.ok(output.endsWith('svg (800x600)\n└── g#scene\n    ├── rect#red x=10 y=20 w=100 h=60 fill=red\n    ├── rect#blue x=40 y=40 w=100 h=60 fill=blue\n    └── circle#label cx=300 cy=50 r=20 fill=green\n'));
});
