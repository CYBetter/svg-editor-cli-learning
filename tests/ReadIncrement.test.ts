import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test, { TestContext } from 'node:test';
import { EditorSession } from '../src/application/EditorSession';
import { CommandDispatcher } from '../src/cli/CommandDispatcher';
import { SvgFileStore } from '../src/infrastructure/SvgFileStore';
import { SvgReader } from '../src/infrastructure/SvgReader';
import { SvgWriter } from '../src/infrastructure/SvgWriter';

const rectangle = '<rect id="r" x="1" y="2" width="3" height="4"/>';

function svg(body = '', attributes = 'width="400" height="300"'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${body}</svg>`;
}

function editor(): { session: EditorSession; run: (line: string) => string | undefined } {
  const files = new SvgFileStore();
  const session = new EditorSession(files, files);
  const dispatcher = new CommandDispatcher();
  return { session, run: line => dispatcher.parse(line)?.execute(session) };
}

function temporaryDirectory(t: TestContext): string {
  // dist/tests 的上两级是工程根；系统临时目录可能限制 rename。
  const root = path.resolve(__dirname, '../..');
  const directory = mkdtempSync(path.join(root, 'svg-learning-read-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), root);
    assert.ok(path.basename(directory).startsWith('svg-learning-read-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test('读取课设 other.svg，补 rect1 后保留七个元素的层级、顺序与精确警告', () => {
  const input = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>`;
  const loaded = new SvgReader().read(input, 'other.svg');
  assert.equal(loaded.describe('other.svg'),
    'warning: assigned id rect1 to unnamed <rect>\nread other.svg (7 elements)');
  assert.equal(loaded.document.tree(), [
    'svg (400x300)', '├── rect#rect1 x=0 y=0 w=400 h=300 fill=#ffffff',
    '├── text#t1 (10,290) "imported"', '├── circle#c1 cx=50 cy=50 r=10',
    '├── g#g1', '│   ├── rect#r2 x=0 y=0 w=10 h=10',
    '│   └── circle#c2 cx=5 cy=5 r=2', '└── ellipse#e1 cx=1 cy=2 rx=3 ry=4',
  ].join('\n'));
  assert.equal(loaded.document.show('r2'), 'rect#r2  parent=g#g1\n  x=0 y=0 width=10 height=10');
});

test('先预留全部显式 ID，再按先序补最小可用编号，跨类型避撞且区分大小写', () => {
  const loaded = new SvgReader().read(svg([
    '<rect x="0" y="0" width="1" height="1"/>',
    '<g><rect id="" x="2" y="3" width="4" height="5"/></g>',
    '<circle id="rect1" cx="1" cy="2" r="3"/>',
    '<rect id="rect2" x="4" y="5" width="6" height="7"/>',
    '<g id="g1"/>', '<g id="G2"/>',
  ].join('')), 'ids.svg');
  assert.equal(loaded.describe('ids.svg'), [
    'warning: assigned id rect3 to unnamed <rect>',
    'warning: assigned id g2 to unnamed <g>',
    'warning: assigned id rect4 to unnamed <rect>',
    'read ids.svg (7 elements)',
  ].join('\n'));
  assert.equal(loaded.document.tree('g2'), 'g#g2\n└── rect#rect4 x=2 y=3 w=4 h=5');
  assert.equal(loaded.document.tree('rect1'), 'circle#rect1 cx=1 cy=2 r=3');
  assert.equal(loaded.document.tree('G2'), 'g#G2');
});

test('显式重复 ID 在不同类型或深层容器之间仍被拒绝，合法大小写 ID 可共存', () => {
  const reader = new SvgReader();
  for (const body of [
    rectangle + '<circle id="r" cx="0" cy="0" r="1"/>',
    `<g id="outer">${rectangle}<g id="inner"><text id="r" x="0" y="0">a</text></g></g>`,
    '<g id="same"><g id="same"/></g>',
  ]) {
    const id = body.includes('id="same"') ? 'same' : 'r';
    assert.throws(() => reader.read(svg(body), 'duplicate.svg'), { message: `id already exists: ${id}` });
  }
  const distinct = reader.read(svg(rectangle + '<rect id="R" x="0" y="0" width="1" height="1"/>'), 'case.svg');
  assert.equal(distinct.document.elementCount, 2);
});

