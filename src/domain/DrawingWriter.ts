/** 输出契约：模型提供自己的数据与结构，不依赖 XML 或文件系统。 */
export interface DrawingWriter {
  canvas(width: number, height: number, children: readonly string[]): string;
  element(
    name: string,
    attributes: Readonly<Record<string, number | string>>,
    children: readonly string[],
    text?: string,
  ): string;
}
