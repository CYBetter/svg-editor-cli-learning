export class CommandTokenizer {
  tokenize(line: string): string[] {
    if (line.trimStart().startsWith('#')) return [];
    const tokens: string[] = [];
    let value = '';
    let quoted = false;
    let started = false;
    for (const character of line) {
      if (character === '"') {
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
