# SVG CLI：分步协作学习版

这是一个独立的新仓库，用于重新开展真实的、适中粒度的 AI 辅助编程过程。
旧工程是参考版本；本仓库不会把旧工程的完成记录当作用户参与的学习过程。

**课程平台最终提交文件为 [doc/README.md](doc/README.md)**。该文件包含 Git 仓库地址，以及架构方案、过程记录、一致性自查和质量保证手段；上传时保持文件名 README.md。本根目录 README 是运行与分步学习手册。

## 当前增量

第一轮实现最小矩形编辑流程；第二轮增加圆形；第三轮增加椭圆、线段和文字；第四轮加入 g 容器；第五轮加入 scale、set、show；第六轮加入 delete、front、back；第七轮加入 group、addto、ungroup；第八轮加入 undo/redo；第九轮加入 help、canvas；第十轮加入 save；第十一轮加入 read；第十二轮完成综合验收。
当前已接入课设全部 19 条命令，包括六类图形编辑、撤销重做、帮助、画布查询/修改与支持范围内的 SVG 读写。
118 组自动测试通过；课设两段完整会话、六类读写往返和流程图浏览器预览通过验证。用户已选择分组位置、文档快照和读取子集范围，尚未反馈具体手动验收结果。
Phase 1 支持范围内的实现及 AI 综合验收已完成，最终交付版本以 final tag 为准。演示与复习步骤见“第十二轮”。

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
重新启动会得到未初始化状态；可用 `save demo.svg` 保存当前图形，用 `read demo.svg` 读回并继续编辑。

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
摘离只解除子树根的 attached 标记，后代仍属于子树。第六轮领域测试验证可完整重新加入，第八轮已通过会话快照接入 undo。

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

## 第七轮阅读路径

1. [GroupCommand.ts](src/application/commands/GroupCommand.ts)：保留命令意图，调用文档的分组行为。
2. [SvgDocument.ts](src/domain/SvgDocument.ts)：group/addTo/ungroup 先修改局部列表副本；applyStructure 检查拟议的新树与预期节点集合，再统一提交。
3. [GroupShape.ts](src/domain/GroupShape.ts)：内部 prepareChildren 准备私有列表副本，提交回调只替换列表。

重点理解“准备与提交”：当多个父级都要改变时，不能先移走第一个对象，再检查最后一个对象是否存在。
这部分领域结构操作只复制受影响的孩子数组，内部图形对象保留身份，列表计划用完即丢。
第八轮会话会在完整文档副本上执行编辑，因此不能跨命令缓存原图形对象引用，应按 ID 重新查找。

## 第八轮体验：撤销整组移动与删除

```text
init
create g node
create rect box 10 20 100 50 red in node
create text label 25 50 "开始" in node
move node 30 10
undo
tree node
redo
delete node
undo
tree node
```

第一次 tree 应显示 box 在 (10,20)、label 在 (25,50)；最后一次 tree 应显示 box 在 (40,30)、label 在 (55,60)。
移动整个组只占一个撤销单元，删除整个组也只占一个单元，恢复时同时还原孩子、父级、顺序和 ID 索引。
成功反馈使用 `undone: <原编辑摘要>` / `redone: <原编辑摘要>`，表示该操作已撤销或重做。

历史规则：

- tree/show/help、canvas 无参查询、空行、注释及失败操作不记录历史，也不清空 redo。
- undo 后成功执行新编辑会清空 redo。`move box 0 0` 等无实际变化的成功编辑也算一个单元。
- 成功 init 或 canvas 修改清空历史，并使 undo/redo 都报 `error: undo not allowed after io command`；下一次成功编辑重新解禁。
- 解禁后没有可撤销/重做内容，分别报 `error: nothing to undo` / `error: nothing to redo`。
- 第八轮完成 init 边界，第九轮补齐 canvas 边界，第十轮补齐 save 边界，第十一轮接入 read 边界。

完整回放见 examples/step-08.commands.txt，包含三条预期错误及历史分支验证。