test('六类图形保存再读取再保存，几何、树顺序、显式样式与 XML 字节保持一致', t => {
  const directory = temporaryDirectory(t);
  const first = path.join(directory, 'first.svg');
  const second = path.join(directory, 'second.svg');
  const original = editor();
  for (const command of ['init 320.5 200.25', 'create g scene', 'set scene fill blue',
    'create rect r 1 2 3 4 in scene', 'create circle c 5 6 7 red in scene',
    'create g inner in scene', 'create ellipse e 8 9 10 11 in inner',
    'create line l 12 13 14 15 black in scene', 'set l stroke-width 2.5',
    'create text t 16 17 "placeholder" in inner', 'create text empty 0 0 ""',
    'set empty fill ""', 'create g vacant', 'move scene 10 20', 'front r']) original.run(command);
  original.session.edit(document => {
    document.find('t').setAttribute('text', '中文😀 <tag> & "引号"\t\r\n  末尾');
    document.find('t').setAttribute('stroke', 'a&"<>\t\r\n');
    return 'special text and style';
  });
  const expected = original.session.document.tree();
  original.session.save(first);
  const imported = editor();
  assert.equal(imported.session.read(first), `read ${first} (9 elements)`);
  assert.equal(imported.session.document.tree(), expected);
  assert.notEqual(imported.session.document, original.session.document);
  imported.session.save(second);
  assert.equal(readFileSync(second, 'utf8'), readFileSync(first, 'utf8'));
  imported.run('move scene 1 1');
  assert.equal(original.session.document.tree(), expected);
});

test('空画布、空组、空文字以及实体和 CDATA 文字完整读回，注释不变成节点', () => {
  const reader = new SvgReader();
  assert.equal(reader.read(svg(), 'empty.svg').document.tree(), 'svg (400x300)');
  const loaded = reader.read(svg('<g id="g"><!-- comment --><text id="blank" x="0" y="0"/>'
    + '<text id="t" x="1" y="2">前&amp;<![CDATA[<tag>]]><!-- comment -->&#9;&#13;&#10;后😀</text></g>'), 'text.svg');
  assert.equal(loaded.document.elementCount, 3);
  assert.equal(loaded.document.tree('blank'), 'text#blank (0,0) ""');
  assert.equal(loaded.document.tree('t'), `text#t (1,2) ${JSON.stringify('前&<tag>\t\r\n后😀')}`);
  assert.ok(loaded.document.writeTo(new SvgWriter()).includes('前&amp;&lt;tag&gt;&#9;&#13;&#10;后😀'));
});

test('标准 SVG、统一无命名空间和绑定前缀可读取，外来元素或属性命名空间被拒绝', () => {
  const reader = new SvgReader();
  for (const input of [svg(rectangle), `<svg width="400" height="300">${rectangle}</svg>`,
    '<s:svg xmlns:s="http://www.w3.org/2000/svg" width="400" height="300"><s:rect id="r" x="1" y="2" width="3" height="4"/></s:svg>']) {
    assert.equal(reader.read(input, 'namespace.svg').document.tree('r'), 'rect#r x=1 y=2 w=3 h=4');
  }
  for (const input of [
    '<svg xmlns="urn:other" width="400" height="300"/>',
    svg('<rect xmlns="" id="r" x="1" y="2" width="3" height="4"/>'),
    svg('<f:rect xmlns:f="urn:foreign" id="r" x="1" y="2" width="3" height="4"/>'),
    svg('<rect xmlns:f="urn:foreign" id="r" x="1" y="2" width="3" height="4" f:fill="red"/>'),
    '<svg width="400" height="300"><rect xmlns="http://www.w3.org/2000/svg" id="r" x="1" y="2" width="3" height="4"/></svg>',
  ]) assert.throws(() => reader.read(input, 'namespace.svg'));
});

test('XML 畸形、重复属性、未知实体、非法字符、DTD 和处理指令全部拒绝', () => {
  const reader = new SvgReader();
  for (const input of [
    '', '<svg width="400" height="300"><g></svg>', svg() + svg(),
    '<svg width="400" width="500" height="300"/>',
    svg('<text id="t" x="0" y="0">&unknown;</text>'),
    svg('<text id="t" x="0" y="0">\u0000</text>'),
    svg('<text id="t" x="0" y="0">&#0;</text>'),
    '<!DOCTYPE svg>' + svg(),
    '<!DOCTYPE svg [<!ENTITY item "value">]>' + svg(),
    '<?xml-stylesheet href="style.css"?>' + svg(),
    '<?xml version="1.1"?>' + svg(),
    '<?xml version="1.0" encoding="UTF-16"?>' + svg(),
    svg('<g id="g"') ,
  ]) assert.throws(() => reader.read(input, 'broken.svg'), /invalid SVG:/);
});

