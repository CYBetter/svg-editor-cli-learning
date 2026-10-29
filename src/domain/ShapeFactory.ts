import { CircleShape } from './CircleShape';
import { Numeric } from './Numeric';
import { RectShape } from './RectShape';
import { Shape } from './Shape';

export class ShapeFactory {
  create(type: string, id: string, params: readonly string[]): Shape {
    // 唯一图形名称分派入口；待重构：后续改为类型注册。
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
    throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
  }
}
