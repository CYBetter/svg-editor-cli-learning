import { CircleShape } from './CircleShape';
import { EllipseShape } from './EllipseShape';
import { GroupShape } from './GroupShape';
import { LineShape } from './LineShape';
import { Numeric } from './Numeric';
import { RectShape } from './RectShape';
import { Shape } from './Shape';
import { TextShape } from './TextShape';

export class ShapeFactory {
  create(type: string, id: string, params: readonly string[]): Shape {
    // 唯一图形名称分派入口；待重构：后续改为类型注册。
    if (type === 'g') {
      if (params.length !== 0) throw new Error('usage: create g <id>');
      return new GroupShape(id);
    }
    if (type === 'rect') {
      if (params.length < 4 || params.length > 5) {
        throw new Error('usage: create rect <id> <x> <y> <w> <h> [fill]');
      }
      return new RectShape(id,
        Numeric.parse(params[0], 'x'), Numeric.parse(params[1], 'y'),
        Numeric.parse(params[2], 'width'), Numeric.parse(params[3], 'height'),
        params[4]);
    }
    if (type === 'circle') {
      if (params.length < 3 || params.length > 4) {
        throw new Error('usage: create circle <id> <cx> <cy> <r> [fill]');
      }
      return new CircleShape(id,
        Numeric.parse(params[0], 'cx'), Numeric.parse(params[1], 'cy'),
        Numeric.parse(params[2], 'r'), params[3]);
    }
    if (type === 'ellipse') {
      if (params.length < 4 || params.length > 5) {
        throw new Error('usage: create ellipse <id> <cx> <cy> <rx> <ry> [fill]');
      }
      return new EllipseShape(id,
        Numeric.parse(params[0], 'cx'), Numeric.parse(params[1], 'cy'),
        Numeric.parse(params[2], 'rx'), Numeric.parse(params[3], 'ry'), params[4]);
    }
    if (type === 'line') {
      if (params.length < 4 || params.length > 5) {
        throw new Error('usage: create line <id> <x1> <y1> <x2> <y2> [stroke]');
      }
      return new LineShape(id,
        Numeric.parse(params[0], 'x1'), Numeric.parse(params[1], 'y1'),
        Numeric.parse(params[2], 'x2'), Numeric.parse(params[3], 'y2'), params[4]);
    }
    if (type === 'text') {
      if (params.length !== 3) {
        throw new Error('usage: create text <id> <x> <y> "content"');
      }
      return new TextShape(id,
        Numeric.parse(params[0], 'x'), Numeric.parse(params[1], 'y'), params[2]);
    }
    throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
  }
}