## 第八轮阅读路径与取舍

1. [EditCommand.ts](src/application/commands/EditCommand.ts)：统一执行入口，十类编辑都经 session.edit 执行，调用者无需额外记录历史。
2. [EditorSession.ts](src/application/EditorSession.ts)：在工作副本执行，快照完成后提交；维护 undo/redo 两个栈及 init 边界。
3. [HistoryEntry.ts](src/application/HistoryEntry.ts)：私有保存前后文档副本，每次恢复再复制，防止当前编辑污染历史。

用户选择了文档快照：每个图形通过自己的 cloneGeometry 复制私有几何值，Shape 复制显式样式，GroupShape 递归复制孩子，文档重建索引。
这保留具体类的方法，也保留“样式未指定”与“显式设置”的区别；不通过 JSON 把模型变成普通数据袋。
删除和分组因此不用分别编写反向操作，数值缩放造成的浮点损失也不会影响撤销恢复。
代价是每个历史条目保存两份文档，内存随图形数量和编辑次数增长；目前不设截断条数，适用于本课设的小型图形文档。
会话每次成功编辑、undo、redo 都替换当前文档；失败保持原文档实例和历史。外部调用方应按 ID 重新取得对象。

## 第九轮体验：查询与修改的历史区别

启动 CLI 后逐行输入：

```text
init 800 600
help
create rect box 10 20 100 50 red
move box 30 10
undo
canvas
redo
canvas 1000
show box
undo
```

第一次 canvas 返回 `canvas 800x600`；它只查询尺寸，所以随后的 redo 仍能恢复移动。
`canvas 1000` 返回 `canvas 1000x600 updated`，保留当前高度；show box 仍显示 x=40、y=30、width=100、height=50。
最后 undo 按课设报 `error: undo not allowed after io command`。修改画布只改变画布尺寸，不缩放、移动或裁掉模型中的图形。

canvas 无参查询，单参只改宽并保留当前高度，双参修改宽高；两项尺寸均为有限正数。
其中单参数的行为是本实现的补充约定，任务书没有单独规定。成功修改为文档操作，即使尺寸与原来相同，也清空并禁用历史。
非法尺寸或复制失败则保持原文档和历史；之后首次成功编辑建立新的可撤销记录，但不能越过画布修改恢复更早的编辑。

第九轮 help 列出 17 条已实现命令，第十轮增加 save，第十一轮增加 read，目前为全部 19 条命令。
按任务书“未 read/init 就执行其他命令”的通用错误约定，help 也要求先 init 或 read；启动提示已说明这一顺序。
完整回放见 examples/step-09.commands.txt，含查询保留 redo、单参保留高度、两条预期错误及失败修改后 redo 仍可用。

## 第九轮阅读路径

1. [CanvasCommand.ts](src/application/commands/CanvasCommand.ts)：无参直接读取尺寸；有参调用会话的 resizeCanvas，不进入 EditCommand 的编辑历史。
2. [SvgDocument.ts](src/domain/SvgDocument.ts)：withCanvasSize 先验证新尺寸，再完整复制图形；clone 复用它并传入原尺寸。
3. [EditorSession.ts](src/application/EditorSession.ts)：init 与 canvas 修改共用私有 replaceDocument，只有新文档准备成功，才替换当前文档并清空历史。

本轮复习重点是“改变状态”和“记录可撤销编辑”不是同一件事：canvas 修改确实改变文档，但课设要求它成为历史边界。
因此不能让所有成功命令都走 EditCommand，也不能在尺寸验证之前清空历史。help 与 canvas 查询只读，不替换文档。

## 第十轮体验：把对象树保存成 SVG

在 CLI 中输入：

```text
init 400 200
create g node
set node fill #4a90d9
create rect box 30 70 160 60 in node
create text label 50 105 "开始 <Start> & 输入" in node
set label fill white
save demo.svg
undo
```

