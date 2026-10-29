import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession';
import { HistoryEntry } from '../src/application/HistoryEntry';
import { CommandDispatcher } from '../src/cli/CommandDispatcher';
import { RectShape } from '../src/domain/RectShape';
import { SvgDocument } from '../src/domain/SvgDocument';

function editor(): { session: EditorSession; run: (line: string) => string | undefined } {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher();
  return { session, run: line => dispatcher.parse(line)?.execute(session) };
}

test('文档深复制保留六类对象、尺寸、层级、顺序和显式样式，不共享可变状态', () => {
  const { session, run } = editor();
  run('init 400 300');
  run('create g scene');
  run('set scene fill blue');
  run('create rect r -1.5 2 3 4 red in scene');
  run('create g inner in scene');
  run('create circle c 5 6 7 in inner');
  run('create ellipse e 8 9 10 11 in scene');
  run('create line l 12 13 14 15 black in scene');
  run(String.raw`create text t 16 17 "他说：\"开始\"" in scene`);
  run('set t fill ""');
  run('set l stroke-width 2.5');
  const original = session.document;
  const before = original.tree();
  const copy = original.clone();
  assert.equal(copy.size, '400x300');
  assert.equal(copy.tree(), before);
  for (const id of ['scene', 'inner', 'r', 'c', 'e', 'l', 't']) {
    assert.notEqual(copy.find(id), original.find(id));
    assert.equal(copy.find(id).constructor, original.find(id).constructor);
    assert.equal(copy.find(id).isAttached, true);
    assert.equal(copy.show(id), original.show(id));
  }
  copy.find('scene').move(10, 20);
  copy.find('r').setAttribute('fill', 'green');
  copy.find('t').setAttribute('text', '副本');
  copy.sendToBack('t');
  assert.equal(original.tree(), before);
  original.find('c').setAttribute('r', '99');
  assert.equal(copy.tree('c'), 'circle#c cx=15 cy=26 r=7');
  copy.remove('scene');
  assert.equal(copy.tree(), 'svg (400x300)');
  assert.equal(original.find('r').id, 'r');
});

test('历史条目隔离输入文档和每次恢复的结果，重复恢复不会污染快照', () => {
  const before = new SvgDocument(800, 600);
  before.add(new RectShape('r', 1, 2, 3, 4));
  const after = before.clone();
  after.find('r').move(10, 20);
  const entry = new HistoryEntry(before, after, 'move r');
  before.find('r').move(100, 200);
  after.remove('r');
  const restored = entry.restoreBefore();
  restored.find('r').setAttribute('fill', 'red');
  restored.find('r').move(300, 400);
  assert.equal(entry.restoreBefore().tree('r'), 'rect#r x=1 y=2 w=3 h=4');
  const redone = entry.restoreAfter();
  redone.find('r').move(100, 200);
  assert.equal(entry.restoreAfter().tree('r'), 'rect#r x=11 y=22 w=3 h=4');
  assert.equal(entry.description, 'move r');
});

test('全部十类编辑命令均以一条命令为一个 undo/redo 单元', () => {
  for (const command of [
    'create ellipse e 1 2 3 4 in scene', 'delete left', 'move scene 10 20', 'scale scene 2',
    'set t text "处理数据 v2"', 'group pair b a', 'addto left b', 'ungroup left', 'front left', 'back right',
  ]) {
    const { run } = editor();
    for (const line of ['init', 'create g scene', 'create g left in scene', 'create g right in scene',
      'create rect a 1 2 3 4 red in left', 'create circle b 5 6 7 in right', 'create text t 8 9 "原文" in scene']) run(line);
    const before = run('tree');
    const summary = run(command);
    const after = run('tree');
    assert.notEqual(after, before, command);
    assert.equal(run('undo'), `undone: ${summary}`);
    assert.equal(run('tree'), before, command);
    for (const id of ['scene', 'left', 'right', 'a', 'b', 't']) assert.ok(run(`show ${id}`));
    assert.equal(run('redo'), `redone: ${summary}`);
    assert.equal(run('tree'), after, command);
  }
});

