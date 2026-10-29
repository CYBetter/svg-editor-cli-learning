export class CommandTokenizer {
  tokenize(line: string): string[] {
    if (line.trimStart().startsWith('#')) return [];
    const tokens: string[] = [];
    let value = '';
    let quoted = false;
    let started = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      if (character === '\\') {
        let end = index;
        while (line[end] === '\\') end++;
        const count = end - index;
        if (line[end] === '"') {
          // 只在引号前解释转义，其余反斜杠原样保留。
          value += '\\'.repeat(Math.floor(count / 2));
          if (count % 2 === 1) value += '"';
          else quoted = !quoted;
          index = end;
        } else {
          value += '\\'.repeat(count);
          index = end - 1;
        }
        started = true;
      } else if (character === '"') {
        quoted = !quoted;
        started = true;
      } else if (/\s/.test(character) && !quoted) {
        if (started) tokens.push(value);
        value = '';
        started = false;
      } else {
        value += character;
        started = true;
      }
    }
    if (quoted) throw new Error('unclosed double quote');
    if (started) tokens.push(value);
    return tokens;
  }
}
