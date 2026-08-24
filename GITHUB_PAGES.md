# GitHub Pages 发布说明

这个仓库同时保留 Sites 源码和已经编译好的 `docs/` 静态网页。GitHub Pages 只发布 `docs/`，不会接触参与者的作品或文字。

## 首次发布

1. 在 GitHub 新建一个公开仓库，建议命名为 `zhiyu-art-demo`。
2. 把本仓库的 `main` 分支推送到新仓库。
3. 打开仓库 `Settings → Pages`。
4. 在 `Build and deployment` 的 `Source` 中选择 `GitHub Actions`。
5. 等待 `Deploy GitHub Pages` 工作流完成。

发布地址通常为 `https://你的GitHub用户名.github.io/zhiyu-art-demo/`。

## 更新网页

修改源代码后运行：

```bash
pnpm run build:pages
```

提交并推送 `docs/`，GitHub Actions 会自动更新公开网页。
