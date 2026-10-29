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

test('创建嵌套容器，tree 与 tree id 保留层级、顺序及几何信息', () => {
  const run = editor();
  run('init');
  assert.equal(run('create g scene'), 'g#scene created');
  assert.equal(run('create g node in scene'), 'g#node created in g#scene');
  assert.equal(run('create rect r 10 20 100 50 red in node'), 'rect#r created in g#node');
  run('create text t 15 35 "开始" in node');
  run('create circle c 200 100 20 in scene');
  run('create rect outside 0 0 10 10');
  assert.equal(run('tree'), [
    'svg (800x600)', '├── g#scene', '│   ├── g#node',
    '│   │   ├── rect#r x=10 y=20 w=100 h=50 fill=red',
    '│   │   └── text#t (15,35) "开始"',
    '│   └── circle#c cx=200 cy=100 r=20',
    '└── rect#outside x=0 y=0 w=10 h=10',
  ].join('\n'));
  assert.equal(run('tree node'), 'g#node\n├── rect#r x=10 y=20 w=100 h=50 fill=red\n└── text#t (15,35) "开始"');
});

test('组移动递归作用于五类叶子，每个后代恰好移动一次', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create g inner in scene');
  run('create rect r 10 20 100 50 in inner');
  run('create circle c 100 100 20 red in inner');
  run('create ellipse e 100 100 40 20 blue in scene');
  run('create line l 10 20 100 20 black in scene');
  run('create text t 20 40 "My Diagram" in scene');
  run('move scene 10 5');
  assert.equal(run('tree r'), 'rect#r x=20 y=25 w=100 h=50');
  assert.equal(run('tree c'), 'circle#c cx=110 cy=105 r=20 fill=red');
  assert.equal(run('tree e'), 'ellipse#e cx=110 cy=105 rx=40 ry=20 fill=blue');
  assert.equal(run('tree l'), 'line#l (20,25) -> (110,25) stroke=black');
  assert.equal(run('tree t'), 'text#t (30,45) "My Diagram"');
  run('move inner -0.5 -5');
  assert.equal(run('tree r'), 'rect#r x=19.5 y=20 w=100 h=50');
  assert.equal(run('tree e'), 'ellipse#e cx=110 cy=105 rx=40 ry=20 fill=blue');
});

test('仅移动选中子树，其他兄弟和根级图形不受影响', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create g node1 in scene');
  run('create g node2 in scene');
  run('create rect a 10 20 30 40 in node1');
  run('create text b 50 60 "b" in node2');
  run('create line outside 0 0 1 1');
  run('move node2 0 100');
  assert.equal(run('tree a'), 'rect#a x=10 y=20 w=30 h=40');
  assert.equal(run('tree b'), 'text#b (50,160) "b"');
  assert.equal(run('tree outside'), 'line#outside (0,0) -> (1,1)');
});

test('容器缺失、目标为叶子、跨层重复 id 均失败，失败后新 id 仍可用', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create rect r 0 0 1 1 in scene');
  const before = run('tree');
  assert.throws(() => run('create text retry 0 0 "a" in missing'), { message: 'no such container: missing' });
  assert.throws(() => run('create g retry in r'), { message: 'not a container: r' });
  assert.throws(() => run('create circle r 0 0 1'), { message: 'id already exists: r' });
  assert.throws(() => run('create g scene in scene'), { message: 'id already exists: scene' });
  assert.throws(() => run('tree retry'), { message: 'no such shape: retry' });
  assert.equal(run('tree'), before);
  run('create g retry in scene');
  assert.equal(run('tree retry'), 'g#retry');
});

test('组内末尾图形溢出时，之前准备的所有子树都不修改', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create g early in scene');
  run('create rect r 10 20 30 40 in early');
  run('create text t 30 40 "keep" in early');
  run('create line last 10 20 30 1e308 black in scene');
  const before = run('tree');
  assert.throws(() => run('move scene 5 1e308'), { message: 'y2 must be a finite number' });
  assert.equal(run('tree'), before);
  run('move scene 5 0');
  assert.equal(run('tree r'), 'rect#r x=15 y=20 w=30 h=40');
});

test('空容器可移动但不能绕过数值校验；未初始化与非法 g 参数报错', () => {
  const run = editor();
  assert.throws(() => run('create g scene'), { message: "no document. use 'init' or 'read' first" });
  run('init');
  run('create g scene');
  assert.equal(run('move scene 10 20'), 'moved g#scene');
  assert.equal(run('tree scene'), 'g#scene');
  const before = run('tree');
  assert.throws(() => run('create g bad extra'));
  assert.throws(() => run('create g bad in'));
  assert.equal(run('tree'), before);
  const empty = new GroupShape('empty');
  assert.throws(() => empty.move(Number.NaN, 0), { message: 'dx must be a finite number' });
});

test('尾缀只识别未加引号的 in，文字内容和名为 in 的容器不混淆', () => {
  const run = editor();
  run('init');
  run('create g in');
  run('create text t 0 0 "in" in in');
  run('create text words 0 0 "a in b" in in');
  run('create text empty 0 0 "" in in');
  assert.equal(run('tree t'), 'text#t (0,0) "in"');
  assert.equal(run('tree words'), 'text#words (0,0) "a in b"');
  assert.equal(run('tree empty'), 'text#empty (0,0) ""');
  const before = run('tree');
  assert.throws(() => run('create g bad "in" in'));
  assert.throws(() => run('create text bad 0 0 "in" in'));
  assert.throws(() => run('create rect bad 0 0 1 1 "in" in'));
  assert.equal(run('tree'), before);
  run('create text root 0 0 "in"');
  assert.equal(run('tree root'), 'text#root (0,0) "in"');
});

test('子节点视图只读，内部挂接防止重复归属、重复 id 和自包含', () => {
  const root = new GroupShape('root');
  const child = new GroupShape('child');
  root.appendChild(child);
  const snapshot = root.getChildren();
  assert.ok(Object.isFrozen(snapshot));
  assert.throws(() => root.appendChild(child), { message: 'shape already attached: child' });
  assert.throws(() => child.appendChild(root), { message: 'cannot create a cycle: root' });
  assert.throws(() => root.appendChild(new RectShape('child', 0, 0, 1, 1)), { message: 'id already exists: child' });
  assert.deepEqual(root.getChildren(), [child]);
  const doc = new SvgDocument(800, 600);
  doc.add(root);
  assert.equal(doc.find('child'), child);
  const other = new SvgDocument(800, 600);
  assert.throws(() => other.add(root), { message: 'shape already attached: root' });
  assert.equal(other.tree(), 'svg (800x600)');
});

test('较深的嵌套仍只移动叶子一次', () => {
  const run = editor();
  run('init');
  run('create g g0');
  for (let index = 1; index <= 100; index++) run(`create g g${index} in g${index - 1}`);
  run('create rect r 1 2 3 4 in g100');
  run('move g0 10 20');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
});

test('真实 CLI 回放课设流程图的创建与组移动部分', () => {
  const input = readFileSync(path.resolve(__dirname, '../../examples/step-04.commands.txt'), 'utf8');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.ok(output.includes('│   ├── rect#start x=120 y=100 w=160 h=60 fill=#4a90d9'));
  assert.ok(output.includes('└── line#arrow1 (280,130) -> (520,130) stroke=black'));
  assert.ok(output.endsWith('g#node2\n├── rect#process x=520 y=200 w=160 h=60 fill=#f5a623\n└── text#process-label (545,235) "处理数据"\n'));
});
