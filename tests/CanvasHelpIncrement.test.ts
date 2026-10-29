import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession';
import { CommandDispatcher } from '../src/cli/CommandDispatcher';
import { RectShape } from '../src/domain/RectShape';
import { SvgDocument } from '../src/domain/SvgDocument';

function editor(): { session: EditorSession; run: (line: string) => string | undefined } {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher();
  return { session, run: line => dispatcher.parse(line)?.execute(session) };
}

test('help 列出当前命令、六类创建语法和关键约定，读取明确标记为后续功能', () => {
  const { run } = editor();
  run('init');
  const help = run('help')!;
  const [available, planned] = help.split('后续增量（当前尚未实现）：');
  const names = new Set(available.split('\n').filter(line => line.startsWith('  ')).map(line => line.trim().split(' ')[0]));
  assert.deepEqual([...names].sort(), ['init', 'canvas', 'save', 'create', 'delete', 'move', 'scale', 'set', 'group', 'addto', 'ungroup', 'front', 'back', 'tree', 'show', 'help', 'undo', 'redo'].sort());
  for (const type of ['rect', 'circle', 'ellipse', 'line', 'text', 'g']) {
    const syntax = available.split('\n').find(line => line.startsWith(`  create ${type} `));
    assert.ok(syntax?.includes('<id>'));
    assert.ok(syntax?.includes('[in <containerId>]'));
  }
  assert.ok(available.includes('create text <id> <x> <y> "content"'));
  assert.ok(available.includes('单参改宽保留高'));
  assert.ok(available.includes('最近共同父容器'));
  assert.ok(available.includes('禁止解散根级容器'));
  assert.ok(planned.includes('read <file.svg>'));
  assert.ok(available.includes('save [file.svg]'));
  assert.ok(!planned.includes('save [file.svg]'));
  assert.throws(() => run('read demo.svg'), { message: 'unknown command: read' });
});

test('help/canvas 按课设要求先初始化，非法参数不改变已建立的文档', () => {
  const { session, run } = editor();
  for (const command of ['help', 'canvas', 'canvas 100', 'canvas 100 200']) {
    assert.throws(() => run(command), { message: "no document. use 'init' or 'read' first" });
  }
  run('init');
  run('create rect r 1 2 3 4');
  const original = session.document;
  assert.throws(() => run('help extra'), { message: 'usage: help' });
  assert.throws(() => run('canvas 1 2 3'), { message: 'usage: canvas [w] [h]' });
  assert.equal(session.document, original);
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)');
});

test('help 和 canvas 查询不替换文档、不入历史、不清 redo，也不解除 IO 阻断', () => {
  const { session, run } = editor();
  run('init 400 300');
  const blank = session.document;
  assert.equal(run('canvas'), 'canvas 400x300');
  run('help');
  assert.equal(session.document, blank);
  assert.throws(() => run('undo'), { message: 'undo not allowed after io command' });
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  run('undo');
  const original = session.document;
  run('help');
  assert.equal(run('canvas'), 'canvas 400x300');
  assert.equal(session.document, original);
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
  run('undo');
  run('help');
  run('canvas');
  run('undo');
  assert.equal(run('tree'), 'svg (400x300)');
});

test('canvas 单参保留当前高度、双参修改宽高，所有图形几何样式与顺序保持', () => {
  const { session, run } = editor();
  for (const command of ['init 400 300', 'create g scene', 'set scene fill blue',
    'create rect r 1000 2000 30 40 red in scene', 'create circle c 5 6 7 in scene',
    'create g inner in scene', 'create ellipse e 8 9 10 11 in inner',
    'create line l 12 13 14 15 black in scene', 'create text t 16 17 "开始" in scene',
    'set l stroke-width 2.5', 'front r']) run(command);
  const original = session.document;
  const body = original.tree().split('\n').slice(1).join('\n');
  const details = ['scene', 'inner', 'r', 'c', 'e', 'l', 't'].map(id => original.show(id));
  assert.equal(run('canvas 1000.5'), 'canvas 1000.5x300 updated');
  assert.notEqual(session.document, original);
  assert.equal(original.size, '400x300');
  assert.equal(run('canvas 10 20.25'), 'canvas 10x20.25 updated');
  assert.equal(run('tree')?.split('\n').slice(1).join('\n'), body);
  assert.deepEqual(['scene', 'inner', 'r', 'c', 'e', 'l', 't'].map(id => run(`show ${id}`)), details);
  assert.equal(session.document.clone().size, '10x20.25');
});

