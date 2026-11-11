# 贡献指南

欢迎提交问题和改进。开始前请阅读 [README.md](README.md)、[PRIVACY.md](PRIVACY.md) 和 [SECURITY.md](SECURITY.md)。

## 开发

使用 Node.js 22.12+（22 系列）或 24+，以及 Chrome 102+。

```bash
git clone https://github.com/herschel001/CV2flomo.git
cd CV2flomo
npm ci
npm run check
npm test
npm run build
```

在 `chrome://extensions/` 加载 `dist/`。`npm run dev` 可监听构建；每次改动后仍需重新加载扩展。保持原加载目录可避免改变扩展身份。

## 改动与测试

- 保持改动集中，沿用周边缩进、单引号、分号与 camelCase 命名。
- HTTP 发送放在 `src/utils/api.js`，计数、草稿和状态变更放在后台服务中。
- 行为变化应增加 `tests/*.test.js` 回归测试；使用模拟 Chrome API 和模拟网络。
- 不加入真实 webhook、个人笔记、备份或浏览器配置。测试数据应明确虚构。
- 打包相关改动同时检查 `npm run build` 和 `npm run build:copy`。图片上传、权限或发送端点的改动，需要说明接口依据和隐私影响。
- UI 改动提供脱敏截图，并说明浏览器版本与手工验证范围。

## 提交与 PR

先 Fork 并创建工作分支，再提交 PR 到 `main`。提交信息用简短的祈使句，例如 `Fix draft restoration`。

PR 应描述具体问题、修改后的行为、关联 Issue、测试结果与已知限制。不要把私人聊天记录或未脱敏日志贴进描述。若希望隐藏私人邮箱，可按 [GitHub 提交邮箱说明](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference) 配置 GitHub 提供的 `noreply` 地址。

提交前暂存要发布的文件，再检查实际 Git 索引：

```bash
git add <明确要提交的路径>
npm run check:publication
git diff --cached --stat
```

该扫描会阻止常见凭据、本机路径、大文件及本地私密目录进入本次发布，但不能保证发现所有隐私数据；仍需人工审查暂存内容。

本项目采用 [MIT License](LICENSE)。
