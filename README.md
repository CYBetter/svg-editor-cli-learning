# SVG CLI：分步协作学习版

这是一个独立的新仓库，用于重新开展真实的、适中粒度的 AI 辅助编程过程。
旧工程是参考版本；本仓库不会把旧工程的完成记录当作用户参与的学习过程。

## 当前增量

第一轮已实现：`init → create rect → tree → move → tree`。
支持根级矩形、可选 fill、tree id、输入校验和失败时保持状态。
自动测试与 AI 运行验证完成；等待用户体验、审查和反馈。
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

## 本轮阅读路径

1. [MoveCommand.ts](src/application/commands/MoveCommand.ts)：一次移动请求只负责找对象、调用行为和返回摘要。
2. [RectShape.ts](src/domain/RectShape.ts)：图形自己计算和校验新坐标，然后一次性提交。
3. [SvgDocument.ts](src/domain/SvgDocument.ts)：文档掌握全部图形，因此由它检查 id 唯一性。

构造函数中的 `private x: number` 是 TypeScript 参数属性：同时声明字段并用参数初始化。
`override` 标明实现或重写了父类的成员。

讨论点：如果下一轮加入圆形，MoveCommand 是否需要知道圆形使用 cx/cy？
本轮的设计让它依赖 Shape 的 move 行为，因此几何细节可以留在新图形类中。

独立远程仓库：https://github.com/CYBetter/svg-editor-cli-learning

架构与真实过程记录见 [doc/README.md](doc/README.md)。
