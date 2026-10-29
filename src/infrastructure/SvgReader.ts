import { SaxesParser } from 'saxes';
import { LoadedDocument } from '../application/LoadedDocument';
import { Numeric } from '../domain/Numeric';
import { ShapeFactory } from '../domain/ShapeFactory';
import { SvgDocument } from '../domain/SvgDocument';
import { XmlElement } from './XmlElement';

export class SvgReader {
  read(source: string, sourcePath: string): LoadedDocument {
    const root = this.parse(source);
    const document = this.createDocument(root);
    const elements = [...root.walk()].slice(1);
    const occupied = new Set<string>();

    // 先检查所有显式 ID；后面的 rect1 也不能被前面的无名 rect 抢占。
    for (const element of elements) {
      if (element.namespace !== root.namespace) {
        throw new Error(`invalid SVG: unsupported namespace in <${element.name}>`);
      }
      const id = element.getAttribute('id');
      if (id === undefined || id === '') continue;
      if (occupied.has(id)) throw new Error(`id already exists: ${id}`);
      occupied.add(id);
    }

    const ids = new Map<XmlElement, string>();
    const counters = new Map<string, number>();
    const warnings: string[] = [];
    for (const element of elements) {
      let id = element.getAttribute('id');
      if (id === undefined || id === '') {
        let number = counters.get(element.name) ?? 1;
        while (occupied.has(`${element.name}${number}`)) number++;
        id = `${element.name}${number}`;
        occupied.add(id);
        counters.set(element.name, number + 1);
        warnings.push(`warning: assigned id ${id} to unnamed <${element.name}>`);
      }
      ids.set(element, id);
    }

    const factory = new ShapeFactory();
    const pending: { element: XmlElement; parentId?: string }[] = root.getChildren()
      .map(element => ({ element })).reverse();
    while (pending.length > 0) {
      const { element, parentId } = pending.pop()!;
      const id = ids.get(element)!;
      const shape = factory.createFromSvg(element.name, id, element.getAttributes(), element.textContent);
      const children = element.getChildren();
      if (!shape.isContainer && children.length > 0) {
        throw new Error(`invalid SVG: child elements are not allowed in <${element.name}>`);
      }
      document.add(shape, parentId);
      for (let index = children.length - 1; index >= 0; index--) {
        pending.push({ element: children[index], parentId: id });
      }
    }
    // 此前没有修改会话，也没有打印警告；全部成功才交付完整结果。
    return new LoadedDocument(document, sourcePath, warnings);
  }

  private parse(source: string): XmlElement {
    const parser = new SaxesParser({ xmlns: true, defaultXMLVersion: '1.0', forceXMLVersion: true });
    const stack: XmlElement[] = [];
    let root: XmlElement | undefined;
    parser.on('error', error => { throw error; });
    parser.on('doctype', () => { throw new Error('DOCTYPE is not supported'); });
    parser.on('processinginstruction', () => { throw new Error('processing instructions are not supported'); });
    parser.on('xmldecl', declaration => {
      if (declaration.version !== '1.0') throw new Error('only XML 1.0 is supported');
      if (declaration.encoding !== undefined && !/^utf-?8$/i.test(declaration.encoding)) {
        throw new Error('only UTF-8 encoding is supported');
      }
    });
    parser.on('opentag', tag => {
      const attributes = new Map<string, string>();
      for (const attribute of Object.values(tag.attributes)) {
        if (attribute.uri === 'http://www.w3.org/2000/xmlns/') continue;
        if (attribute.uri !== '' || attribute.prefix !== '') {
          throw new Error(`unsupported namespaced attribute: ${attribute.name}`);
        }
        attributes.set(attribute.name, attribute.value);
      }
      const element = new XmlElement(tag.local, tag.uri, attributes);
      if (stack.length > 0) stack[stack.length - 1].appendChild(element);
      else {
        if (root) throw new Error('multiple root elements');
        root = element;
      }
      stack.push(element);
    });
    parser.on('closetag', () => { stack.pop(); });
    parser.on('text', text => { stack.at(-1)?.appendText(text); });
    parser.on('cdata', text => { stack.at(-1)?.appendText(text); });
    try {
      parser.write(source).close();
      if (!root) throw new Error('missing root element');
      return root;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`invalid SVG: ${message}`);
    }
  }

  private createDocument(root: XmlElement): SvgDocument {
    if (root.name !== 'svg') throw new Error('invalid SVG: root element must be <svg>');
    if (root.namespace !== '' && root.namespace !== 'http://www.w3.org/2000/svg') {
      throw new Error('invalid SVG: unsupported namespace in <svg>');
    }
    for (const name of root.getAttributes().keys()) {
      if (name !== 'width' && name !== 'height' && name !== 'viewBox') {
        throw new Error(`invalid SVG: unsupported attribute on <svg>: ${name}`);
      }
    }
    if (!/^[ \t\r\n]*$/.test(root.textContent)) {
      throw new Error('invalid SVG: unexpected text in <svg>');
    }
    const width = this.dimension(root, 'width');
    const height = this.dimension(root, 'height');
    const viewBox = root.getAttribute('viewBox');
    if (viewBox !== undefined) {
      const values = this.trimXmlSpace(viewBox).split(/(?:[ \t\r\n]*,[ \t\r\n]*|[ \t\r\n]+)/);
      if (values.length !== 4 || values.some(value => value.length === 0)) {
        throw new Error('invalid SVG: viewBox must match 0 0 width height');
      }
      const numbers = values.map(value => Numeric.parse(value, 'viewBox value'));
      if (numbers[0] !== 0 || numbers[1] !== 0 || numbers[2] !== width || numbers[3] !== height) {
        throw new Error('invalid SVG: viewBox must match 0 0 width height');
      }
    }
    return new SvgDocument(width, height);
  }

  private dimension(root: XmlElement, name: string): number {
    const value = root.getAttribute(name);
    if (value === undefined) throw new Error(`invalid SVG: missing root attribute: ${name}`);
    return Numeric.positive(Numeric.parse(this.trimXmlSpace(value), `canvas ${name}`), `canvas ${name}`);
  }

  private trimXmlSpace(value: string): string { return value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, ''); }
}