保存反馈为 `saved to demo.svg (3 elements)`，计数包括 g，不包括 svg 根。
用浏览器打开 demo.svg，应看到蓝色矩形和白色文字；文件中的文本是 `开始 &lt;Start&gt; &amp; 输入`，浏览器显示原字符。
最后 undo 按课设报 `error: undo not allowed after io command`。保存不修改图形或替换当前文档，但成功后会清空历史；下一条成功编辑可以重新撤销。

路径约定严格遵循任务书：无参 save 的默认目标是 read 读入时的路径。init 后必须给出路径；即使已经显式保存一次，无参 save 仍报 `error: no source file. use save <file.svg>`。第十一轮 read 成功后可以使用无参 save；另存不改变读入路径。
带空格路径使用双引号，如 `save "我的图形 v1.svg"`；相对路径按启动程序时所在目录解释，父目录须已存在。
保存可替换已有普通文件；目录或符号链接目标被拒绝。写入失败报 `error: cannot write file: <路径>`，原文件、当前文档和历史保持不变。

完整流程图脚本为 [examples/step-10.commands.txt](examples/step-10.commands.txt)，输出为 [examples/step-10.svg](examples/step-10.svg)。
AI 已在 Edge 中打开该输出，检查蓝色继承、橙色覆盖、白色文字和连接线，并另行验证 front/back 叠放及 XML 特殊字符/空白的完整还原。
编译后可在工程根目录用下面的 UTF-8 回放方式运行，避免旧版 PowerShell 管道损坏中文：

```powershell
node -e "const fs=require('node:fs'),cp=require('node:child_process');const r=cp.spawnSync(process.execPath,['dist/src/Main.js'],{input:fs.readFileSync('examples/step-10.commands.txt'),encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exitCode=r.status??1"
```

脚本最后两条 error 分别验证保存后的历史阻断与缺少读入路径，是预期结果。

## 第十轮阅读路径与取舍

1. [Shape.ts](src/domain/Shape.ts) 的 writeTo：各类提供自身元素名和属性，容器递归输出孩子；TextShape 单独提供文字内容，不把 text 伪属性写成 XML 属性。
2. [SvgWriter.ts](src/infrastructure/SvgWriter.ts)：实现 DrawingWriter 输出契约，统一处理命名空间、viewBox、缩进和转义，不按图形名称判断类型。
3. [SvgFileStore.ts](src/infrastructure/SvgFileStore.ts) 与 [EditorSession.ts](src/application/EditorSession.ts)：先生成完整文本，独占创建同目录临时文件，写完关闭后替换目标；成功返回之后会话才清空历史。