test('连续撤销重做精确恢复浮点值、缺省样式和空文字，不通过逆运算重建', () => {
  const { run } = editor();
  run('init');
  const commands = [
    'create rect r .1 1e-300 1 2', 'create text t 3 4 ""',
    'scale r 1e-100', 'set r fill red', 'set r stroke-width 0', 'set t text "有 空格"',
  ];
  const states = [run('tree')];
  for (const command of commands) { run(command); states.push(run('tree')); }
  assert.ok(states[3]?.includes('y=0'));
  for (let index = commands.length - 1; index >= 0; index--) {
    run('undo');
    assert.equal(run('tree'), states[index]);
  }
  assert.throws(() => run('undo'), { message: 'nothing to undo' });
  for (let index = 1; index < states.length; index++) {
    run('redo');
    assert.equal(run('tree'), states[index]);
  }
  assert.throws(() => run('redo'), { message: 'nothing to redo' });
});

test('跨父级分组一次撤销恢复所有原父级及顺序，反复恢复仍可整组移动', () => {
  const { run } = editor();
  for (const command of ['init', 'create g scene', 'create g left in scene', 'create g right in scene',
    'create rect a 1 2 3 4 in left', 'create text keep 0 0 "保留" in left', 'create circle b 5 6 7 in right']) run(command);
  const before = run('tree');
  run('group pair b a');
  const grouped = run('tree');
  for (let index = 0; index < 3; index++) {
    run('undo');
    assert.equal(run('tree'), before);
    assert.throws(() => run('show pair'), { message: 'no such shape: pair' });
    assert.ok(run('show a')?.startsWith('rect#a  parent=g#left'));
    run('redo');
    assert.equal(run('tree'), grouped);
  }
  run('move pair 10 20');
  assert.equal(run('tree a'), 'rect#a x=11 y=22 w=3 h=4');
  run('undo');
  assert.equal(run('tree'), grouped);
});

test('删除子树后复用后代 id，逐步撤销重做恢复正确类型、父级和索引', () => {
  const { run } = editor();
  for (const command of ['init', 'create g scene', 'create g node in scene', 'set node fill blue',
    'create rect a 1 2 3 4 red in node', 'create text label 5 6 "开始" in node']) run(command);
  const before = run('tree');
  run('delete node');
  run('create circle a 10 20 30');
  run('undo');
  assert.throws(() => run('show a'), { message: 'no such shape: a' });
  run('undo');
  assert.equal(run('tree'), before);
  assert.equal(run('show a'), 'rect#a  parent=g#node\n  x=1 y=2 width=3 height=4\n  fill=red');
  assert.throws(() => run('create g a'), { message: 'id already exists: a' });
  run('redo');
  assert.throws(() => run('show label'), { message: 'no such shape: label' });
  run('redo');
  assert.equal(run('show a'), 'circle#a  parent=svg\n  cx=10 cy=20 r=30');
});

test('查询、注释、解析错误和失败编辑不进入历史，也不清除 redo', () => {
  const { run } = editor();
  run('init');
  run('create g scene');
  run('create rect r 1 2 3 4 in scene');
  run('move r 10 20');
  const moved = run('tree');
  run('undo');
  const before = run('tree');
  run('show r');
  run('tree scene');
  run('# 注释');
  run('');
  for (const command of ['set r width -1', 'create circle r 0 0 1', 'group bad r missing',
    'addto scene scene', 'unknown', 'set r fill "unclosed', 'show missing']) {
    assert.throws(() => run(command), command);
    assert.equal(run('tree'), before);
  }
  run('redo');
  assert.equal(run('tree'), moved);
  run('undo');
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)\n└── g#scene');
});

test('撤销后的新编辑清 redo，成功的无变化编辑也占一个历史单元', () => {
  const { run } = editor();
  run('init');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  run('undo');
  run('set r fill red');
  assert.throws(() => run('redo'), { message: 'nothing to redo' });
  run('undo');
  const before = run('tree');
  run('move r 0 0');
  assert.equal(run('tree'), before);
  assert.throws(() => run('redo'), { message: 'nothing to redo' });
  run('undo');
  assert.equal(run('tree'), before);
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)');
});

