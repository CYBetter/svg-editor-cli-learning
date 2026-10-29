import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class HelpCommand extends Command {
  constructor(args: readonly string[]) {
    super();
    HelpCommand.checkArguments(args, 0, 0, 'help');
  }

  override execute(session: EditorSession): string {
    // 按课设通用约定，先 init/read，再执行其他命令。
    void session.document;
    return [
      'SVG CLI 命令帮助',
      '文档：',
      '  init [w] [h]                   新建画布；默认 800x600',
      '  canvas [w] [h]                 无参查询；单参改宽保留高；双参改宽高',
      '  save [file.svg]                保存 SVG；init 后须给路径；read 接入后无参保存到读入路径',
      '创建（in 可省略，省略时位于画布根）：',
      '  create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]',
      '  create circle <id> <cx> <cy> <r> [fill] [in <containerId>]',
      '  create ellipse <id> <cx> <cy> <rx> <ry> [fill] [in <containerId>]',
      '  create line <id> <x1> <y1> <x2> <y2> [stroke] [in <containerId>]',
      '  create text <id> <x> <y> "content" [in <containerId>]',
      '  create g <id> [in <containerId>]',
      '编辑（每条成功命令为一个撤销单元）：',
      '  delete <id>                    删除图形或整棵子树',
      '  move <id> <dx> <dy>             增量平移',
      '  scale <id> <factor>             正因子同时缩放位置与尺寸',
      '  set <id> <attr> <value>         修改白名单属性；文字内容用 text',
      '  group <newGid> <id1> <id2>...    按原树顺序分组，放在最近共同父容器',
      '  addto <gid> <id>                移到目标容器的末尾',
      '  ungroup <gid>                   孩子原位提升；禁止解散根级容器',
      '  front <id>                     移到同级列表末尾，显示在上层',
      '  back <id>                      移到同级列表开头，显示在下层',
      '查询（不改变历史）：',
      '  tree [id]                      显示全文档或指定子树',
      '  show <id>                      显示直接父级和显式属性',
      '  help                           显示本帮助',
      '历史：',
      '  undo                           撤销上一次编辑',
      '  redo                           重做；撤销后新编辑清空重做记录',
      '规则：先 init 再使用其他命令；带空格参数用双引号；# 开头整行是注释。',
      '成功 init、save 或 canvas 修改会清空并禁用历史，直到下一次成功编辑。',
      '后续增量（当前尚未实现）：',
      '  read <file.svg>                读取 SVG',
    ].join('\n');
  }
}
