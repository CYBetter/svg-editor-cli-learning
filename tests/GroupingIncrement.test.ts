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

test('根级分组按当前树顺序收入对象，占据首个选中位置', () => {
  const run = editor();
  run('init');
  run('create rect before 0 0 1 1');
  run('create circle a 1 2 3 red');
  run('create text middle 4 5 "保留"');
  run('create ellipse b 6 7 8 9');
  run('create line after 10 11 12 13');
  assert.equal(run('group pair b a'), 'g#pair created with 2 children');
  assert.equal(run('tree'), 'svg (800x600)\n├── rect#before x=0 y=0 w=1 h=1\n├── g#pair\n│   ├── circle#a cx=1 cy=2 r=3 fill=red\n│   └── ellipse#b cx=6 cy=7 rx=8 ry=9\n├── text#middle (4,5) "保留"\n└── line#after (10,11) -> (12,13)');
  assert.equal(run('show pair'), 'g#pair  parent=svg');
  assert.equal(run('show a'), 'circle#a  parent=g#pair\n  cx=1 cy=2 r=3\n  fill=red');
  assert.throws(() => run('create rect a 0 0 1 1'), { message: 'id already exists: a' });
});

test('同父级分组采用重排后的树顺序，移除中间组后原位恢复孩子', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create rect a 1 2 3 4 in scene');
  run('create text b 5 6 "b" in scene');
  run('create circle c 7 8 9 in scene');
  run('front a');
  run('group node a b');
  assert.equal(run('tree scene'), 'g#scene\n├── g#node\n│   ├── text#b (5,6) "b"\n│   └── rect#a x=1 y=2 w=3 h=4\n└── circle#c cx=7 cy=8 r=9');
  assert.equal(run('ungroup node'), 'g#node ungrouped');
  assert.equal(run('tree scene'), 'g#scene\n├── text#b (5,6) "b"\n├── rect#a x=1 y=2 w=3 h=4\n└── circle#c cx=7 cy=8 r=9');
});

test('跨父级分组放最近共同容器，保留空旧组和未选中分支', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create text before 0 0 "前" in scene');
  run('create g left in scene');
  run('create g deep in left');
  run('create rect a 1 2 3 4 in deep');
  run('create text keep 5 6 "保留" in left');
  run('create g right in scene');
  run('create circle b 7 8 9 in right');
  run('create g outside');
  run('group pair b a');
  assert.equal(run('tree'), 'svg (800x600)\n├── g#scene\n│   ├── text#before (0,0) "前"\n│   ├── g#pair\n│   │   ├── rect#a x=1 y=2 w=3 h=4\n│   │   └── circle#b cx=7 cy=8 r=9\n│   ├── g#left\n│   │   ├── g#deep\n│   │   └── text#keep (5,6) "保留"\n│   └── g#right\n└── g#outside');
  assert.equal(run('show pair'), 'g#pair  parent=g#scene');
  run('group outer outside a');
  assert.equal(run('show outer'), 'g#outer  parent=svg');
  assert.equal(run('tree outer'), 'g#outer\n├── rect#a x=1 y=2 w=3 h=4\n└── g#outside');
  assert.ok(run('tree')?.startsWith('svg (800x600)\n├── g#outer\n'));
  assert.equal(run('tree pair'), 'g#pair\n└── circle#b cx=7 cy=8 r=9');
});

test('分组保留整棵子树与对象身份，组移动只处理每个后代一次', () => {
  const doc = new SvgDocument(800, 600);
  const branch = new GroupShape('branch');
  const child = new RectShape('child', 1, 2, 3, 4, 'red');
  const sibling = new RectShape('sibling', 10, 20, 30, 40);
  branch.appendChild(child);
  doc.add(branch);
  doc.add(sibling);
  const group = doc.group('pair', ['sibling', 'branch']);
  assert.deepEqual(group.getChildren(), [branch, sibling]);
  assert.equal(doc.find('child'), child);
  assert.equal(group.isAttached, true);
  for (const shape of [branch, child, sibling]) assert.equal(shape.isAttached, true);
  group.move(10, 20);
  assert.equal(doc.tree('child'), 'rect#child x=11 y=22 w=3 h=4 fill=red');
  assert.equal(doc.tree('sibling'), 'rect#sibling x=20 y=40 w=30 h=40');
  assert.equal(doc.show('child').split('\n')[0], 'rect#child  parent=g#branch');
});

