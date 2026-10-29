import { DrawingWriter } from '../domain/DrawingWriter';

export class SvgWriter implements DrawingWriter {
  canvas(width: number, height: number, children: readonly string[]): string {
    const root = this.element('svg', {
      xmlns: 'http://www.w3.org/2000/svg', width, height, viewBox: `0 0 ${width} ${height}`,
    }, children);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${root}\n`;
  }

  element(
    name: string,
    attributes: Readonly<Record<string, number | string>>,
    children: readonly string[],
    text?: string,
  ): string {
    this.checkName(name);
    const fields = Object.entries(attributes).map(([key, value]) => {
      this.checkName(key);
      return ` ${key}="${this.escape(String(value), true)}"`;
    }).join('');
    const opening = `<${name}${fields}`;
    // 空字符串也是文字内容，不能因为它为空而跳过或添加排版空白。
    if (text !== undefined) {
      if (children.length > 0) throw new Error('mixed drawing content is not supported');
      return `${opening}>${this.escape(text, false)}</${name}>`;
    }
    if (children.length === 0) return `${opening}/>`;
    const nested = children.map(child => child.split('\n').map(line => `  ${line}`).join('\n')).join('\n');
    return `${opening}>\n${nested}\n</${name}>`;
  }

  private checkName(name: string): void {
    // 这里校验 XML 名称的本项目子集，不把名称分派到具体图形实现。
    if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(name)) throw new Error('invalid XML name');
  }

  private escape(value: string, attribute: boolean): string {
    for (const character of value) {
      const code = character.codePointAt(0)!;
      const valid = code === 0x9 || code === 0xa || code === 0xd
        || (code >= 0x20 && code <= 0xd7ff)
        || (code >= 0xe000 && code <= 0xfffd)
        || (code >= 0x10000 && code <= 0x10ffff);
      if (!valid) throw new Error('invalid XML character');
    }
    return value.replace(/[&<>"\t\r\n]/g, character => {
      if (character === '&') return '&amp;';
      if (character === '<') return '&lt;';
      if (character === '>') return '&gt;';
      if (character === '"') return attribute ? '&quot;' : '"';
      // 属性空白避免 XML 规范化；文本空白避免父容器缩进改变原内容。
      return `&#${character.charCodeAt(0)};`;
    });
  }
}