test('不能保留的图形、扩展属性和结构均报错，不能静默删除或扁平化', () => {
  const reader = new SvgReader();
  for (const body of [
    '<path id="p" d="M0 0L10 10"/>', '<box id="box"/>',
    '<g id="g" transform="translate(1,2)">' + rectangle + '</g>',
    '<text id="t" x="0" y="0" font-size="20">hello</text>',
    '<text id="t" x="0" y="0" text="lost">real</text>',
    '<rect id="r" x="1" y="2" width="3" height="4" style="fill:red"/>',
    '<g id="g">unrepresentable text</g>', 'text outside shapes',
    '<rect id="r" x="1" y="2" width="3" height="4">text</rect>',
    '<text id="t" x="0" y="0"><g id="g"/></text>',
    '<rect id="r" x="1" y="2" width="3" height="4"><g id="g"/></rect>',
    '<svg width="20" height="20"/>',
  ]) assert.throws(() => reader.read(svg(body), 'unsupported.svg'));
  assert.throws(() => reader.read(svg(rectangle, 'width="400" height="300" fill="red"'), 'root-style.svg'));
});

test('读取尺寸和完整几何约定：接受有限小数及匹配 viewBox，拒绝缺字段、单位与变换坐标系', () => {
  const reader = new SvgReader();
  const valid = reader.read(svg('<rect id="r" x=" -1.5 " y=" 2e1 " width="0" height="4"/>',
    'width=" 12.5 " height="20.25" viewBox="0,0,12.5,20.25"'), 'numeric.svg');
  assert.equal(valid.document.size, '12.5x20.25');
  assert.equal(valid.document.tree('r'), 'rect#r x=-1.5 y=20 w=0 h=4');
  for (const attributes of [
    'height="300"', 'width="400"', 'width="0" height="300"', 'width="400" height="-1"',
    'width="Infinity" height="300"', 'width="400px" height="300"',
    'width="400" height="300" viewBox="1 0 400 300"',
    'width="400" height="300" viewBox="0 0 800 600"',
    'width="400" height="300" viewBox="0 0 400"',
  ]) assert.throws(() => reader.read(svg(rectangle, attributes), 'numeric.svg'));
  for (const body of [
    '<rect id="r" y="2" width="3" height="4"/>',
    '<circle id="c" cx="1" cy="2"/>', '<ellipse id="e" cx="0" cy="0" rx="2"/>',
    '<line id="l" x1="0" y1="0" x2="1"/>', '<text id="t" x="0">a</text>',
    '<rect id="r" x="0" y="0" width="-1" height="2"/>',
    '<circle id="c" cx="1e309" cy="0" r="1"/>',
    '<text id="t" x="1px" y="0">a</text>',
    '<g id="g" stroke-width="-1"/>',
  ]) assert.throws(() => reader.read(svg(body), 'numeric.svg'));
});

test('read 可用于未初始化会话，参数和文件错误准确，非法 UTF-8 不会被替换成乱码', t => {
  const directory = temporaryDirectory(t);
  const good = path.join(directory, 'good.svg');
  const bad = path.join(directory, 'invalid-utf8.svg');
  writeFileSync(good, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(svg(rectangle), 'utf8')]));
  writeFileSync(bad, Buffer.from([0xc3, 0x28]));
  const { session, run } = editor();
  assert.throws(() => run('read'), { message: 'usage: read <file.svg>' });
  assert.throws(() => run('read a.svg b.svg'), { message: 'usage: read <file.svg>' });
  for (const target of ['', directory, path.join(directory, 'missing.svg')]) {
    assert.throws(() => session.read(target), { message: `cannot read file: ${target}` });
  }
  assert.throws(() => session.read(bad), { message: 'invalid SVG: file must be UTF-8' });
  assert.throws(() => session.document, { message: "no document. use 'init' or 'read' first" });
  assert.equal(run(`read "${good}"`), `read ${good} (1 elements)`);
  assert.equal(session.document.tree('r'), 'rect#r x=1 y=2 w=3 h=4');
});

