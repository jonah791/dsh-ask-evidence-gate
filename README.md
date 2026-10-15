<!--
  DSH 插件生态公约声明（plugin-ecosystem-convention · 组合优先/声明清晰/兼容优先）
  purpose: 上抛前取证闸：调用 ask 类工具时在返回里注入「本会话相关取证 N 次」读数（只送达信号、不拦截，§5.39 机制承载）
  inject: 'tools'
  tools: （无工具 —— 纯行为插件，挂 tools/post-execute）
  runtime: host-only
  envDeps: 无
  boundary: **只追加读数**，永不阻断、永不改判（拦截形态已于 2026-09-16 在本机被证伪）
  compat: cordis ^4.0.1 / dsh-tools >=0.1.0-rc.6
-->
# dsh-ask-evidence-gate

<p align="center">
  <a href="https://github.com/jonah791/dsh-ask-evidence-gate"><img src="https://img.shields.io/badge/version-0.1.0-blue" alt="version"></a>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/TypeScript-3178C6" alt="TypeScript">
  <img src="https://img.shields.io/badge/tests-7%20passed-brightgreen" alt="tests">
</p>

**一句话**：在你**上抛问题之前**，把「本会话查过几次」这个读数送到眼前——**只送信号，不拦截**。

**为什么值得用**：同病三现（2026-09-29 / 10-04 / 10-15 主人批评「为什么老是让我裁决」）——技能 `pending-decision-discipline` 的触发靠**自我识别**（「我要标记一件事为待裁决时」），而**看不见自己在做什么时它根本不进场**。⇒ 缺的不是判据质量，是**一道在执行那一刻必到的信号**（AGENTS.md §5.39「机制承载优先」）。

## 为什么需要

同病三现（2026-09-29 自圈 / 10-04 定调 / 10-15 主人批评「为什么老是让我裁决」）：技能 `pending-decision-discipline` 的触发靠**自我识别**（「我要标记一件事为待裁决时」）——而看不见自己在做什么时它根本不进场（10-15 两次我都不认为自己在「上抛」）。

⇒ 缺的不是判据质量，是**一道在执行那一刻必到的信号**（AGENTS.md §5.39「机制承载优先」）。

## 硬约束：不拦截

本机 2026-09-16 已证伪 `{kind:'ask'}` 拦截形态（`ask` 在审批策略 `never` 下等价于 `deny`，而被拒文案完全看不出是插件所为 ⇒ 上线首夜把「读插件源码」「写文档」自锁两次，并被误读成「有人拒绝了我」）。⇒ 本插件**只追加读数**，永不阻断、永不改判。

**看不看得见归机制，做不做归主体。**

## 配置

| 字段 | 缺省 | 含义 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `tracePath` | `ask-evidence-trace.jsonl` | 侧车轨迹（相对路径 ⇒ 落在 `DSH_HOME` 下） |

## 读数长什么样

- 零取证：`⚠ 取证读数（ask_user_question）：本会话 **0 次**取证类调用（read / grep / recall / 探测）——这条问题发出前，我没有查过任何东西。`
- 有取证：`取证读数（telegram_ask）：本会话 12 次取证类调用（最近一次在 3 次调用之前）。`

两态**必须**长得不一样——若它们同貌，这个读数就抓不到「没查就上抛」那一类（§5.9 规则 2：恒为空的输出不是证据）。

## 边界（诚实声明）

- **代理量而非真值**：机器只能数「哪些工具被调了」，不能判断「这些调用算不算相关取证」⇒ 读数**列出工具名**，判断归主体。
- **只覆盖 ask 类**：其他「把人拉进来」的路径（如表单类提交）不在范围内。
- 会话键取 `session.id`，拿不到时归 `'default'`（与 `dsh-prompt-defense` 同款）。
- 侧车写入失败**吞错不阻断**（观测不反噬主流程 §5.22 规则 3）。

## 测试

`npm test`（7 例：计数语义 / 间隔三态 / 两态不许同貌 / 无劝阻词 / 侧车格式 / 集合互斥）。

## 快速开始

**1) 装依赖**：

```jsonc
"dsh-ask-evidence-gate": "link:E:/alice/self-plugins/dsh-ask-evidence-gate"
```

**2) 挂组合**：

```yaml
- id: ask-evidence-gate
  name: dsh-ask-evidence-gate
  config:
    enabled: true
```

**3) 30 秒验证**：先**不查任何东西**直接调一次 `ask_user_question` → 返回体末尾应出现「本会话 **0 次**取证类调用」的 ⚠ 提示；再用 `read` / `grep` / `recall` 查几次后调一次 `telegram_ask` → 应出现「本会话 12 次取证类调用（最近一次在 3 次调用之前）」。⚠ **两态必须长得不一样**。

## 落盘与自证

| 文件 | 何时写 | 内容 |
|---|---|---|
| `${DSH_HOME}/ask-evidence-trace.jsonl` | 每次 ask 类调用 | 会话 id / 取证计数 / 间隔档位 / 命中的工具名 |

**一条命令答五问**：`tail -3 "$DSH_HOME/ask-evidence-trace.jsonl"` → ① 构建 ② 会话 ③ 计数与间隔 ④ 列出的工具名 ⑤ 时间。

## 生效判据与回退

**判据**：**两态可分辨**——零取证那次必须带 ⚠ 且措辞与有取证那次不同（若两态同貌，本读数就抓不到「没查就上抛」那一类）。
**回退**：① `git revert` + 重建 + 预检重启；② `config.enabled: false`；③ patch 行 `disabled: true`。侧车是独立文件，停用不影响历史。

## 设计要点

- **只追加读数，永不拦截**：本机 2026-09-16 已**证伪** `{kind:'ask'}` 拦截形态（`ask` 在审批策略 `never` 下等价于 `deny`，被拒文案看不出是插件所为 ⇒ 上线首夜把「读插件源码」「写文档」**自锁两次**，并被误读成「有人拒绝了我」）。**看不看得见归机制，做不做归主体。**
- **两态不许同貌**：零取证与有取证若长得一样，这个读数就抓不到它要抓的那一类（§5.9 规则 2：**恒为空的输出不是证据**）。
- **代理量而非真值**：机器只能数「哪些工具被调了」，**不能判断「算不算相关取证」** ⇒ 读数**列出工具名**，判断归主体。
- **观测不反噬**：侧车写入失败**吞错不阻断**（§5.22 规则 3）。

## 相关文档

- ⚠ **本插件暂无 `semantic.md`**（未建语义文档）——契约以上面各节与源码为准；补文档是待办。
- 中心仓：[alice-digital-life](https://github.com/jonah791/alice-digital-life)（本插件归 **认知层**）
- 相关技能：`pending-decision-discipline`（请示边界的三层决策结构化）

## License

MIT © jonah791

---

本插件属于**爱丽丝 DSH 自研插件生态**（[alice-digital-life](https://github.com/jonah791/alice-digital-life) · 73 个插件 · 8 个模块）：单一职责、独立仓库、独立可用。