test('无效宽高、非有限值和参数错误保留原实例、两栈及 redo 分支', () => {
  const { session, run } = editor();
  run('init 400 300');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  const moved = run('tree');
  run('undo');
  const original = session.document;
  const before = run('tree');
  for (const command of ['canvas 0', 'canvas -1', 'canvas 1000 0', 'canvas 1000 -1',
    'canvas NaN', 'canvas Infinity', 'canvas 1000 1e309', 'canvas ""', 'canvas 1 2 3', 'help extra']) {
    assert.throws(() => run(command), command);
    assert.equal(session.document, original);
    assert.equal(run('tree'), before);
  }
  run('redo');
  assert.equal(run('tree'), moved);
  run('undo');
  run('undo');
  assert.equal(run('tree'), 'svg (400x300)');
});

test('成功 canvas 修改清空两栈并阻断历史，相同尺寸也生效，新编辑只撤回新基线', () => {
  for (const command of ['canvas 1000', 'canvas 640 480', 'canvas 800 600']) {
    const { run } = editor();
    run('init');
    run('create rect r 1 2 3 4');
    run('move r 10 20');
    run('undo');
    run(command);
    const baseline = run('tree');
    assert.equal(run('tree r'), 'rect#r x=1 y=2 w=3 h=4');
    for (const history of ['undo', 'redo']) {
      assert.throws(() => run(history), { message: 'undo not allowed after io command' });
    }
    assert.throws(() => run('set r width -1'));
    run('help');
    run('canvas');
    assert.throws(() => run('redo'), { message: 'undo not allowed after io command' });
    run('move r 5 0');
    run('undo');
    assert.equal(run('tree'), baseline);
    assert.throws(() => run('undo'), { message: 'nothing to undo' });
    run('redo');
    assert.equal(run('tree r'), 'rect#r x=6 y=2 w=3 h=4');
  }
});

test('尺寸复制方法维护约束和副本隔离，复制中途失败不能提交画布或清历史', () => {
  const doc = new SvgDocument(400, 300);
  doc.add(new RectShape('r', 1, 2, 3, 4));
  assert.throws(() => doc.withCanvasSize(500, Number.NaN), { message: 'canvas height must be a finite number' });
  const copy = doc.withCanvasSize(500);
  assert.equal(copy.size, '500x300');
  copy.find('r').move(10, 20);
  assert.equal(doc.tree('r'), 'rect#r x=1 y=2 w=3 h=4');
  const { session, run } = editor();
  run('init');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  run('undo');
  const original = session.document;
  const before = original.tree();
  const shape = original.find('r');
  const clone = shape.clone;
  try {
    shape.clone = () => { throw new Error('copy failed'); };
    assert.throws(() => run('canvas 640 480'), { message: 'copy failed' });
    assert.equal(session.document, original);
    assert.equal(run('tree'), before);
  } finally { shape.clone = clone; }
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
  run('undo');
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)');
});

test('第九轮真实 CLI 回放验证帮助、查询保留 redo、修改及失败的历史边界', () => {
  const input = readFileSync(path.resolve(__dirname, '../../examples/step-09.commands.txt'), 'utf8');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.replace(/\r\n/g, '\n'), 'error: undo not allowed after io command\nerror: canvas height must be positive\n');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.ok(output.startsWith("svg-editor learning 0.1 — use 'init [w] [h]' to start, then 'help' for commands\n"));
  assert.equal(output.split('SVG CLI 命令帮助').length - 1, 2);
  assert.ok(output.includes('canvas 1000x600 updated\nrect#box  parent=g#scene\n  x=40 y=30 width=100 height=50\n  fill=red\n'));
  assert.ok(output.endsWith('canvas 640x480 updated\ncanvas 640x480\nsvg (640x480)\n└── g#scene\n    └── rect#box x=45 y=30 w=100 h=50 fill=red\n'));
});
