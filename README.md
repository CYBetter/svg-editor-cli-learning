# SVG CLI：分步协作学习版

这是一个独立的新仓库，用于重新开展真实的、适中粒度的 AI 辅助编程过程。
旧工程是参考版本；本仓库不会把旧工程的完成记录当作用户参与的学习过程。

## 当前增量

第一轮实现最小矩形编辑流程；第二轮增加圆形；第三轮增加椭圆、线段和文字；第四轮加入 g 容器；第五轮加入 scale、set、show；第六轮加入 delete、front、back；第七轮加入 group、addto、ungroup。
当前支持六种类型的创建、整棵子树的移动/缩放/删除、同级重排、分组与迁移、属性修改和查询、输入校验和失败时保持状态。
66 组自动测试通过。用户已选择分组位置约定，尚未反馈具体手动验收结果。
撤销重做、辅助命令与 SVG 读写留到后续增量。

## Git 迭代约定

每轮功能更新验证通过后，将代码、相关测试和真实过程记录一起提交，并推送到 origin/main。
每轮结束报告提交号与推送结果；网络失败时如实报告，未推送不表述为已同步。
既有提交保留，不把完成品重新拆分成虚构的开发历史。完整验收后才创建 final tag。
可用 `git log --oneline --decorate` 查看实际记录。

## 环境

Node.js 18.17 或更新版本，npm。

```powershell
npm ci
npm run cli
```

看到 `svg>` 后逐行输入：

```text
init 800 600
create rect r1 10 20 100 50
tree
move r1 30 10
tree
```

最后应看到 `rect#r1 x=40 y=30 w=100 h=50`。按 Ctrl+C 退出。
本轮数据只在内存中保存，重新启动会得到未初始化状态。

再输入两条错误命令，并用 tree 检查矩形保持不变：

```text
create rect r1 0 0 20 20
move missing 5 5
tree
```

自动验证与脚本回放：

```powershell
npm test
Get-Content examples/step-01.commands.txt | node dist/src/Main.js
```

回放末尾的两条 error 是预期的边界场景。

## 第二轮体验：矩形和圆形共用命令

在 CLI 中输入：

```text
init 800 600
create rect r1 10 20 100 50
create circle c1 100 100 20 red
move r1 30 10
move c1 30 10
tree
```

结果应为：

```text
svg (800x600)
├── rect#r1 x=40 y=30 w=100 h=50
└── circle#c1 cx=130 cy=110 r=20 fill=red
```

两者位置都加上相同偏移，矩形宽高和圆形半径保持不变。
再执行 `create circle r1 0 0 10`，会报 id 已存在：id 唯一性跨越图形类型。
本轮回放脚本为 `examples/step-02.commands.txt`，可按第一轮相同方式运行。

## 第三轮体验：不同几何结构，共用移动行为

```text
init 800 600
create ellipse e1 100 100 40 20 #88ccff
create line edge 10 20 100 20 black
create text title 20 40 "开始处理 My Diagram"
move e1 10 5
move edge 10 5
move title 10 5
tree
```

预期结果：

```text
svg (800x600)
├── ellipse#e1 cx=110 cy=105 rx=40 ry=20 fill=#88ccff
├── line#edge (20,25) -> (110,25) stroke=black
└── text#title (30,45) "开始处理 My Diagram"
```

椭圆的可选颜色是 fill，线段的是 stroke；省略时都保持未指定。
文字内容是独立字段，移动只改变位置。
脚本保存在 examples/step-03.commands.txt，自动测试通过 UTF-8 直接回放真实 CLI。
手动体验建议直接在 CLI 中输入；旧版 Windows PowerShell 管道默认编码可能损坏中文。

## 文字参数与引号

```text
create text quoted 0 0 "他说：\"开始\""
create text empty 0 20 ""
```

双引号包裹带空格参数是任务书要求。字面引号的转义是本实现新增的语法约定：
引号前每两个反斜杠生成一个反斜杠；若还剩一个，则该引号作为文字内容，否则切换包裹状态。
其他位置的反斜杠原样保留，不把反斜杠加 n/t 当成换行或制表符。
例如带引号的 Windows 路径如以反斜杠结尾，结束引号前应输入两个反斜杠。
文字在 tree 中使用 JSON 风格的引号与转义显示，便于识别内容边界。

## 第四轮体验：移动一个节点，矩形与文字一起移动

```text
init 800 600
create g node
create rect box 10 20 100 50 in node
create text label 25 50 "开始" in node
move node 30 10
tree node
```

预期结果：

```text
g#node
├── rect#box x=40 y=30 w=100 h=50
└── text#label (55,60) "开始"
```

容器也是 Shape，对外仍使用 move；内部递归处理孩子，这就是本轮落实的 Composite 语义。
所有后代先计算并检查新坐标，全部成功才修改。任何一个后代失败，整组保持不变。
`tree` 显示全文档，`tree node` 只显示该子树。嵌套创建用 `create g child in node`。
`in` 尾缀只识别未加引号的关键字，`create text t 0 0 "in" in node` 的文字不会被当成语法。
examples/step-04.commands.txt 包含课设两节点流程图的创建与组移动部分；尚未包含 undo/set/save。

