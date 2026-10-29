import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession';
import { CommandDispatcher } from '../src/cli/CommandDispatcher';
import { EllipseShape } from '../src/domain/EllipseShape';
import { LineShape } from '../src/domain/LineShape';
import { TextShape } from '../src/domain/TextShape';

function editor(): (line: string) => string | undefined {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher();
  return line => dispatcher.parse(line)?.execute(session);
}

test('椭圆移动只改变圆心，保留两条半径与可选填色', () => {
  const run = editor();
  run('init');
  assert.equal(run('create ellipse e1 100 100 40 20 #88ccff'), 'ellipse#e1 created');
  run('move e1 -10.5 .25');
  assert.equal(run('tree e1'), 'ellipse#e1 cx=89.5 cy=100.25 rx=40 ry=20 fill=#88ccff');
  run('create ellipse flat 0 0 0 1');
  assert.equal(run('tree flat'), 'ellipse#flat cx=0 cy=0 rx=0 ry=1');
});

test('线段两端同时平移，端点差保持不变；stroke 省略时不填默认值', () => {
  const run = editor();
  run('init');
  assert.equal(run('create line edge 10 20 100 20 black'), 'line#edge created');
  run('move edge 10 5');
  assert.equal(run('tree edge'), 'line#edge (20,25) -> (110,25) stroke=black');
  run('move edge -.5 -30');
  assert.equal(run('tree edge'), 'line#edge (19.5,-5) -> (109.5,-5) stroke=black');
  run('create line point 0 0 0 0');
  assert.equal(run('tree point'), 'line#point (0,0) -> (0,0)');
});

test('文字移动保留中文、空格、空文本和特殊内容', () => {
  const run = editor();
  run('init');
  const contents = ['开始处理 My Diagram', '', '  前后空格  ', '#不是注释', 'in', '<A & B>'];
  for (const [index, content] of contents.entries()) {
    run(`create text t${index} 20 40 "${content}"`);
    run(`move t${index} 10 -5`);
    assert.equal(run(`tree t${index}`), `text#t${index} (30,35) ${JSON.stringify(content)}`);
  }
  run(String.raw`create text quoted 0 0 "他说：\"开始\""`);
  assert.equal(run('tree quoted'), 'text#quoted (0,0) ' + JSON.stringify('他说："开始"'));
});

test('新类型的非法几何值或参数数量失败，不改变已有文档', () => {
  const run = editor();
  for (const command of ['create ellipse e 0 0 1 2', 'create line l 0 0 1 1', 'create text t 0 0 "a"']) {
    assert.throws(() => run(command), { message: "no document. use 'init' or 'read' first" });
  }
  run('init');
  run('create rect keep 0 0 10 10');
  const before = run('tree');
  for (const command of [
    'create ellipse bad 0 0 -1 2', 'create ellipse bad 0 0 1 -2',
    'create ellipse bad 0 0 1 Infinity', 'create ellipse bad 0 0 1',
    'create ellipse bad 0 0 1 2 red extra',
    'create line bad 0 0 1 NaN', 'create line bad 0 0 1',
    'create line bad 0 0 1 2 black extra',
    'create text bad Infinity 0 "a"', 'create text bad 0 1e309 "a"',
    'create text bad 0 0', 'create text bad 0 0 hello world',
    'create text bad 0 0 "unclosed',
  ]) {
    assert.throws(() => run(command), command);
    assert.equal(run('tree'), before, command);
  }
});

test('线段最后一个坐标及其他图形的坐标溢出时，全部状态不变', () => {
  const run = editor();
  run('init');
  run('create ellipse e 10 1e308 4 2');
  run('create line l 10 20 30 1e308 black');
  run('create text t 10 1e308 "保留文字"');
  const before = run('tree');
  for (const id of ['e', 'l', 't']) {
    assert.throws(() => run(`move ${id} 5 1e308`));
    assert.equal(run('tree'), before);
  }
  for (const shape of [new EllipseShape('e', 1, 2, 3, 4), new LineShape('l', 1, 2, 3, 4), new TextShape('t', 1, 2, 'text')]) {
    const description = shape.describe();
    assert.throws(() => shape.move(1, Number.NaN));
    assert.equal(shape.describe(), description);
  }
});

test('五类叶子共享文档与唯一 id，树按创建顺序混合显示', () => {
  const run = editor();
  run('init');
  const forms = ['rect ID 0 0 1 2', 'circle ID 0 0 1', 'ellipse ID 0 0 1 2', 'line ID 0 0 1 2', 'text ID 0 0 "a"'];
  forms.forEach((form, index) => run(`create ${form.replace('ID', `s${index}`)}`));
  const before = run('tree');
  for (const form of forms) {
    assert.throws(() => run(`create ${form.replace('ID', 's4')}`), { message: 'id already exists: s4' });
    assert.equal(run('tree'), before);
  }
  assert.deepEqual(before?.split('\n').slice(1).map(row => row.split(' ')[1]),
    ['rect#s0', 'circle#s1', 'ellipse#s2', 'line#s3', 'text#s4']);
});

test('第三轮真实 CLI 回放包含中文、空文本与转义引号', () => {
  const input = readFileSync(path.resolve(__dirname, '../../examples/step-03.commands.txt'), 'utf8');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.ok(output.includes('svg (800x600)\n├── ellipse#e1 cx=110 cy=105 rx=40 ry=20 fill=#88ccff\n├── line#edge (20,25) -> (110,25) stroke=black\n└── text#title (30,45) "开始处理 My Diagram"'));
  assert.ok(output.includes('text#quoted (0,0) ' + JSON.stringify('他说："开始"')));
  assert.ok(output.endsWith('text#empty (0,20) ""\n'));
});
