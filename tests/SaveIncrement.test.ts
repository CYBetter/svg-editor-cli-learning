import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test, { TestContext } from 'node:test';
import { DocumentSaver } from '../src/application/DocumentSaver';
import { EditorSession } from '../src/application/EditorSession';
import { CommandDispatcher } from '../src/cli/CommandDispatcher';
import { SvgFileStore } from '../src/infrastructure/SvgFileStore';
import { SvgWriter } from '../src/infrastructure/SvgWriter';

function editor(saver: DocumentSaver = new SvgFileStore()): {
  session: EditorSession; run: (line: string) => string | undefined;
} {
  const session = new EditorSession(saver);
  const dispatcher = new CommandDispatcher();
  return { session, run: line => dispatcher.parse(line)?.execute(session) };
}

function temporaryDirectory(t: TestContext): string {
  // 编译后位于 dist/tests；使用工程根避免受限系统临时目录禁止 rename。
  const root = path.resolve(__dirname, '../..');
  const directory = mkdtempSync(path.join(root, 'svg-learning-save-'));
  t.after(() => {
    // 仅删除本测试在临时根下独占创建的目录，不能扩大到父目录。
    assert.equal(path.dirname(path.resolve(directory)), root);
    assert.ok(path.basename(directory).startsWith('svg-learning-save-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test('SVG 输出六类图形、嵌套与当前绘制顺序，包含编辑后的几何和显式样式', () => {
  const { session, run } = editor();
  for (const command of ['init 400 300', 'create g scene', 'set scene fill blue',
    'create rect r 1 2 3 4 red in scene', 'create g inner in scene',
    'create circle c 5 6 7 in inner', 'create ellipse e 8 9 10 11 in scene',
    'create line l 12 13 14 15 black in scene', 'set l stroke-width 2.5',
    'create text t 16 17 "开始" in scene', 'move scene 10 20', 'scale scene 2', 'front r']) run(command);
  const xml = session.document.writeTo(new SvgWriter());
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
  assert.ok(xml.includes('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">'));
  assert.ok(xml.includes('<g id="scene" fill="blue">'));
  assert.ok(xml.includes('<g id="inner">\n      <circle id="c" cx="30" cy="52" r="14"/>\n    </g>'));
  assert.ok(xml.includes('<ellipse id="e" cx="36" cy="58" rx="20" ry="22"/>'));
  assert.ok(xml.includes('<line id="l" x1="44" y1="66" x2="48" y2="70" stroke="black" stroke-width="2.5"/>'));
  assert.ok(xml.includes('<text id="t" x="52" y="74">开始</text>'));
  assert.ok(xml.includes('<rect id="r" x="22" y="44" width="6" height="8" fill="red"/>'));
  const order = ['inner', 'c', 'e', 'l', 't', 'r'].map(id => xml.indexOf(`id="${id}"`));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(session.document.elementCount, 7);
  assert.ok(!xml.includes('transform='));
  assert.ok(!xml.includes(' text='));
});

test('空画布、空组与空文本可输出，未指定样式省略而显式空样式保留', () => {
  const { session, run } = editor();
  run('init 12.5 20.25');
  const empty = session.document.writeTo(new SvgWriter());
  assert.ok(empty.includes('width="12.5" height="20.25" viewBox="0 0 12.5 20.25"'));
  assert.equal(session.document.elementCount, 0);
  run('create g empty');
  run('create text t 0 0 ""');
  run('set t fill ""');
  run('create rect r 0 0 0 0');
  const xml = session.document.writeTo(new SvgWriter());
  assert.ok(xml.includes('<g id="empty"/>'));
  assert.ok(xml.includes('<text id="t" x="0" y="0" fill=""></text>'));
  assert.ok(xml.includes('<rect id="r" x="0" y="0" width="0" height="0"/>'));
  assert.ok(!xml.includes('stroke='));
  assert.ok(!xml.includes('fill="black"'));
});

test('属性与文本正确转义 XML，保留中文、表情、引号及制表回车换行', () => {
  const { session, run } = editor();
  run('init');
  run('create g scene');
  run('create text t 1 2 "placeholder" in scene');
  session.edit(document => {
    document.find('t').setAttribute('text', '中文😀 & <tag> "quoted" \'single\'\t\r\n尾');
    document.find('t').setAttribute('fill', 'a&<b>"\t\r\n');
    return 'special content';
  });
  const xml = session.document.writeTo(new SvgWriter());
  assert.ok(xml.includes('fill="a&amp;&lt;b&gt;&quot;&#9;&#13;&#10;"'));
  assert.ok(xml.includes('>中文😀 &amp; &lt;tag&gt; "quoted" \'single\'&#9;&#13;&#10;尾</text>'));
  assert.ok(!xml.includes('<tag>'));
  assert.ok(!xml.includes('&amp;amp;'));
  assert.ok(!xml.includes('�'));
});

test('非法 XML 字符拒绝保存，不覆盖旧文件、不改变文档和撤销重做记录', t => {
  const directory = temporaryDirectory(t);
  const target = path.join(directory, 'existing.svg');
  for (const invalid of ['\u0000', '\u0001', '\ud800', '\udfff', '\ufffe', '\uffff']) {
    writeFileSync(target, 'previous document', 'utf8');
    const { session, run } = editor();
    run('init');
    run('create text t 1 2 "valid"');
    session.edit(document => {
      document.find('t').setAttribute('text', `before${invalid}after`);
      return 'invalid XML content';
    });
    run('move t 10 20');
    run('undo');
    const original = session.document;
    const before = run('tree');
    assert.throws(() => session.save(target), { message: 'invalid XML character' });
    assert.equal(readFileSync(target, 'utf8'), 'previous document');
    assert.deepEqual(readdirSync(directory), ['existing.svg']);
    assert.equal(session.document, original);
    assert.equal(run('tree'), before);
    run('redo');
    assert.ok(run('tree t')?.includes('(11,22)'));
    run('undo');
    run('undo');
    assert.equal(run('tree t'), 'text#t (1,2) "valid"');
  }
});

test('单独生成 SVG 是只读行为，不替换文档、不消耗历史或清除 redo', () => {
  const { session, run } = editor();
  run('init');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  run('undo');
  const original = session.document;
  const before = run('tree');
  const first = original.writeTo(new SvgWriter());
  assert.equal(original.writeTo(new SvgWriter()), first);
  assert.equal(session.document, original);
  assert.equal(run('tree'), before);
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
  run('undo');
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)');
});

test('成功保存保留当前模型实例，清空两栈并阻断历史，新编辑只撤回保存基线', t => {
  const target = path.join(temporaryDirectory(t), 'baseline.svg');
  const { session, run } = editor();
  run('init');
  run('create g scene');
  run('create rect r 1 2 3 4 in scene');
  run('move r 10 20');
  run('undo');
  const original = session.document;
  const baseline = run('tree');
  assert.equal(session.save(target), `saved to ${target} (2 elements)`);
  assert.equal(session.document, original);
  assert.equal(run('tree'), baseline);
  assert.ok(readFileSync(target, 'utf8').includes('x="1" y="2"'));
  for (const command of ['undo', 'redo']) {
    assert.throws(() => run(command), { message: 'undo not allowed after io command' });
  }
  run('canvas');
  run('help');
  assert.throws(() => run('move missing 1 1'));
  assert.throws(() => run('undo'), { message: 'undo not allowed after io command' });
  run('move r 5 0');
  run('undo');
  assert.equal(run('tree'), baseline);
  assert.throws(() => run('undo'), { message: 'nothing to undo' });
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=6 y=2 w=3 h=4');
});

test('save 检查初始化和参数数量，显式保存不会把另存路径变成读入默认路径', t => {
  const target = path.join(temporaryDirectory(t), 'explicit.svg');
  const { session, run } = editor();
  for (const command of ['save', 'save output.svg']) {
    assert.throws(() => run(command), { message: "no document. use 'init' or 'read' first" });
  }
  run('init');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  run('undo');
  const original = session.document;
  assert.throws(() => run('save'), { message: 'no source file. use save <file.svg>' });
  assert.throws(() => run('save a.svg b.svg'), { message: 'usage: save [file.svg]' });
  assert.equal(session.document, original);
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
  session.save(target);
  run('move r 1 1');
  run('undo');
  assert.throws(() => run('save'), { message: 'no source file. use save <file.svg>' });
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=12 y=23 w=3 h=4');
});

test('空路径、目录目标和不存在的父目录均使用文件错误，保留文档与两栈', t => {
  const directory = temporaryDirectory(t);
  const { session, run } = editor();
  run('init');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  run('undo');
  const original = session.document;
  for (const target of ['', directory, path.join(directory, 'missing', 'out.svg')]) {
    assert.throws(() => session.save(target), { message: `cannot write file: ${target}` });
    assert.equal(session.document, original);
    assert.equal(run('tree r'), 'rect#r x=1 y=2 w=3 h=4');
    assert.deepEqual(readdirSync(directory), []);
  }
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
  run('undo');
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)');
});

test('临时文件部分写入后异常，不截断旧文件，清理临时文件并保留两栈', t => {
  const directory = temporaryDirectory(t);
  const target = path.join(directory, 'old.svg');
  writeFileSync(target, 'old valid document', 'utf8');
  const saver = new class extends SvgFileStore {
    protected override writeTemporary(descriptor: number, content: string): void {
      writeFileSync(descriptor, content.slice(0, 20), 'utf8');
      throw new Error('simulated partial write');
    }
  }();
  const { session, run } = editor(saver);
  run('init');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  run('undo');
  const original = session.document;
  assert.throws(() => session.save(target), { message: `cannot write file: ${target}` });
  assert.equal(session.document, original);
  assert.equal(readFileSync(target, 'utf8'), 'old valid document');
  assert.deepEqual(readdirSync(directory), ['old.svg']);
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
  run('undo');
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)');
});

