// 输入的只读元数据，不是承担图形行为的模型。
export interface CommandToken {
  readonly value: string;
  readonly quoted: boolean;
}