test('成功 read 替换旧文档并清空两栈，查询不解禁，新编辑仅能退回读入基线', t => {
  const target = path.join(temporaryDirectory(t), 'new.svg');
  writeFileSync(target, svg(rectangle));
  const { session, run } = editor();
  run('init');
  run('create circle old 1 2 3');
  run('move old 10 20');
  run('undo');
  const previous = session.document;
  session.read(target);
  assert.notEqual(session.document, previous);
  assert.throws(() => session.document.find('old'), { message: 'no such shape: old' });
  for (const command of ['undo', 'redo']) {
    assert.throws(() => run(command), { message: 'undo not allowed after io command' });
  }
  run('tree'); run('show r'); run('help'); run('canvas');
  assert.throws(() => run('move missing 1 1'));
  assert.throws(() => run('undo'), { message: 'undo not allowed after io command' });
  run('move r 10 20');
  run('undo');
  assert.equal(run('tree r'), 'rect#r x=1 y=2 w=3 h=4');
  assert.throws(() => run('undo'), { message: 'nothing to undo' });
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
});

test('失败读取保留原实例、两个历史栈和先前读入路径，随后仍可 redo 与默认保存', t => {
  const directory = temporaryDirectory(t);
  const source = path.join(directory, 'source.svg');
  const bad = path.join(directory, 'bad.svg');
  writeFileSync(source, svg(rectangle));
  const { session, run } = editor();
  session.read(source);
  run('move r 1 0');
  run('move r 10 20');
  run('undo');
  const original = session.document;
  const before = run('tree');
  for (const input of [svg('<rect x="0" y="0" width="2" height="3"/><g id="bad" transform="translate(1)"/>'),
    '<svg>', svg(rectangle + rectangle), svg(rectangle, 'width="0" height="300"')]) {
    writeFileSync(bad, input);
    assert.throws(() => session.read(bad));
    assert.equal(session.document, original);
    assert.equal(run('tree'), before);
  }
  assert.throws(() => run('read a b'), { message: 'usage: read <file.svg>' });
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=12 y=22 w=3 h=4');
  run('undo'); run('undo');
  assert.equal(run('tree r'), 'rect#r x=1 y=2 w=3 h=4');
  run('move r 7 8');
  assert.equal(run('save'), `saved to ${source} (1 elements)`);
  assert.ok(readFileSync(source, 'utf8').includes('x="8" y="10"'));
  assert.equal(readFileSync(bad, 'utf8'), svg(rectangle, 'width="0" height="300"'));
});

test('显式另存不改变读入路径，无参保存回到源文件，失败另存也不改变默认路径', t => {
  const directory = temporaryDirectory(t);
  const source = path.join(directory, 'original.svg');
  const copy = path.join(directory, 'copy.svg');
  const { session, run } = editor();
  writeFileSync(source, svg(rectangle));
  session.read(source);
  run('move r 10 20');
  session.save(copy);
  const copied = readFileSync(copy, 'utf8');
  assert.ok(copied.includes('x="11" y="22"'));
  assert.equal(readFileSync(source, 'utf8'), svg(rectangle));
  run('move r 1 2');
  assert.throws(() => session.save(path.join(directory, 'missing', 'copy.svg')));
  assert.equal(session.save(), `saved to ${source} (1 elements)`);
  assert.ok(readFileSync(source, 'utf8').includes('x="12" y="24"'));
  assert.equal(readFileSync(copy, 'utf8'), copied);
});

test('失败 init 保留读入路径和历史，成功 init 清除读入路径', t => {
  const source = path.join(temporaryDirectory(t), 'source.svg');
  writeFileSync(source, svg(rectangle));
  const { session, run } = editor();
  session.read(source);
  run('move r 10 20');
  run('undo');
  const original = session.document;
  assert.throws(() => run('init 0 100'));
  assert.equal(session.document, original);
  run('redo');
  assert.equal(session.save(), `saved to ${source} (1 elements)`);
  const saved = readFileSync(source, 'utf8');
  run('init 100 200');
  assert.throws(() => run('save'), { message: 'no source file. use save <file.svg>' });
  assert.equal(readFileSync(source, 'utf8'), saved);
});