## 第五轮阅读路径

1. [SetCommand.ts](src/application/commands/SetCommand.ts)：找到对象，调用 setAttribute；命令不按图形类型判断。
2. [Shape.ts](src/domain/Shape.ts)：封装公共样式、缩放入口和显示属性；几何修改交给具体子类。
3. [RectShape.ts](src/domain/RectShape.ts)：白名单内的几何值校验成功才赋值；缩放先检查全部位置与尺寸。

组的 scale 与上一轮 move 一样，先准备全部孩子的变化，再统一提交，避免前面的图形已经改动、后面的图形才报错。
准备回调不公开、不保存，不作为撤销历史。show 只显示对象自身的显式属性；父级从现有对象树查询。

## 第五轮体验：缩放、属性修改与查询

```text
init 800 600
create g node
create rect box 10 20 100 50 in node
create text label 25 50 "开始" in node
set node fill blue
set box stroke black
set box stroke-width 2
scale node 2
set label text "处理数据 v2"
show box
show label
```

预期查询结果：

```text
rect#box  parent=g#node
  x=20 y=40 width=200 height=100
  stroke=black stroke-width=2
text#label  parent=g#node
  x=50 y=100 text="处理数据 v2"
```

缩放以 SVG 原点为基准，位置与尺寸都乘因子；描边宽度属于样式，不随几何缩放改变。
普通 g 的 fill 只存于组，孩子保留缺省或自己的显式 fill；以后保存 SVG 时依靠 SVG 样式继承。
所以 show box 中不出现 fill=blue，这是显示显式属性的约定；浏览器渲染要到保存阶段才验收。
若再执行 `set box fill red`，子图形显式红色将优先于组的继承颜色。

set 的公共属性为 fill、stroke、stroke-width；几何属性按各类型白名单校验，text 额外支持 text 内容。
尺寸和描边宽度允许零、拒绝负数；坐标允许负数，所有数值必须有限；普通组只支持公共样式。
未知属性报 `error: unknown attribute: <attr>`；非正缩放因子报 `error: scale factor must be positive`，失败后保持状态。
完整回放见 examples/step-05.commands.txt，包含两条预期错误和失败后的 show。

## 第六轮体验：同级顺序与删除子树

```text
init
create g scene
create rect red 10 20 100 60 red in scene
create rect blue 40 40 100 60 blue in scene
front red
tree scene
```

预期顺序如下：red 排在最后，将来保存 SVG 后会后绘制、显示在 blue 上面。

```text
g#scene
├── rect#blue x=40 y=40 w=100 h=60 fill=blue
└── rect#red x=10 y=20 w=100 h=60 fill=red
```

