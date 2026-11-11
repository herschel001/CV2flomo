# CV2flomo

一个非官方的 Chrome Manifest V3 扩展：把网页选中文字、个人想法、标签和网页链接直接发送到 flomo。

当前版本：**1.0.1**。支持 Chrome 102+。本地图片上传与富文本排版暂不支持。

## 功能

- 原文与个人想法分区输入，支持最多 8 个笔记标签、30 个常用标签。
- 按需读取当前网页信息和选区，不在所有网页常驻注入脚本。
- 自动保存、自动填充网页信息、字数统计均可开关。
- 失败保留草稿；发送结果未知时先提示确认，降低误重发风险。
- webhook 与草稿保存在本机；普通备份仅导出偏好和标签。

## 快速安装（无需 Node.js）

1. 从仓库右上方 **Code → Download ZIP** 下载源码并解压；也可使用 Git 克隆。
2. 打开 `chrome://extensions/`，开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的项目根目录。
4. 点击扩展图标，进入设置，保存自己的 flomo webhook 地址。需具备 flomo API 使用权限。

当前通过开发者模式安装，未上架 Chrome Web Store。详细步骤和升级注意事项见 [INSTALL.md](INSTALL.md)。

## 使用

1. 选择网页文字后打开扩展；快捷键为 `Ctrl+Shift+F`，macOS 为 `Command+Shift+F`。
2. 补充想法、标签和原文，点击“发送到 Flomo”。整条笔记（含标签与网页信息）最多 5000 字，这是本扩展的输入限制。
3. 设置中的“发送测试笔记”需要确认；它会真正创建一条测试笔记，并消耗一次发送额度。

**图片边界：**当前只发送文字和链接，不保留富文本排版，也不上传本地图片。图片链接作为文字发送，不保证转换为图片附件。粘贴或拖入本地图片会提示限制；旧草稿附件可先“保存原图”，再明确移除后发送文字。官方文档中的 `image_urls` 属于 URL Scheme，不能直接作为 webhook 上传接口使用。参见 [flomo 官方说明](https://help.flomoapp.com/advance/api.html)。

## 发送与草稿

- 自动保存开启时，每次编辑立即提交本机后台；关闭该开关后，仍可手动保存，发送前也始终保存恢复草稿。
- 只有 HTTP 和业务响应都成功，才清除对应草稿。失败保留输入，不增加成功计数。
- 后台串行发送，保留最近 200 次投递记录；请求编号用于降低重复点击、关闭弹窗或后台重启后的误重发风险，不能保证远端恰好写入一次。
- 超时、HTTP 异常或响应无法解析时，先在 flomo 检查收件，再确认是否重新发送；不会自动重试。
- 已发送后若统计或草稿清理失败，会明确提示“已发送”，避免误导重试。
- 计数仅统计本扩展在本机确认成功的发送，按本机日期重置。其他设备或工具的用量以 flomo 为准。

浏览器崩溃或卸载仍可能造成草稿丢失，本机存储不能替代长期备份。

## 隐私与安全

笔记直接发送到 flomo，没有本项目的中转服务器、遥测或广告。API 地址仅在本机保存；偏好和标签可能随用户启用的 Chrome 同步进行跨设备同步。普通备份不包含 webhook、草稿、正文历史、统计或投递记录。

不要把真实 webhook、私人笔记或完整浏览器配置贴进 GitHub。历史版本若曾使用真实 webhook 示例，应在 flomo 更换或撤销；删除文件不能使旧凭据失效。

详见 [隐私说明](PRIVACY.md) 与 [安全报告方式](SECURITY.md)。

## 开发与构建

需要 Node.js 22.12+（22 系列）或 24+。

```bash
git clone https://github.com/herschel001/CV2flomo.git
cd CV2flomo
npm ci
npm run check
npm test
npm run build
```

生产包输出到 `dist/`；在扩展管理页加载该目录。`node build.js` 提供不依赖 Webpack 的复制打包，保持相同目录结构。升级时继续使用原加载目录，并重新加载扩展。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 监听构建，使用符合扩展 CSP 的 source map |
| `npm run check` | JavaScript 语法检查 |
| `npm test` | Node 内置测试与 jsdom，模拟网络，不写入真实 flomo |
| `npm run build` | 生产构建并验证清单与页面资源 |
| `npm run build:copy` | 复制打包并验证入口 |
| `npm run check:publication` | 检查 Git 索引中待发布的文件；需先暂存 |
| `npm audit --registry=https://registry.npmjs.org` | 查询官方依赖漏洞数据库 |

## 项目结构

- `src/background/`：消息来源与操作权限检查。
- `src/utils/service.js`：发送队列、草稿、统计和备份。
- `src/utils/api.js`、`storage.js`、`validation.js`：HTTP 发送、迁移及校验。
- `src/popup/`、`src/options/`、`src/content/`：弹窗、设置及按需页面读取。
- `tests/`：自动化回归；`test.html`：手工测试页。
- `scripts/`：语法、打包与发布前检查；`icons/`：图标及生成器。

## 问题反馈与贡献

一般问题请提交 [Issue](https://github.com/herschel001/CV2flomo/issues)，附上版本、复现步骤和脱敏信息；安全漏洞使用 [私密报告入口](https://github.com/herschel001/CV2flomo/security/advisories/new)。开发约定见 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [AGENTS.md](AGENTS.md)，更新记录见 [VERSION.md](VERSION.md)。

## 许可证

[MIT License](LICENSE)。CV2flomo 与 flomo 官方无隶属关系。