test('canvas、编辑与 undo/redo 保留读入路径，后续再次 read 才切换默认目标', t => {
  const directory = temporaryDirectory(t);
  const first = path.join(directory, 'first.svg');
  const second = path.join(directory, 'second.svg');
  writeFileSync(first, svg(rectangle));
  writeFileSync(second, svg('<circle id="c" cx="1" cy="2" r="3"/>'));
  const { session, run } = editor();
  session.read(first);
  run('canvas 200 100');
  run('move r 1 2'); run('undo'); run('redo');
  assert.equal(session.save(), `saved to ${first} (1 elements)`);
  const savedFirst = readFileSync(first, 'utf8');
  assert.ok(savedFirst.includes('viewBox="0 0 200 100"'));
  session.read(second);
  run('move c 10 20'); run('undo'); run('redo');
  assert.equal(session.save(), `saved to ${second} (1 elements)`);
  assert.equal(readFileSync(first, 'utf8'), savedFirst);
  assert.ok(readFileSync(second, 'utf8').includes('cx="11" cy="22"'));
});

test('同一 SvgReader 重复读取与失败后重试不残留 ID 或补号警告', () => {
  const reader = new SvgReader();
  const anonymous = svg('<rect x="0" y="0" width="1" height="1"/>');
  const first = reader.read(anonymous, 'first.svg');
  assert.equal(first.describe('first.svg'), 'warning: assigned id rect1 to unnamed <rect>\nread first.svg (1 elements)');
  assert.throws(() => reader.read(svg('<rect x="0" y="0" width="1" height="1"/><g transform="scale(2)"/>'), 'bad.svg'));
  const second = reader.read(anonymous, 'second.svg');
  assert.equal(second.describe('second.svg'), 'warning: assigned id rect1 to unnamed <rect>\nread second.svg (1 elements)');
  const explicit = reader.read(svg(rectangle), 'explicit.svg');
  assert.equal(explicit.describe('explicit.svg'), 'read explicit.svg (1 elements)');
  assert.equal(first.document.tree(), second.document.tree());
});

test('真实 CLI 读入相对中文空格路径、补 ID、历史阻断及无参保存回原文件', t => {
  const directory = temporaryDirectory(t);
  const name = '课程 图形.svg';
  const source = path.join(directory, name);
  writeFileSync(source, svg('<g id="scene"><rect x="1" y="2" width="3" height="4"/><text id="t" x="5" y="6">开始 &amp; 结束</text></g>'));
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    cwd: directory, encoding: 'utf8', timeout: 10000,
    input: [`read "${name}"`, 'undo', 'move scene 10 20', 'save "副本.svg"',
      'move scene 1 2', 'save', 'tree'].join('\n'),
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.replace(/\r\n/g, '\n'), 'error: undo not allowed after io command\n');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.ok(output.includes('warning: assigned id rect1 to unnamed <rect>\nread 课程 图形.svg (3 elements)\n'));
  assert.ok(output.includes(`saved to ${source} (3 elements)\n`));
  assert.ok(output.endsWith('svg (400x300)\n└── g#scene\n    ├── rect#rect1 x=12 y=24 w=3 h=4\n    └── text#t (16,28) "开始 & 结束"\n'));
  assert.ok(readFileSync(source, 'utf8').includes('x="12" y="24"'));
  assert.ok(readFileSync(path.join(directory, '副本.svg'), 'utf8').includes('x="11" y="22"'));
  assert.deepEqual(readdirSync(directory).sort(), [name, '副本.svg'].sort());
});

test('真实 CLI 失败导入不输出半程补 ID 警告，仍能重做并保存到原读入路径', t => {
  const directory = temporaryDirectory(t);
  const source = path.join(directory, 'good.svg');
  writeFileSync(source, svg(rectangle));
  writeFileSync(path.join(directory, 'bad.svg'), svg('<rect x="0" y="0" width="1" height="1"/><g id="bad" transform="scale(2)"/>'));
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    cwd: directory, encoding: 'utf8', timeout: 10000,
    input: ['read good.svg', 'move r 10 20', 'undo', 'read bad.svg', 'redo', 'save', 'tree'].join('\n'),
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  const errors = result.stderr.trim().split(/\r?\n/);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].startsWith('error: '));
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.ok(!output.includes('warning:'));
  assert.ok(!output.includes('read bad.svg'));
  assert.ok(output.includes('redone: '));
  assert.ok(output.includes(`saved to ${source} (1 elements)`));
  assert.ok(output.endsWith('svg (400x300)\n└── rect#r x=11 y=22 w=3 h=4\n'));
});