执行 `back red` 会恢复 red、blue 的顺序。front/back 只改变同级顺序，父级、坐标、样式和组内顺序均不变。
该映射依据 [SVG 默认绘制顺序](https://www.w3.org/TR/SVG2/render.html#RenderingOrder)：后面的元素绘制在前面的元素之上。
本轮用 tree 验证对象顺序，浏览器重叠效果到保存阶段再验收。

再继续输入：

```text
delete scene
tree
show red
create circle red 100 100 20
```

tree 应只剩 `svg (800x600)`；show red 报 `error: no such shape: red`，随后同名圆形可以创建成功。
这说明删除既摘除了子树，也清理了全部后代的 ID 索引。
完整回放见 examples/step-06.commands.txt，包含一条预期错误、同级排序和后代 ID 复用。

## 第六轮阅读路径

1. [DeleteCommand.ts](src/application/commands/DeleteCommand.ts)：发起删除并返回摘要，不判断目标是叶子还是容器。
2. [SvgDocument.ts](src/domain/SvgDocument.ts)：remove 先定位父级并收集子树，再摘离和清理索引；reorder 只调整同级顺序。
3. [GroupShape.ts](src/domain/GroupShape.ts)：封装孩子列表的摘离与重排；先验证对象是直接孩子，防止 indexOf 返回 -1 时误删末尾。

理解时重点区分两种数据：对象树负责“归属与顺序”，ID 索引负责“按名字找到对象”。
删除必须更新二者；重排只改变顺序，不删除或重新登记 ID。
摘离只解除子树根的 attached 标记，后代仍属于子树。领域测试验证可完整重新加入，但当前 CLI 尚未提供 undo。

## 第七轮体验：把已有对象组成节点，再解组

```text
init
create g scene
create rect box 10 20 100 50 red in scene
create text label 25 50 "开始" in scene
create circle marker 200 50 10 blue in scene
group node label box
addto node marker
tree scene
```

预期结果：

```text
g#scene
└── g#node
    ├── rect#box x=10 y=20 w=100 h=50 fill=red
    ├── text#label (25,50) "开始"
    └── circle#marker cx=200 cy=50 r=10 fill=blue
```

group 使用当前树顺序，所以参数写成 label box 后，组内仍为 box、label；addto 把 marker 追加到末尾。
再执行 `ungroup node`，三个孩子按上述顺序原位提升到 scene，node 的 ID 被释放。
`ungroup scene` 则按课设报 `error: cannot ungroup top-level container: scene`。
完整回放见 examples/step-07.commands.txt，包括循环迁移和根级解组两条预期错误。

用户本轮确认的分组约定：新组放在最近共同父容器中；同父级时占首个选中图形的位置。
跨父级时，新组插在最早包含选中节点的分支之前，旧父容器即使变空也保留；孩子按原树的深度优先顺序进入新组。
例如 scene 下的 left 含 a，right 含 b：`group pair b a` 得到 scene 下的 pair(a,b)、left、right，而不是根级 pair。
group 至少需要两个不同对象，不能同时选择某容器及其后代。

addto 可以迁移整棵子树，也可以把孩子移到原父级的末尾；不能把自己移入自己或把祖先移入后代。
迁移与解组保留对象、坐标和显式属性，不把旧父级的样式复制给孩子；继承外观可能随父级改变，浏览器效果到保存阶段验收。
分组不保证与所有未选中图形的交错绘制顺序完全相同，保留的是被选中对象之间的相对顺序。

## 本轮阅读路径

1. [GroupCommand.ts](src/application/commands/GroupCommand.ts)：保留命令意图，调用文档的分组行为。
2. [SvgDocument.ts](src/domain/SvgDocument.ts)：group/addTo/ungroup 先修改局部列表副本；applyStructure 检查拟议的新树与预期节点集合，再统一提交。
3. [GroupShape.ts](src/domain/GroupShape.ts)：内部 prepareChildren 准备私有列表副本，提交回调只替换列表。

重点理解“准备与提交”：当多个父级都要改变时，不能先移走第一个对象，再检查最后一个对象是否存在。
本轮只复制受影响的孩子数组；几何对象保留原身份，列表计划用完即丢，不充当撤销历史。

## 前几轮阅读回顾

1. [LineShape.ts](src/domain/LineShape.ts)：一次移动要更新两个端点，先检查四个新坐标，再一起赋值。
2. [TextShape.ts](src/domain/TextShape.ts)：移动位置时保留文本，描述中正确显示引号。
3. [EllipseShape.ts](src/domain/EllipseShape.ts)：移动圆心，保留两个半径。

[MoveCommand.ts](src/application/commands/MoveCommand.ts) 仍然调用 shape.move，不读取具体几何字段。
[ShapeFactory.ts](src/domain/ShapeFactory.ts) 集中根据类型名创建对象；这是任务书允许且标注待重构的分派点。
[SvgDocument.ts](src/domain/SvgDocument.ts) 以 Shape 类型保存五类对象，统一检查 id 唯一性。

构造函数中的 `private x: number` 是 TypeScript 参数属性：同时声明字段并用参数初始化。
`override` 标明实现或重写了父类的成员。

从矩形扩展到五类叶子后，CreateCommand、MoveCommand、TreeCommand 和 SvgDocument 均未修改。
这验证了统一行为接口的价值，也说明几何字段不必相同。

设计取舍：各类的移动实现有少量相似代码，当前保留在各自类中。
线段有两个端点，容器要移动孩子，因此不为少量重复增加“统一位置”基类。

## 后续项目安排

按功能检查点推进；复杂阶段拆成两轮，每轮验证后独立提交、推送，再结合用户反馈继续。

| 后续阶段 | 主要内容 | 完成标志 |
| --- | --- | --- |
| 1. 属性与几何编辑（已实现） | scale、set、show | 44 组测试通过；用户体验与代码讨论待反馈 |
| 2A. 树结构删除与排序（已实现） | delete、front、back | 54 组测试通过；删除释放全部后代 ID，排序仅影响同级 |
| 2B. 树结构分组与迁移（已实现） | group、addto、ungroup | 66 组测试通过；采用用户选定的位置规则，失败保持状态 |
| 3. 撤销与辅助命令（下一阶段） | undo/redo、help、canvas | 一条编辑一个撤销单元；新编辑清 redo；查询不入栈；init/canvas 修改后禁用历史 |
| 4. SVG 持久化 | 先 save，再 read、补 id 与历史边界 | 浏览器可预览；支持范围内读写一致；失败不替换文档或改变历史 |
| 5. 最终验收 | 全命令回放、架构检查、文档修订、final tag | 课设示例与边界测试通过，真实过程记录完整，远程代码与 tag 一致 |

详细验收点和待讨论取舍见 doc/README.md 的“后续迭代安排”。box 与动态插件不属于本阶段。

独立远程仓库：https://github.com/CYBetter/svg-editor-cli-learning

架构与真实过程记录见 [doc/README.md](doc/README.md)。