本轮复习两个职责：序列化决定“文件里写什么”，文件模块决定“如何可靠写入”。Main 注入 DocumentSaver 的具体实现，命令与领域模型都不依赖 Node 文件 API。
公共样式只输出显式值，组样式由 SVG 继承；子图形的显式样式优先。对象顺序就是输出顺序，移动/缩放输出实际几何值，不重复写 transform。
按 [XML 1.0 规范](https://www.w3.org/TR/xml/#charsets) 拒绝不能写入 XML 的控制字符和未配对代理项；合法空白用字符引用保留，中文和 emoji 用 UTF-8 保存。非法文本保存失败也不清历史。

## 第十一轮体验：读入、补 ID、继续编辑

在工程根目录启动 CLI 后输入：

```text
read examples/other.svg
tree
undo
move c1 20 10
save examples/step-11.svg
read examples/step-11.svg
set t1 text "读回 & 编辑 <SVG>"
save
```

第一次读取应先显示 `warning: assigned id rect1 to unnamed <rect>`，再显示 `read examples/other.svg (7 elements)`。
other.svg 来自课设示例：根级白色矩形没有 ID，其余 ID 均保留。紧接读取的 undo 报历史禁用；之后的成功编辑重新建立历史。
最后无参 save 写回最近读入的 step-11.svg；other.svg 保持原样。完整脚本 [step-11.commands.txt](examples/step-11.commands.txt) 还包含一次缺失文件读取，验证失败后 redo 仍可用。

默认路径是会话信息，独立于编辑快照：

- read 成功：接收新文档、记住绝对读入路径，清空并禁用历史。
- 另存 `save b.svg`：输出到 b.svg，默认路径仍为最近读入的 a.svg。
- move、undo/redo、canvas 修改：保留读入路径。
- init 成功：清除读入路径；失败 init/read/save 不改变原路径、文档或历史。

## 第十一轮读取范围与阅读路径

用户选择先支持正式六类图形及属性白名单，对不能保留的扩展明确报错。以下是本实现的输入约定，不是所有合法 SVG 的限制：

- UTF-8 的 XML 1.0；支持 XML 声明、注释、CDATA、预定义实体及数字字符引用。DOCTYPE、自定义实体和处理指令不在范围内。
- 根为 svg，命名空间使用标准 SVG URI，或整份文档都不声明命名空间；同一文档的子元素须保持该命名空间。正确绑定到 SVG URI 的前缀可以使用。
- 根显式提供有限正数 width/height；viewBox 可省略，提供时必须为 `0 0 width height`。不支持其他根属性、尺寸单位或百分比。
- rect/circle/ellipse/line/text 的几何字段须完整，与当前 save 输出一致；只接受纯数值，可以有首尾 XML 空白。省略几何字段时报错，不猜测 SVG 的默认值。
- 保留公共 fill/stroke/stroke-width、子树顺序、显式与缺省样式；text 内容保留空白，不能把 text 伪属性写成 XML 属性。叶子不能包含子元素，非文字元素只能包含排版空白。
- transform、style、font-size、外部命名空间、未知元素/属性均拒绝；不会静默丢弃后继续保存。box 及 data-kind 等插件语义仍不属于本阶段。

补 ID 使用两遍遍历：先预留全部显式 ID 并查重，再按原树顺序补上最小可用的“标签名+序号”。例如前面一个无名 rect、后面已命名 rect1，无名元素会得到 rect2；不同类型也共享 ID 空间。

1. [SvgReader.ts](src/infrastructure/SvgReader.ts)：严格解析后检查根和输入范围，先预留 ID，再构建候选文档；补 ID 警告暂存到完整结果中。
2. [ShapeFactory.ts](src/domain/ShapeFactory.ts) 与 [Shape.ts](src/domain/Shape.ts)：CLI 和导入共用唯一类型分派入口；新对象通过多态方法检查和恢复几何、样式与文字，不增加解析器内的类型分支。
3. [EditorSession.ts](src/application/EditorSession.ts)：读入结果及反馈全部准备好后才替换当前文档、更新路径和清历史；中途失败不会发布半份文档或半程警告。

XML 语法处理交给固定版本 [saxes](https://github.com/lddubeau/saxes)，项目负责检查 SVG 支持范围。这样可以复习“语法正确”和“本程序能够完整表达”是两道不同的校验。

## 第十二轮：综合验收与演示

本轮围绕课设第 6 节典型会话及第 6.1 节版本 A 进行验收，没有增加新的产品功能。
两份脚本保留课设命令顺序与参数；成功反馈沿用本工程的摘要格式，规定的错误文本严格核对。

| 回放脚本 | 输出 | 重点观察 |
| --- | --- | --- |
| [course-session.commands.txt](examples/course-session.commands.txt) | [demo.svg](examples/demo.svg) | 分组后继续编辑，撤销文字修改和删除，保存 5 个元素；随后读取 other.svg 得到 7 个元素 |
| [course-flowchart.commands.txt](examples/course-flowchart.commands.txt) | [flowchart.svg](examples/flowchart.svg) | 8 个元素构成两节点流程图；移动 node2 时矩形、文字一起移动，undo 后恢复，最终文字为“处理数据 v2” |

自动验收在隔离目录执行真实 CLI，检查错误、输出文件及重新读入的模型，并清理临时目录：

```powershell
npm test
```

想实际重新生成流程图，可在工程根目录运行（会更新 examples/flowchart.svg）：

```powershell
npm run build
Push-Location examples
node -e "const fs=require('node:fs'),cp=require('node:child_process');const r=cp.spawnSync(process.execPath,['../dist/src/Main.js'],{input:fs.readFileSync('course-flowchart.commands.txt'),encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exitCode=r.status??1"
Pop-Location
```

浏览器打开 examples/flowchart.svg 即可预览。连接线是课设要求的普通 line，没有另加箭头或扩展属性。
典型会话脚本同样在 examples 目录运行，将文件名改为 course-session.commands.txt；它恰好产生两条预期错误：祖孙不能同时分组、save 后不能 undo。

### 适中的复习任务

在工程根目录启动 `npm run cli`，用已经生成的流程图做一次短实验：

```text
read examples/flowchart.svg
move node2 0 100
show process
show process-label
undo
show process
```

移动后矩形 y=200、文字 y=235；撤销后矩形 y=100。不要执行 save，就不会修改示例文件。
结合运行结果，用自己的话解释下面三个问题即可，不需要重写函数：

1. 为什么 MoveCommand 不用区分矩形和组？沿 [MoveCommand](src/application/commands/MoveCommand.ts) → [Shape](src/domain/Shape.ts) → [GroupShape](src/domain/GroupShape.ts) 看调用关系：命令表达意图，具体对象实现移动行为。
2. 为什么撤销一次就能同时恢复矩形和文字？看 [EditorSession.edit](src/application/EditorSession.ts) 和 [HistoryEntry](src/application/HistoryEntry.ts)：历史记录对应整条编辑命令，保存的是完整文档前后状态。
3. 为什么 read/save 成功后不能继续撤销此前编辑？这是课设规定的历史边界；会话在文档操作成功后清空两栈，而失败操作保留它们。

这里提供的是运行预期和阅读线索。用户自己的观察、疑问与结论，应在实际反馈后再补入过程记录。

### 交付核对

- 代码入口：[src/Main.ts](src/Main.ts)；正式架构、真实过程、一致性自查和质量保证：[doc/README.md](doc/README.md)。
- 支持范围：19 条命令、六类图形；读取约定见上文。box、动态插件和图形界面属于后续阶段。
- 使用 `git log --oneline --decorate` 查看分步提交，使用 `git show final --no-patch` 查看最终标记；远程记录以仓库实际分支和标签为准。
- 用户尚未提供课程截止时间；不能据此断言提交已满足截止时间要求。用户手动验收与学习体会仍需本人补充。

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
| 3A. 撤销重做（已实现） | undo、redo、init 历史边界 | 78 组测试通过；用户选定快照，一条编辑一个历史单元 |
| 3B. 辅助命令（已实现） | help、canvas | 86 组测试通过；查询保留历史，成功修改尺寸清历史，失败保留状态 |
| 4A. SVG 保存（已实现） | save、SVG 输出与保存历史边界 | 98 组测试通过；六类输出与转义、失败保留旧文件和历史；浏览器预览通过 |
| 4B. SVG 读取（已实现） | read、缺失 id 补全、读入路径与历史边界 | 116 组测试通过；采用用户选定的正式子集；六类读写一致；失败保留文档、路径与历史 |
| 5. 最终验收（已完成） | 课设完整会话回放、架构检查、文档修订、final tag | 118 组测试通过；两段课设会话及流程图浏览器验证通过；44 类、一类一文件、两处分派和依赖方向已复核 |

详细验收点和设计取舍见 doc/README.md 的“阶段进度与交付安排”。接下来由用户进行演示、复习关键调用关系并补充真实学习体会；发现具体问题后再单独修正和提交。box 与动态插件不属于本阶段。

独立远程仓库：https://github.com/CYBetter/svg-editor-cli-learning

架构与真实过程记录见 [doc/README.md](doc/README.md)。