test('临时文件写完但替换失败，旧文件和历史仍保留，临时文件被清理', t => {
  const directory = temporaryDirectory(t);
  const target = path.join(directory, 'old.svg');
  writeFileSync(target, 'old valid document', 'utf8');
  let sawCompleteFile = false;
  const saver = new class extends SvgFileStore {
    protected override replaceTemporary(temporary: string, destination: string): void {
      assert.equal(destination, target);
      assert.ok(readFileSync(temporary, 'utf8').endsWith('</svg>\n'));
      assert.equal(readFileSync(destination, 'utf8'), 'old valid document');
      sawCompleteFile = true;
      throw new Error('simulated replacement failure');
    }
  }();
  const { session, run } = editor(saver);
  run('init');
  run('create rect r 1 2 3 4');
  run('move r 10 20');
  run('undo');
  const original = session.document;
  assert.throws(() => session.save(target), { message: `cannot write file: ${target}` });
  assert.equal(sawCompleteFile, true);
  assert.equal(session.document, original);
  assert.equal(readFileSync(target, 'utf8'), 'old valid document');
  assert.deepEqual(readdirSync(directory), ['old.svg']);
  run('redo');
  assert.equal(run('tree r'), 'rect#r x=11 y=22 w=3 h=4');
  run('undo');
  run('undo');
  assert.equal(run('tree'), 'svg (800x600)');
});

