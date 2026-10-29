import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession';
import { CommandDispatcher } from '../src/cli/CommandDispatcher';
import { GroupShape } from '../src/domain/GroupShape';

function editor(): (line: string) => string | undefined {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher();
  return line => dispatcher.parse(line)?.execute(session);
}

test('嵌套组缩放五类叶子的全部几何字段，每个后代只处理一次', () => {
  const run = editor();
  run('init');
  run('create g scene');
  run('create g inner in scene');
  run('create rect r -10 20 100 50 red in inner');
  run('create circle c 100 50 20 in inner');
  run('create ellipse e 10 20 40 30 blue in scene');
  run('create line l 10 -20 30 40 black in scene');
  run('create text t 20 40 "开始" in scene');
  run('create rect outside 1 2 3 4');
  run('set r stroke-width 2');
  run('set scene fill green');
  run('scale scene 2');
  assert.equal(run('tree r'), 'rect#r x=-20 y=40 w=200 h=100 fill=red stroke-width=2');
  assert.equal(run('tree c'), 'circle#c cx=200 cy=100 r=40');
  assert.equal(run('tree e'), 'ellipse#e cx=20 cy=40 rx=80 ry=60 fill=blue');
  assert.equal(run('tree l'), 'line#l (20,-40) -> (60,80) stroke=black');
  assert.equal(run('tree t'), 'text#t (40,80) "开始"');
  assert.equal(run('tree outside'), 'rect#outside x=1 y=2 w=3 h=4');
  assert.equal(run('show scene'), 'g#scene  parent=svg\n  fill=green');
  run('scale inner .5');
  assert.equal(run('tree c'), 'circle#c cx=100 cy=50 r=20');
  assert.equal(run('tree e'), 'ellipse#e cx=20 cy=40 rx=80 ry=60 fill=blue');
});

test('每种叶子的最后一个几何字段溢出时，整组几何和样式都保持不变', () => {
  for (const form of [
    'rect last 10 20 30 1e308', 'circle last 10 20 1e308',
    'ellipse last 10 20 30 1e308', 'line last 10 20 30 1e308', 'text last 10 1e308 "保留"',
  ]) {
    const run = editor();
    run('init');
    run('create g scene');
    run('create g early in scene');
    run('create rect first 1 2 3 4 red in early');
    run(`create ${form} in scene`);
    run('set scene stroke-width 2');
    const before = run('tree');
    assert.throws(() => run('scale scene 2'), /must be a finite number/);
    assert.equal(run('tree'), before, form);
  }
});

test('非正、非有限缩放因子都失败，空组也不能绕过校验', () => {
  const run = editor();
  run('init');
  run('create g empty');
  const before = run('tree');
  for (const factor of ['0', '-1', '-0']) {
    assert.throws(() => run(`scale empty ${factor}`), { message: 'scale factor must be positive' });
    assert.equal(run('tree'), before);
  }
  for (const factor of ['NaN', 'Infinity', '1e309']) {
    assert.throws(() => run(`scale empty ${factor}`), /must be a finite number/);
    assert.equal(run('tree'), before);
  }
  const group = new GroupShape('direct');
  assert.throws(() => group.scale(Number.NaN), { message: 'scale factor must be a finite number' });
  assert.throws(() => group.scale(-1), { message: 'scale factor must be positive' });
  assert.equal(run('scale empty .5'), 'g#empty scaled by 0.5');
});

test('set 支持每种叶子完整的几何白名单，show 使用完整属性名称', () => {
  const run = editor();
  run('init');
  const cases: readonly [string, string, readonly [string, number][]][] = [
    ['rect r 0 0 1 1', 'r', [['x', -1.5], ['y', 2.5], ['width', 0], ['height', 4]]],
    ['circle c 0 0 1', 'c', [['cx', -1.5], ['cy', 2.5], ['r', 0]]],
    ['ellipse e 0 0 1 1', 'e', [['cx', -1.5], ['cy', 2.5], ['rx', 0], ['ry', 4]]],
    ['line l 0 0 1 1', 'l', [['x1', -1.5], ['y1', 2.5], ['x2', 3], ['y2', -4]]],
    ['text t 0 0 "a"', 't', [['x', -1.5], ['y', 2.5]]],
  ];
  for (const [form, id, attributes] of cases) {
    run(`create ${form}`);
    for (const [name, value] of attributes) run(`set ${id} ${name} ${value}`);
    const expected = attributes.map(([name, value]) => `${name}=${value}`).join(' ');
    const text = id === 't' ? ' text="a"' : '';
    assert.equal(run(`show ${id}`), `${form.split(' ')[0]}#${id}  parent=svg\n  ${expected}${text}`);
  }
});

