# TODO

## 项目审查发现

> 记录时间：2026-05-29
> 范围：全项目静态审查；重点查找逻辑问题、过度设计、冗余补丁、不必要 fallback / try / 兜底、迁移层、兼容层和旧代码判断层。

### P2

- [ ] 校验 network endpoint id 唯一性
  - 文件：
    - `apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.ts`
    - `apps/desktop-app/src/main/connectionManager.ts`
  - 问题：sanitizer 只按 `host:port` 去重，不保证 endpoint `id` 唯一；但 connection manager 用 `id` 作为 listener map key。重复 id 会导致监听器互相覆盖。
  - 建议：项目未上线，直接拒绝重复 id；不需要做历史数据兼容或迁移。
