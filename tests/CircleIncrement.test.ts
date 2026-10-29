import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession';
import { CommandDispatcher } from '../src/cli/CommandDispatcher';
import { CircleShape } from '../src/domain/CircleShape';

function editor(): (line: string) => string | undefined {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher();
  return line => dispatcher.parse(line)?.execute(session);
}

test('同一命令入口移动矩形与圆形，保留各自尺寸和样式', () => {
  const run = editor();
  run('init');
  run('create rect r1 10 20 100 50');
  assert.equal(run('create circle c1 100 100 20 red'), 'circle#c1 created');
  run('move r1 30 10');
  assert.equal(run('move c1 30 10'), 'moved circle#c1 cx=130 cy=110 r=20 fill=red');
  assert.equal(run('tree'), 'svg (800x600)\n├── rect#r1 x=40 y=30 w=100 h=50\n└── circle#c1 cx=130 cy=110 r=20 fill=red');
  run('move c1 -30.5 .25');
  assert.equal(run('tree c1'), 'circle#c1 cx=99.5 cy=110.25 r=20 fill=red');
});

test('圆形的可选样式、零半径、小数和负坐标；跨类型共享 id 空间', () => {
  const run = editor();
  assert.throws(() => run('create circle c1 0 0 1'), { message: "no document. use 'init' or 'read' first" });
  run('init');
  run('create circle c1 -1.5 2.25 0');
  run('create rect r1 0 0 1 1');
  assert.equal(run('tree c1'), 'circle#c1 cx=-1.5 cy=2.25 r=0');
  const before = run('tree');
  assert.throws(() => run('create circle r1 0 0 1'), { message: 'id already exists: r1' });
  assert.throws(() => run('create rect c1 0 0 1 1'), { message: 'id already exists: c1' });
  assert.equal(run('tree'), before);
  run('create circle C1 0 0 2 #ffffff');
  assert.equal(run('tree C1'), 'circle#C1 cx=0 cy=0 r=2 fill=#ffffff');
});

test('圆形参数错误不新增对象，也不改变既有对象', () => {
  const run = editor();
  run('init');
  run('create circle c1 10 20 3');
  const before = run('tree');
  for (const command of [
    'create circle bad 0 0 -1', 'create circle bad NaN 0 1',
    'create circle bad 0 Infinity 1', 'create circle bad 0 0 1e309',
    'create circle bad 0 0', 'create circle bad 0 0 1 red extra',
    'create circle "" 0 0 1', 'move c1 1 NaN',
  ]) {
    assert.throws(() => run(command));
    assert.equal(run('tree'), before, command);
  }
  assert.throws(() => new CircleShape('direct', 0, 0, -1), { message: 'r must not be negative' });
});

test('圆心第二坐标溢出时整个移动失败；直接调用也受保护', () => {
  const run = editor();
  run('init');
  run('create circle c1 10 1e308 20 red');
  const before = run('tree');
  assert.throws(() => run('move c1 5 1e308'), { message: 'cy must be a finite number' });
  assert.equal(run('tree'), before);
  const circle = new CircleShape('direct', 10, 20, 3);
  const description = circle.describe();
  assert.throws(() => circle.move(5, Number.NaN));
  assert.equal(circle.describe(), description);
});

test('真实 CLI 回放两类图形，重复 id 报错后仍保留同一文档', () => {
  const input = readFileSync(path.resolve(__dirname, '../../examples/step-02.commands.txt'), 'utf8');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.replace(/\r\n/g, '\n'), 'error: id already exists: r1\n');
  const expectedTree = 'svg (800x600)\n├── rect#r1 x=40 y=30 w=100 h=50\n└── circle#c1 cx=130 cy=110 r=20 fill=red';
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.equal(output.split(expectedTree).length - 1, 2);
  assert.ok(output.endsWith(expectedTree + '\n'));
});
