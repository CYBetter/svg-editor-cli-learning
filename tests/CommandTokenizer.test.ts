import assert from 'node:assert/strict';
import test from 'node:test';
import { CommandTokenizer } from '../src/cli/CommandTokenizer';

test('引号包裹保留空格、空参数与转义引号', () => {
  const tokenizer = new CommandTokenizer();
  assert.deepEqual(tokenizer.tokenize('" a b " "" "中文"'), [' a b ', '', '中文']);
  assert.deepEqual(tokenizer.tokenize(String.raw`"他说：\"开始\""`), ['他说："开始"']);
});

test('普通反斜杠和 UNC 文本原样保留，引号前偶数个反斜杠允许关闭参数', () => {
  const tokenizer = new CommandTokenizer();
  assert.deepEqual(tokenizer.tokenize(String.raw`"C:\new\test" "\\server\share"`), [String.raw`C:\new\test`, String.raw`\\server\share`]);
  const slash = '\\';
  const quotedTrailingSlash = '"C:' + slash + 'folder' + slash.repeat(2) + '" next';
  assert.deepEqual(tokenizer.tokenize(quotedTrailingSlash), ['C:' + slash + 'folder' + slash, 'next']);
  const literalSlashAndQuote = '"a' + slash.repeat(3) + '"b"';
  assert.deepEqual(tokenizer.tokenize(literalSlashAndQuote), ['a' + slash + '"b']);
});

test('转义引号不关闭参数，未闭合时必须报错', () => {
  const tokenizer = new CommandTokenizer();
  assert.throws(() => tokenizer.tokenize('"abc' + '\\' + '"'), { message: 'unclosed double quote' });
  assert.deepEqual(tokenizer.tokenize('  # comment'), []);
  assert.deepEqual(tokenizer.tokenize('"# content" #ffffff'), ['# content', '#ffffff']);
});