test('未初始化及 init 历史边界准确；查询和失败编辑不解禁，成功编辑解禁', () => {
  const { run } = editor();
  for (const command of ['undo', 'redo']) {
    assert.throws(() => run(command), { message: "no document. use 'init' or 'read' first" });
  }
  run('init');
  run('tree');
  assert.throws(() => run('create rect bad 0 0 -1 1'));
  for (const command of ['undo', 'redo']) {
    assert.throws(() => run(command), { message: 'undo not allowed after io command' });
  }
  run('create g g');
  run('undo');
  assert.throws(() => run('undo'), { message: 'nothing to undo' });
  run('redo');
  run('init 400 300');
  assert.equal(run('tree'), 'svg (400x300)');
  for (const command of ['undo', 'redo']) {
    assert.throws(() => run(command), { message: 'undo not allowed after io command' });
  }
  run('create g fresh');
  run('undo');
  assert.equal(run('tree'), 'svg (400x300)');
  assert.throws(() => run('undo'), { message: 'nothing to undo' });
});

test('失败 init 与带参数的 undo/redo 不改变文档、历史位置和重做分支', () => {
  const { run } = editor();
  run('init');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  const moved = run('tree');
  run('undo');
  const before = run('tree');
  for (const command of ['init -1 600', 'init Infinity', 'init 1 2 extra', 'undo extra', 'redo extra']) {
    assert.throws(() => run(command), command);
    assert.equal(run('tree'), before);
  }
  run('redo');
  assert.equal(run('tree'), moved);
  run('undo');
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)');
});

test('工作副本与快照复制失败，编辑和历史操作均保留原文档及两栈', () => {
  const { session, run } = editor();
  run('init');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  const moved = run('tree');
  run('undo');
  const original = session.document;
  const before = original.tree();
  assert.throws(() => session.edit(working => {
    working.find('r').move(100, 200);
    throw new Error('edit failed');
  }), { message: 'edit failed' });
  assert.equal(session.document, original);
  assert.equal(run('tree'), before);
  assert.throws(() => session.edit(working => {
    working.remove('r');
    working.clone = () => { throw new Error('snapshot failed'); };
    return 'deleted';
  }), { message: 'snapshot failed' });
  assert.equal(session.document, original);
  assert.equal(run('tree'), before);
  run('redo');
  assert.equal(run('tree'), moved);
  assert.notEqual(session.document, original);
  run('undo');
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)');
  for (const command of ['redo', 'undo']) {
    const current = session.document;
    const state = current.tree();
    const clone = SvgDocument.prototype.clone;
    try {
      SvgDocument.prototype.clone = () => { throw new Error('restore failed'); };
      assert.throws(() => run(command), { message: 'restore failed' });
      assert.equal(session.document, current);
      assert.equal(run('tree'), state);
    } finally { SvgDocument.prototype.clone = clone; }
    // 同一个历史操作仍可重试，失败没有提前移动或丢弃栈项。
    run(command);
  }
  run('redo');
  run('redo');
  assert.equal(run('tree'), moved);
});

test('第八轮真实 CLI 回放验证整组历史、查询跳过、新编辑分支与 init 边界', () => {
  const input = readFileSync(path.resolve(__dirname, '../../examples/step-08.commands.txt'), 'utf8');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.replace(/\r\n/g, '\n'), 'error: undo not allowed after io command\nerror: nothing to redo\nerror: undo not allowed after io command\n');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.ok(output.includes('rect#box  parent=g#node\n  x=10 y=20 width=100 height=50\n  fill=red\n'));
  assert.ok(output.includes('text#label  parent=g#node\n  x=55 y=60 text="开始"\n'));
  assert.ok(output.includes('undone: g#node deleted\ng#scene\n└── g#node\n    ├── rect#box x=40 y=30 w=100 h=50 fill=red\n    └── text#label (55,60) "开始"\n'));
  assert.ok(output.endsWith('canvas 400x300 created\nsvg (400x300)\n'));
});
