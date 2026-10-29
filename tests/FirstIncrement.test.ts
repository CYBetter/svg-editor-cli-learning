import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession';
import { CommandDispatcher } from '../src/cli/CommandDispatcher';
import { RectShape } from '../src/domain/RectShape';

// 仅测试夹具：走真实命令入口，不修改模型内部字段。
function editor(): (line: string) => string | undefined {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher();
  return line => dispatcher.parse(line)?.execute(session);
}

test('最小命令链：移动改变位置，保留尺寸与样式', () => {
  const run = editor();
  assert.equal(run('init 800 600'), 'canvas 800x600 created');
  assert.equal(run('create rect r1 10 20 100 50 #ffffff'), 'rect#r1 created');
  assert.equal(run('tree'), 'svg (800x600)\n└── rect#r1 x=10 y=20 w=100 h=50 fill=#ffffff');
  assert.equal(run('move r1 30 10'), 'moved rect#r1 x=40 y=30 w=100 h=50 fill=#ffffff');
  assert.equal(run('tree r1'), 'rect#r1 x=40 y=30 w=100 h=50 fill=#ffffff');
});

test('init 默认尺寸、单参数和重新初始化；失败时不丢失旧文档', () => {
  const run = editor();
  assert.equal(run('init'), 'canvas 800x600 created');
  run('create rect r1 1 2 3 4');
  const before = run('tree');
  for (const command of ['init 0 600', 'init -1 600', 'init 800 NaN', 'init 800 1e309']) {
    assert.throws(() => run(command));
    assert.equal(run('tree'), before);
  }
  assert.equal(run('init 400'), 'canvas 400x600 created');
  assert.equal(run('tree'), 'svg (400x600)');
});

test('初始化前的已支持操作报告规定错误', () => {
  const run = editor();
  for (const command of ['create rect r1 1 2 3 4', 'move r1 1 1', 'tree']) {
    assert.throws(() => run(command), { message: "no document. use 'init' or 'read' first" });
  }
});

test('id 唯一、大小写敏感；重复创建和查找失败都不改动文档', () => {
  const run = editor();
  run('init');
  run('create rect r1 10 20 100 50');
  run('create rect R1 30 40 10 20');
  const before = run('tree');
  assert.throws(() => run('create rect r1 0 0 1 1'), { message: 'id already exists: r1' });
  assert.throws(() => run('move r9 5 5'), { message: 'no such shape: r9' });
  assert.throws(() => run('tree r9'), { message: 'no such shape: r9' });
  assert.equal(run('tree'), before);
  assert.equal(before, 'svg (800x600)\n├── rect#r1 x=10 y=20 w=100 h=50\n└── rect#R1 x=30 y=40 w=10 h=20');
});

test('连续负数与小数移动按增量累加', () => {
  const run = editor();
  run('init');
  run('create rect r1 10 20 100 50');
  run('move r1 5 -3');
  run('move r1 -2.5 .25');
  assert.equal(run('tree r1'), 'rect#r1 x=12.5 y=17.25 w=100 h=50');
});

test('非法参数、未知命令和图形类型不留下部分结果', () => {
  const run = editor();
  run('init');
  run('create rect r1 10 20 100 50');
  const before = run('tree');
  for (const command of [
    'move r1 5 nope', 'move r1 5 Infinity', 'move r1 5',
    'create rect bad 0 0 -1 2', 'create rect bad 0 0 1',
    'create rect "" 0 0 1 2', 'init 1 2 3', 'tree r1 extra',
    'create rect bad 0 0 1 2 red extra', 'unknown',
  ]) {
    assert.throws(() => run(command));
    assert.equal(run('tree'), before, command);
  }
  assert.throws(() => run('create hexagon h1'), {
    message: 'unknown shape type: hexagon (is the plugin loaded?)',
  });
  assert.equal(run('tree'), before);
});

test('第二坐标溢出时第一坐标也不改变；领域对象自身维护约束', () => {
  const run = editor();
  run('init');
  run('create rect large 10 1e308 100 50');
  const before = run('tree');
  assert.throws(() => run('move large 5 1e308'), { message: 'y must be a finite number' });
  assert.equal(run('tree'), before);

  const rectangle = new RectShape('direct', 10, 20, 100, 50);
  const description = rectangle.describe();
  assert.throws(() => rectangle.move(5, Number.NaN));
  assert.equal(rectangle.describe(), description);
});

test('整行注释、空行、引号与未指定 fill 保持各自语义', () => {
  const run = editor();
  assert.equal(run('  # comment'), undefined);
  assert.equal(run('   '), undefined);
  run('init');
  run('create rect r1 0 0 10 20');
  run('create rect r2 0 0 10 20 "rgb(1, 2, 3)"');
  assert.equal(run('tree r1'), 'rect#r1 x=0 y=0 w=10 h=20');
  assert.equal(run('tree r2'), 'rect#r2 x=0 y=0 w=10 h=20 fill=rgb(1, 2, 3)');
  const before = run('tree');
  assert.throws(() => run('create rect r3 0 0 1 1 "red'), { message: 'unclosed double quote' });
  assert.equal(run('tree'), before);
});

test('真实 CLI 回放：错误一行一条，报错后继续处理，最终文档不变', () => {
  const input = readFileSync(path.resolve(__dirname, '../../examples/step-01.commands.txt'), 'utf8');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.replace(/\r\n/g, '\n'),
    'error: id already exists: r1\nerror: no such shape: missing\n');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.match(output, /svg \(800x600\)\n└── rect#r1 x=10 y=20 w=100 h=50/);
  assert.equal(output.split('svg (800x600)\n└── rect#r1 x=40 y=30 w=100 h=50').length - 1, 2);
  assert.ok(output.endsWith('svg (800x600)\n└── rect#r1 x=40 y=30 w=100 h=50\n'));
});
