/**
 * gate.ts — 取证计数与读数文案的**纯函数层**（无 IO、无 ctx、无 Date.now：时间与数据全部注入）。
 *
 * 为什么抽出来（§5.34 可重构性）：判据（「上抛前有没有查过」）必须能离线证伪——
 * 埋在 `apply()` 闭包里的判据，错了不报错、改起来要起整个宿主。
 *
 * 设计纪律（2026-10-15 · t-40f32fca）：
 * - **只报事实，不劝阻**：读数说「查了几次」，不说「你该先查」（§2.4 判断不可代填）。
 * - **零取证与有取证不许同貌**：两态长得一样 = 读数没有分辨力（§5.9 规则 2）。
 * - **不拦截**：本插件永远不阻断工具调用（本机 2026-09-16 已证伪 `{kind:'ask'}` 拦截形态）。
 */

/**
 * 取证类工具：读 / 搜 / 检索 / 探测——它们的调用次数是「我查过没有」的**可计算代理**。
 *
 * ⚠ 这是代理量而非真值：真正的「取证」是语义概念，机器只能数调用。故读数文案里
 * **必须列出工具名**（让读者自己判断这些调用算不算相关取证），而不是替我下结论。
 */
export const EVIDENCE_TOOLS: ReadonlySet<string> = new Set([
  'read', 'read_image',
  'grep', 'glob', 'ops_grep', 'ops_glob', 'ops_inspect_local_file',
  'recall', 'memory_browse', 'memory_audit', 'memory_relate', 'memory_stats',
  'code_search', 'code_locate', 'code_symbols', 'code_impact', 'code_test_gate',
  'search_web', 'search_deep', 'fetch_page', 'fetch_robust', 'web_search',
  'skill', 'skill_signals', 'skill_extract',
  'plugin_list', 'plugin_inspect', 'plugin_audit', 'plugin_boot_status',
  'taskboard_show', 'taskboard_list', 'taskboard_status',
  'context_health', 'context_marks',
  'life_core_status', 'evolution_status', 'rewrite_status', 'memory_health',
  'job_output', 'job_list', 'sidecar_health', 'preflight_check',
])

/** ask 类工具：会把人拉进来做决策的入口（本插件只观测它们，不修改它们的行为）。 */
export const ASK_TOOLS: ReadonlySet<string> = new Set(['ask_user_question', 'telegram_ask'])

/** 滚动累计器（**纯数据**；`recordToolCall` 返回新状态，不就地改）。 */
export interface CounterState {
  /** 本会话累计的取证类调用次数 */
  readonly evidenceCalls: number
  /** 本会话累计的工具调用次数 */
  readonly totalCalls: number
  /** 距上一次取证调用隔了几次工具调用；`null` = 本会话还没有过取证调用 */
  readonly sinceLastEvidence: number | null
}

export const EMPTY_COUNTER: CounterState = { evidenceCalls: 0, totalCalls: 0, sinceLastEvidence: null }

/**
 * 记一次工具调用。
 * @param state - 当前累计器。
 * @param toolName - 被调用的工具名。
 * @returns 新累计器（取证类刷新 `sinceLastEvidence` 为 0，否则 +1）。
 */
export function recordToolCall(state: CounterState, toolName: string): CounterState {
  const totalCalls = state.totalCalls + 1
  if (EVIDENCE_TOOLS.has(toolName)) {
    return { evidenceCalls: state.evidenceCalls + 1, totalCalls, sinceLastEvidence: 0 }
  }
  const prev = state.sinceLastEvidence
  return { evidenceCalls: state.evidenceCalls, totalCalls, sinceLastEvidence: prev === null ? null : prev + 1 }
}

/**
 * 上抛前的取证读数（**只报事实**）。
 *
 * 两态**必须**长得不一样——这是本读数存在的全部意义：
 * - 零取证 ⇒ 明说「发出前没有查过任何东西」（`⚠` 开头）；
 * - 有取证 ⇒ 报次数 + 最近一次距今几次调用。
 * @param toolName - 正在被调用的 ask 工具名。
 * @param state - 该会话的累计器。
 * @returns 一行读数（不含换行）。
 */
export function evidenceLine(toolName: string, state: CounterState): string {
  const head = '取证读数（' + toolName + '）：本会话 '
  if (state.evidenceCalls === 0) {
    return '⚠ ' + head + '**0 次**取证类调用（read / grep / recall / 探测）'
      + '——这条问题发出前，我没有查过任何东西。'
  }
  const gap = state.sinceLastEvidence === null
    ? '（最近一次取证距现在无法计算）'
    : state.sinceLastEvidence === 0
      ? '（最近一次取证就是上一次调用）'
      : '（最近一次取证在 ' + String(state.sinceLastEvidence) + ' 次调用之前）'
  return head + String(state.evidenceCalls) + ' 次取证类调用' + gap + '。'
}

/** 侧车轨迹行（一行一事件，append-only；§5.22 机制自证）。 */
export interface TraceLine {
  readonly at: string
  readonly phase: 'ask-observed' | 'error'
  readonly sessionId: string
  readonly tool: string
  readonly evidenceCalls?: number
  readonly sinceLastEvidence?: number | null
  readonly note?: string
}

/** 序列化一行轨迹（纯函数：时间由调用方给）。 */
export function formatTraceLine(line: TraceLine): string {
  return JSON.stringify(line) + '\n'
}