test('分组拒绝祖孙、重复目标、重复新 id、缺失末尾目标，所有失败保持状态', () => {
  const run = editor();
  run('init');
  run('create g ancestor');
  run('create g inner in ancestor');
  run('create rect leaf 1 2 3 4 in inner');
  run('create circle outside 5 6 7');
  const before = run('tree');
  for (const members of ['ancestor leaf', 'leaf ancestor']) {
    assert.throws(() => run(`group bad ${members}`), { message: 'cannot group a container into its own descendant: ancestor' });
    assert.equal(run('tree'), before);
  }
  const cases = [
    ['group bad leaf leaf', 'duplicate shape id in group: leaf'],
    ['group ancestor leaf outside', 'id already exists: ancestor'],
    ['group bad leaf missing', 'no such shape: missing'],
    ['group "" leaf outside', 'id must not be empty'],
  ];
  for (const [command, message] of cases) {
    assert.throws(() => run(command), { message });
    assert.equal(run('tree'), before);
  }
  run('group bad leaf outside');
  assert.equal(run('show bad'), 'g#bad  parent=svg');
});

test('addto 从根或其他组迁移到末尾，同父迁移也重排，保持显式属性', () => {
  const run = editor();
  run('init');
  run('create g source');
  run('create g target');
  run('set source fill red');
  run('set target fill blue');
  run('create rect a 1 2 3 4 in source');
  run('create text b 5 6 "文字" in target');
  run('create circle root 7 8 9 green');
  assert.equal(run('addto target a'), 'rect#a moved into g#target');
  run('addto target root');
  run('addto target b');
  const expected = 'g#target fill=blue\n├── rect#a x=1 y=2 w=3 h=4\n├── circle#root cx=7 cy=8 r=9 fill=green\n└── text#b (5,6) "文字"';
  assert.equal(run('tree target'), expected);
  run('addto target b');
  assert.equal(run('tree target'), expected);
  assert.equal(run('tree source'), 'g#source fill=red');
  assert.equal(run('show a'), 'rect#a  parent=g#target\n  x=1 y=2 width=3 height=4');
  assert.throws(() => run('create g root'), { message: 'id already exists: root' });
});

test('addto 允许整个子树移向外层，拒绝自包含和祖先移入后代', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create g branch in scene');
  run('create g inner in branch');
  run('create rect r 1 2 3 4 in inner');
  const before = run('tree');
  for (const command of ['addto inner scene', 'addto r scene']) {
    assert.throws(() => run(command), command);
    assert.equal(run('tree'), before);
  }
  assert.throws(() => run('addto scene scene'), { message: 'cannot move a container into itself: scene' });
  assert.throws(() => run('addto inner branch'), { message: 'cannot move a container into its own descendant: branch' });
  assert.equal(run('tree'), before);
  run('addto scene inner');
  assert.equal(run('tree scene'), 'g#scene\n├── g#branch\n└── g#inner\n    └── rect#r x=1 y=2 w=3 h=4');
  run('move inner 10 20');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
});

test('ungroup 在原位提升孩子，保留后代 id 和样式，只释放旧组 id', () => {
  const doc = new SvgDocument(800, 600);
  const scene = new GroupShape('scene');
  const before = new RectShape('before', 0, 0, 1, 1);
  const group = new GroupShape('group');
  group.setAttribute('fill', 'blue');
  const nested = new GroupShape('nested');
  const child = new RectShape('child', 1, 2, 3, 4, 'red');
  const plain = new RectShape('plain', 5, 6, 7, 8);
  const after = new RectShape('after', 9, 10, 11, 12);
  nested.appendChild(child);
  group.appendChild(nested);
  group.appendChild(plain);
  scene.appendChild(before);
  scene.appendChild(group);
  scene.appendChild(after);
  doc.add(scene);
  assert.equal(doc.ungroup('group'), group);
  assert.deepEqual(scene.getChildren(), [before, nested, plain, after]);
  assert.deepEqual(group.getChildren(), []);
  assert.equal(group.isAttached, false);
  for (const shape of [nested, child, plain]) {
    assert.equal(shape.isAttached, true);
    assert.equal(doc.find(shape.id), shape);
  }
  assert.equal(doc.show('plain'), 'rect#plain  parent=g#scene\n  x=5 y=6 width=7 height=8');
  assert.equal(doc.show('child'), 'rect#child  parent=g#nested\n  x=1 y=2 width=3 height=4\n  fill=red');
  assert.throws(() => doc.find('group'), { message: 'no such shape: group' });
  assert.throws(() => doc.add(new GroupShape('child')), { message: 'id already exists: child' });
  doc.add(new GroupShape('group'), 'scene');
  doc.ungroup('group');
  assert.deepEqual(scene.getChildren(), [before, nested, plain, after]);
});

