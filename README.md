# SVG CLI：分步协作学习版

这是一个独立的新仓库，用于重新开展真实的、适中粒度的 AI 辅助编程过程。
旧工程是参考版本；本仓库不会把旧工程的完成记录当作用户参与的学习过程。

## 当前增量

第一轮实现最小矩形编辑流程；第二轮增加 circle，验证原有命令通过多态支持新图形。
当前支持根级矩形和圆形、可选 fill、tree id、输入校验和失败时保持状态。
14 组自动测试通过。用户已要求继续推进，尚未反馈具体手动验收结果。
其余图形、in 子句、容器、其他命令、撤销重做与 SVG 读写留到后续增量。

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

## 本轮阅读路径

1. [CircleShape.ts](src/domain/CircleShape.ts)：继承 Shape，实现圆心移动和圆形描述。
2. [MoveCommand.ts](src/application/commands/MoveCommand.ts)：保持第一轮代码，调用 shape.move，不判断矩形还是圆形。
3. [ShapeFactory.ts](src/domain/ShapeFactory.ts)：只有创建对象时需要根据类型名选择具体类。

矩形仍由 [RectShape.ts](src/domain/RectShape.ts) 负责自身几何行为。
[SvgDocument.ts](src/domain/SvgDocument.ts) 以 Shape 类型保存两类对象，统一检查 id 唯一性。

构造函数中的 `private x: number` 是 TypeScript 参数属性：同时声明字段并用参数初始化。
`override` 标明实现或重写了父类的成员。

本轮已验证：新增圆形后，CreateCommand、MoveCommand、TreeCommand 和 SvgDocument 均未修改。
这就是多态的具体收益：调用方依赖统一行为，具体对象实现自己的几何细节。
同时，工厂仍需要新增类型分支；它是任务书允许保留的集中分派点，不等于动态插件已经实现。

设计取舍：两种图形的移动实现有少量相似代码，当前保留在各自类中。
不急于增加“统一位置”基类，因为后续线段有两个端点，容器则要移动孩子，位置模型并不相同。

独立远程仓库：https://github.com/CYBetter/svg-editor-cli-learning

架构与真实过程记录见 [doc/README.md](doc/README.md)。
