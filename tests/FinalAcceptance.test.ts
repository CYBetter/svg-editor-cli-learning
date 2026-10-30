import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test, { TestContext } from 'node:test';
import { SvgReader } from '../src/infrastructure/SvgReader';
import { SvgWriter } from '../src/infrastructure/SvgWriter';

const projectRoot = path.resolve(__dirname, '../..');

function temporaryDirectory(t: TestContext): string {
  // 使用项目目录，避免某些 Windows 环境的系统临时目录限制原子替换。
  const directory = mkdtempSync(path.join(projectRoot, 'svg-learning-final-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), projectRoot);
    assert.ok(path.basename(directory).startsWith('svg-learning-final-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

function replay(directory: string, input: string): { output: string; errors: string } {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    cwd: directory, input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  return {
    output: result.stdout.replace(/\r\n/g, '\n'),
    errors: result.stderr.replace(/\r\n/g, '\n'),
  };
}

test('综合验收：完整回放课设典型会话，核对两条错误、保存状态和读入后的七元素树', t => {
  const directory = temporaryDirectory(t);
  const fixture = readFileSync(path.join(projectRoot, 'examples/other.svg'));
  writeFileSync(path.join(directory, 'other.svg'), fixture);
  const script = readFileSync(path.join(projectRoot, 'examples/course-session.commands.txt'), 'utf8');
  const { output, errors } = replay(directory, script);
  assert.equal(errors, [
    'error: cannot group a container into its own descendant: markers',
    'error: undo not allowed after io command', '',
  ].join('\n'));
  assert.ok(output.includes([
    'svg (800x600)',
    '├── rect#bg x=0 y=0 w=800 h=600 fill=#ffffff',
    '├── text#title (20,40) "My Diagram"',
    '└── g#markers',
    '    ├── circle#c1 cx=100 cy=100 r=20 fill=red',
    '    └── rect#box x=200 y=80 w=60 h=60 fill=#3366ff',
  ].join('\n')));
  assert.ok(output.includes('saved to demo.svg (5 elements)\n'));
  assert.equal(output.match(/warning: assigned id rect1 to unnamed <rect>/g)?.length, 1);
  assert.ok(output.endsWith([
    'warning: assigned id rect1 to unnamed <rect>',
    'read other.svg (7 elements)',
    'svg (400x300)',
    '├── rect#rect1 x=0 y=0 w=400 h=300 fill=#ffffff',
    '├── text#t1 (10,290) "imported"',
    '├── circle#c1 cx=50 cy=50 r=10',
    '├── g#g1',
    '│   ├── rect#r2 x=0 y=0 w=10 h=10',
    '│   └── circle#c2 cx=5 cy=5 r=2',
    '└── ellipse#e1 cx=1 cy=2 rx=3 ry=4', '',
  ].join('\n')));

  const saved = readFileSync(path.join(directory, 'demo.svg'), 'utf8');
  const loaded = new SvgReader().read(saved, 'demo.svg');
  assert.equal(loaded.document.elementCount, 5);
  assert.equal(loaded.document.tree(), [
    'svg (800x600)',
    '├── rect#bg x=0 y=0 w=800 h=600 fill=#ffffff',
    '├── text#title (20,40) "My Diagram"',
    '└── g#markers',
    '    ├── circle#c1 cx=130 cy=100 r=20 fill=red',
    '    └── rect#box x=200 y=80 w=60 h=60 fill=#3366ff',
  ].join('\n'));
  assert.equal(loaded.document.writeTo(new SvgWriter()), saved);
  assert.deepEqual(readFileSync(path.join(directory, 'other.svg')), fixture);
  assert.deepEqual(readdirSync(directory).sort(), ['demo.svg', 'other.svg']);
});

test('综合验收：完整回放流程图 A，组移动与撤销同步影响框和文字，保存八元素并可编辑读回', t => {
  const directory = temporaryDirectory(t);
  const script = readFileSync(path.join(projectRoot, 'examples/course-flowchart.commands.txt'), 'utf8');
  // 只在移动与撤销后插入只读查询，观察真实 CLI 的中间状态，不改变原命令顺序。
  const observed = script.split(/\r?\n/).flatMap(line =>
    line === 'move node2 0 100' || line === 'undo'
      ? [line, 'show process', 'show process-label'] : [line]).join('\n');
  const { output, errors } = replay(directory, observed);
  assert.equal(errors, '');
  const moved = [
    'rect#process  parent=g#node2',
    '  x=520 y=200 width=160 height=60',
    '  fill=#f5a623',
    'text#process-label  parent=g#node2',
    '  x=545 y=235 text="处理数据"',
  ].join('\n');
  const restored = moved.replace('y=200', 'y=100').replace('y=235', 'y=135');
  assert.ok(output.includes(moved));
  assert.ok(output.includes(restored));
  assert.ok(output.indexOf(restored) > output.indexOf(moved));
  assert.ok(output.endsWith('saved to flowchart.svg (8 elements)\n'));

  const saved = readFileSync(path.join(directory, 'flowchart.svg'), 'utf8');
  const loaded = new SvgReader().read(saved, 'flowchart.svg');
  assert.equal(loaded.document.elementCount, 8);
  const expectedTree = [
    'svg (800x600)',
    '└── g#flowchart',
    '    ├── g#node1',
    '    │   ├── rect#start x=120 y=100 w=160 h=60 fill=#4a90d9',
    '    │   └── text#start-label (155,135) "开始"',
    '    ├── g#node2',
    '    │   ├── rect#process x=520 y=100 w=160 h=60 fill=#f5a623',
    '    │   └── text#process-label (545,135) "处理数据 v2"',
    '    └── line#arrow1 (280,130) -> (520,130) stroke=black',
  ].join('\n');
  assert.equal(loaded.document.tree(), expectedTree);
  assert.equal(loaded.document.writeTo(new SvgWriter()), saved);

  const readBack = replay(directory, [
    'read flowchart.svg', 'undo', 'move node2 0 100', 'undo',
    'tree', 'save round-trip.svg', 'redo', '',
  ].join('\n'));
  assert.equal(readBack.errors, 'error: undo not allowed after io command\n'.repeat(2));
  assert.ok(readBack.output.includes(expectedTree + '\n'));
  assert.equal(readFileSync(path.join(directory, 'round-trip.svg'), 'utf8'), saved);
  assert.deepEqual(readdirSync(directory).sort(), ['flowchart.svg', 'round-trip.svg']);
});
