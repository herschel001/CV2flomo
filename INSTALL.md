# Flomo Web Clipper 安装指南

## 环境

- Chrome 102+；macOS、Windows 或 Linux。
- Node.js 22.12+（22 系列）或 24+ 用于 Webpack 构建和测试；直接加载源码无需 Node.js。
- 具备 flomo API 使用权限的账号及个人 webhook 地址。

## 下载

从 [GitHub 仓库](https://github.com/herschel001/CV2flomo) 的 Code → Download ZIP 下载并解压，或使用 `git clone https://github.com/herschel001/CV2flomo.git`。无需构建时，可直接加载包含 `manifest.json` 的根目录。

## 构建安装

在项目根目录执行：

```bash
npm ci
npm run check
npm test
npm run build
```

打开 `chrome://extensions/`，开启开发者模式，点击“加载已解压的扩展程序”，选择 `dist/`。

无需 Webpack 时，可运行 `node build.js` 后加载 `dist/`，也可直接加载项目根目录。PNG 图标已包含在 `icons/` 中；修改图标时可使用 `icons/create-icons.html` 重新生成。

## 配置与使用

1. 点击扩展图标，打开设置页。
2. 从 flomo 的 API 设置复制个人地址，输入并保存。API 地址仅存于当前浏览器本机存储。
3. 如需验证，点击“发送测试笔记”；确认后将实际发送一条笔记并计入每日次数。
4. 在网页选择文字，打开扩展，补充想法与标签，再点击发送。
5. macOS 快捷键为 `Command+Shift+F`，其他平台为 `Ctrl+Shift+F`；冲突时在 `chrome://extensions/shortcuts` 修改。

仅发送文字与链接，不上传本地图片或保留富文本样式。旧图片草稿可保存原图后移除附件，再发送正文。

## 升级与验证

保持原有加载目录和扩展 ID：原来加载根目录的继续加载根目录；原来加载 `dist/` 的先构建后继续加载 `dist/`。然后在扩展管理页点击“重新加载”。更换加载目录可能被识别为另一个扩展，无法自动读取原扩展的数据。

旧 webhook 和计数首次使用时自动迁移至本机。打开弹窗确认内容恢复、常用标签可用，检查设置开关是否生效。网络结果待确认时，先检查 flomo，确认未收到后再允许重发。

可打开 `test.html` 做手工验证；读取本地文件选区需要在扩展详情中允许访问文件网址。浏览器内部页面和其他受限页面可能无法读取选区，但仍可手动输入笔记。

备份只含偏好与标签，不包含 API 地址或草稿。卸载会移除本机数据；发送失败或草稿保存失败时，请先保留正文。

详细的数据处理、功能边界和开发命令见 [README.md](README.md)。

隐私与数据删除方式见 [PRIVACY.md](PRIVACY.md)，漏洞报告见 [SECURITY.md](SECURITY.md)。本项目采用 [MIT License](LICENSE)。
