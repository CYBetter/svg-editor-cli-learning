import { randomUUID } from 'node:crypto';
import { closeSync, lstatSync, openSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DocumentSaver } from '../application/DocumentSaver';
import { SvgDocument } from '../domain/SvgDocument';
import { SvgWriter } from './SvgWriter';

export class SvgFileStore extends DocumentSaver {
  override save(document: SvgDocument, filePath: string): void {
    // 文本转换失败时还没有访问目标文件；错误原因交给 CLI 显示。
    const content = document.writeTo(new SvgWriter());
    let temporary: string | undefined;
    try {
      if (filePath.length === 0) throw new Error('empty path');
      const target = path.resolve(filePath);
      try {
        // 只替换普通文件，不跟随符号链接，也不把目录当成输出文件。
        if (!lstatSync(target).isFile()) throw new Error('not a regular file');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const candidate = path.join(path.dirname(target), `.svg-editor-${randomUUID()}.tmp`);
      const descriptor = openSync(candidate, 'wx');
      // 只有独占创建成功后才取得清理权，不能误删同名已有文件。
      temporary = candidate;
      try { this.writeTemporary(descriptor, content); }
      finally { closeSync(descriptor); }
      this.replaceTemporary(temporary, target);
      // 替换成功即完成，不在此之后执行可能失败的文件步骤。
      temporary = undefined;
    } catch {
      throw new Error(`cannot write file: ${filePath}`);
    } finally {
      // 仅尝试删除本次分配的临时文件；失败不掩盖原始保存错误。
      if (temporary) { try { unlinkSync(temporary); } catch { /* best effort */ } }
    }
  }

  protected writeTemporary(descriptor: number, content: string): void {
    writeFileSync(descriptor, content, { encoding: 'utf8' });
  }

  protected replaceTemporary(temporary: string, target: string): void {
    renameSync(temporary, target);
  }
}
