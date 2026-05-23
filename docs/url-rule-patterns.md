# URL 规则匹配示例

配置文件的 URL 规则只保存一个输入值，应用会从输入前缀和内容推导匹配方式。

## 快速示例

| 输入 | 类型 | 说明 |
| --- | --- | --- |
| `youtube.com` | 域名 | 匹配 `youtube.com`、`www.youtube.com`、`music.youtube.com` |
| `bilibili` | 域名片段 | 匹配 hostname 中独立的 `bilibili` 片段，如 `www.bilibili.com` |
| `*.bilibili.com/video/*` | 通配符 | 匹配 B 站子域名下的 `/video/` 路径 |
| `youtube.com/watch*` | 通配符 | 匹配 YouTube 域名和以 `/watch` 开头的路径 |
| `=https://example.com/watch?v=1` | 精确 | 仅完整 URL 完全一致时匹配 |
| `re:^https://video\\.example/(watch|shorts)/\\d+$` | 正则 | 使用 JavaScript 正则匹配完整 URL |
| `contains:player_state=active` | 包含 | 在完整 URL 文本中查找指定片段 |

## 匹配规则

- 普通域名规则只匹配 URL 的 hostname，不匹配 query、hash 或 redirect 参数里的文本。
- 域名规则带点时按域名边界匹配；`youtube.com` 会匹配 `music.youtube.com`，不会匹配 `notyoutube.com`。
- 域名规则不带点时按 hostname 片段匹配；`bilibili` 会匹配 `www.bilibili.com`。
- 通配符规则目前使用 `*`，可跨越任意字符；`?` 在 URL 中按普通字符处理。
- `re:` 后面的内容会作为 JavaScript 正则表达式编译。无效正则不会匹配，并会在设置界面提示。
- `contains:` 是显式逃生口，适合确实要匹配 query 参数或整段 URL 文本的场景。

## 选择建议

- 常规站点：优先输入域名，例如 `youtube.com`。
- 需要限定路径：使用通配符，例如 `*.example.com/watch/*`。
- 需要完整 URL：使用 `=` 前缀。
- 只有通配符表达不了时再使用 `re:` 正则。

GitHub 页面：<https://github.com/XiiTang/Immersive-Subs-Prompter/blob/main/docs/url-rule-patterns.md>