test('ungroup 拒绝根级组和叶子，空嵌套组可以解散', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create g empty in scene');
  run('create rect r 1 2 3 4 in scene');
  const before = run('tree');
  assert.throws(() => run('ungroup scene'), { message: 'cannot ungroup top-level container: scene' });
  assert.throws(() => run('ungroup r'), { message: 'not a container: r' });
  assert.equal(run('tree'), before);
  run('ungroup empty');
  assert.equal(run('tree scene'), 'g#scene\n└── rect#r x=1 y=2 w=3 h=4');
  run('create g empty');
  assert.equal(run('show empty'), 'g#empty  parent=svg');
});

test('准备列表时异常也不会半途改变树、归属或索引', () => {
  const doc = new SvgDocument(800, 600);
  const scene = new GroupShape('scene');
  const source = new GroupShape('source');
  const target = new GroupShape('target');
  const a = new RectShape('a', 1, 2, 3, 4);
  const b = new RectShape('b', 5, 6, 7, 8);
  source.appendChild(a);
  target.appendChild(b);
  scene.appendChild(source);
  scene.appendChild(target);
  doc.add(scene);
  const before = doc.tree();
  const prepare = target.prepareChildren;
  target.prepareChildren = () => { throw new Error('preparation failed'); };
  try {
    for (const operation of [() => doc.group('pair', ['a', 'b']), () => doc.addTo('target', 'a'), () => doc.ungroup('target')]) {
      assert.throws(operation, { message: 'preparation failed' });
      assert.equal(doc.tree(), before);
      for (const shape of [scene, source, target, a, b]) {
        assert.equal(shape.isAttached, true);
        assert.equal(doc.find(shape.id), shape);
      }
      assert.throws(() => doc.find('pair'), { message: 'no such shape: pair' });
    }
  } finally { target.prepareChildren = prepare; }
  doc.group('pair', ['a', 'b']);
  assert.equal(doc.show('pair'), 'g#pair  parent=g#scene');
});

test('三个命令检查初始化、参数与缺失目标；失败不破坏有效编辑', () => {
  const run = editor();
  for (const command of ['group g a b', 'addto g a', 'ungroup g']) {
    assert.throws(() => run(command), { message: "no document. use 'init' or 'read' first" });
  }
  run('init');
  run('create g scene');
  run('create rect a 1 2 3 4 in scene');
  run('create circle b 5 6 7 in scene');
  const before = run('tree');
  for (const command of ['group', 'group pair', 'group pair a', 'addto', 'addto scene', 'addto scene a extra', 'ungroup', 'ungroup scene extra']) {
    assert.throws(() => run(command), /usage:/);
    assert.equal(run('tree'), before);
  }
  for (const [command, message] of [
    ['addto missing a', 'no such container: missing'], ['addto a b', 'not a container: a'],
    ['addto scene missing', 'no such shape: missing'], ['ungroup missing', 'no such shape: missing'],
    ['group pair A b', 'no such shape: A'],
  ]) {
    assert.throws(() => run(command), { message });
    assert.equal(run('tree'), before);
  }
  run('group pair a b');
  run('ungroup pair');
  run('delete a');
  run('create text a 0 0 "新对象" in scene');
  assert.equal(run('show a'), 'text#a  parent=g#scene\n  x=0 y=0 text="新对象"');
});

test('第七轮真实 CLI 回放验证分组、迁移、解组及两条规定错误', () => {
  const input = readFileSync(path.resolve(__dirname, '../../examples/step-07.commands.txt'), 'utf8');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.replace(/\r\n/g, '\n'), 'error: cannot move a container into its own descendant: scene\nerror: cannot ungroup top-level container: scene\n');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.ok(output.includes('g#node created with 2 children\ng#scene\n├── g#node\n│   ├── rect#box x=10 y=20 w=100 h=50 fill=red\n│   └── text#label (25,50) "开始"'));
  assert.ok(output.includes('circle#marker  parent=g#node\n  cx=200 cy=50 r=10\n  fill=blue\n'));
  assert.ok(output.includes('g#node ungrouped\ng#scene\n├── rect#box x=10 y=20 w=100 h=50 fill=red\n├── text#label (25,50) "开始"\n└── circle#marker cx=200 cy=50 r=10 fill=blue\n'));
  assert.ok(output.endsWith('rect#box  parent=g#scene\n  x=10 y=20 width=100 height=50\n  fill=red\n'));
});