test('六类对象均支持公共样式，未指定样式不生成默认值', () => {
  const run = editor();
  run('init');
  const forms = ['rect r 0 0 1 1', 'circle c 0 0 1', 'ellipse e 0 0 1 1', 'line l 0 0 1 1', 'text t 0 0 "a"', 'g g'];
  for (const form of forms) {
    run(`create ${form}`);
    const id = form.split(' ')[1];
    assert.doesNotMatch(run(`show ${id}`)!, /fill=|stroke=/);
    run(`set ${id} fill red`);
    run(`set ${id} stroke black`);
    run(`set ${id} stroke-width 2.50`);
    assert.ok(run(`show ${id}`)?.endsWith('\n  fill=red stroke=black stroke-width=2.5'));
    run(`set ${id} stroke-width 0`);
    assert.ok(run(`show ${id}`)?.endsWith('stroke-width=0'));
  }
});

test('组样式只存于组，显式子样式和缺省子样式均保留', () => {
  const run = editor();
  run('init');
  run('create g outer');
  run('create g inner in outer');
  run('create rect plain 0 0 1 1 in inner');
  run('create circle explicit 0 0 1 red in inner');
  run('set outer fill blue');
  run('set inner stroke black');
  run('set inner stroke-width 3');
  const before = run('tree');
  assert.equal(run('show outer'), 'g#outer  parent=svg\n  fill=blue');
  assert.equal(run('show inner'), 'g#inner  parent=g#outer\n  stroke=black stroke-width=3');
  assert.equal(run('show plain'), 'rect#plain  parent=g#inner\n  x=0 y=0 width=1 height=1');
  assert.equal(run('show explicit'), 'circle#explicit  parent=g#inner\n  cx=0 cy=0 r=1\n  fill=red');
  assert.equal(run('tree'), before);
});

test('text 伪属性支持中文空格、字面引号及空内容，其他类型拒绝 text', () => {
  const run = editor();
  run('init');
  run('create text t 1 2 "old"');
  run('set t text "处理数据 v2"');
  assert.equal(run('tree t'), 'text#t (1,2) "处理数据 v2"');
  run(String.raw`set t text "他说：\"开始\""`);
  assert.equal(run('show t'), 'text#t  parent=svg\n  x=1 y=2 text=' + JSON.stringify('他说："开始"'));
  run('set t text ""');
  assert.equal(run('tree t'), 'text#t (1,2) ""');
  run('create g g');
  assert.throws(() => run('set g text "bad"'), { message: 'unknown attribute: text' });
});

test('未知属性、非法数值和负尺寸修改失败，既有几何和样式不变', () => {
  const run = editor();
  run('init');
  run('create rect r 1 2 3 4 red');
  run('create circle c 1 2 3');
  run('create ellipse e 1 2 3 4');
  run('create g g');
  run('set r stroke-width 2');
  const before = run('tree');
  for (const [id, attr] of [['r', 'r'], ['c', 'width'], ['e', 'x'], ['g', 'x'], ['r', 'id'], ['r', 'transform'], ['r', 'font-size'], ['r', 'label']]) {
    assert.throws(() => run(`set ${id} ${attr} 10`), { message: `unknown attribute: ${attr}` });
    assert.equal(run('tree'), before);
  }
  for (const command of [
    'set r width -1', 'set r height -1', 'set c r -1', 'set e rx -1', 'set e ry -1',
    'set r stroke-width -1', 'set r stroke-width NaN', 'set r x NaN', 'set r y Infinity', 'set c r 1e309',
  ]) {
    assert.throws(() => run(command), command);
    assert.equal(run('tree'), before, command);
  }
});

test('新命令检查初始化、缺失目标和参数数量，失败不修改文档', () => {
  const run = editor();
  for (const command of ['scale r 2', 'set r fill red', 'show r']) {
    assert.throws(() => run(command), { message: "no document. use 'init' or 'read' first" });
  }
  run('init');
  run('create rect r 1 2 3 4');
  const before = run('tree');
  for (const command of ['scale missing 2', 'set missing fill red', 'show missing']) {
    assert.throws(() => run(command), { message: 'no such shape: missing' });
  }
  for (const command of ['scale r', 'scale r 2 extra', 'set r fill', 'set r fill red extra', 'show', 'show r extra']) {
    assert.throws(() => run(command), command);
    assert.equal(run('tree'), before);
  }
});

test('第五轮真实 CLI 回放验证属性查询与两次失败后的状态', () => {
  const input = readFileSync(path.resolve(__dirname, '../../examples/step-05.commands.txt'), 'utf8');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.replace(/\r\n/g, '\n'), 'error: scale factor must be positive\nerror: width must not be negative\n');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.ok(output.includes('text#label  parent=g#node\n  x=50 y=100 text="处理数据 v2"\n'));
  assert.ok(output.endsWith('rect#box  parent=g#node\n  x=20 y=40 width=200 height=100\n  stroke=black stroke-width=2\n'));
});