test('真实保存支持中文空格路径及覆盖，输出当前状态而不是上次快照', t => {
  const directory = temporaryDirectory(t);
  const target = path.join(directory, '课程 图形.svg');
  const { session, run } = editor();
  run('init 400 300');
  run('create text title 10 20 "中文图形 😀"');
  run('create rect obsolete 0 0 2 3');
  assert.equal(run(`save "${target}"`), `saved to ${target} (2 elements)`);
  const first = readFileSync(target, 'utf8');
  assert.ok(first.includes('中文图形 😀'));
  run('delete obsolete');
  run('move title 10 5');
  run('canvas 500 200');
  session.save(target);
  const second = readFileSync(target, 'utf8');
  assert.notEqual(second, first);
  assert.ok(second.includes('width="500" height="200" viewBox="0 0 500 200"'));
  assert.ok(second.includes('<text id="title" x="20" y="25">中文图形 😀</text>'));
  assert.ok(!second.includes('obsolete'));
  assert.deepEqual(readdirSync(directory), ['课程 图形.svg']);
});

test('真实 CLI 回放相对中文空格路径、保存边界、失败后 redo 与再次覆盖', t => {
  const directory = temporaryDirectory(t);
  const input = [
    'init 400 200', 'create g node', 'create rect box 10 20 100 50 red in node',
    'create text title 20 45 "开始 & <结束>" in node', 'save "流程 图.svg"', 'undo',
    'move node 30 10', 'undo', 'save "missing/out.svg"', 'redo', 'save "流程 图.svg"',
    'tree',
  ].join('\n');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/Main.js')], {
    cwd: directory, input, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.replace(/\r\n/g, '\n'),
    'error: undo not allowed after io command\nerror: cannot write file: missing/out.svg\n');
  const output = result.stdout.replace(/\r\n/g, '\n');
  assert.equal(output.split('saved to 流程 图.svg (3 elements)').length - 1, 2);
  assert.ok(output.includes('redone: '));
  assert.ok(output.endsWith('svg (400x200)\n└── g#node\n    ├── rect#box x=40 y=30 w=100 h=50 fill=red\n    └── text#title (50,55) "开始 & <结束>"\n'));
  const xml = readFileSync(path.join(directory, '流程 图.svg'), 'utf8');
  assert.ok(xml.includes('<rect id="box" x="40" y="30" width="100" height="50" fill="red"/>'));
  assert.ok(xml.includes('<text id="title" x="50" y="55">开始 &amp; &lt;结束&gt;</text>'));
  assert.deepEqual(readdirSync(directory), ['流程 图.svg']);
});
