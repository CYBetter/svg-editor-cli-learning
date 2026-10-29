import { SvgDocument } from '../domain/SvgDocument';

/** 保存端口：返回表示文件已保存，抛错表示会话必须保留历史。 */
export abstract class DocumentSaver {
  abstract save(document: SvgDocument, filePath: string): void;
}
