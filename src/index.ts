/**
 * dsh-ask-evidence-gate · 插件主体
 *
 * 上抛前取证闸（t-40f32fca · §5.39 机制承载）：
 * 调用 ask 类工具（`ask_user_question` / `telegram_ask`）时，在**返回体末尾**追加一行事实读数——
 * 「本会话相关取证调用 N 次 + 最近一次距今几次调用」。
 *
 * 为什么需要（同病三现：09-29 自圈 / 10-04 定调 / 10-15 主人批评「为什么老是让我裁决」）：
 * 技能 `pending-decision-discipline` 的触发靠**自我识别**（「我要标记一件事为待裁决时」）——
 * 而看不见自己在做什么时它根本不进场（10-15 两次我都不认为自己在「上抛」）。
 * ⇒ 缺的不是判据质量，是**一道在执行那一刻必到的信号**（§5.39：信号走 `tools/post-execute`）。
 *
 * **硬约束（不拦截）**：本机 2026-09-16 已证伪 `{kind:'ask'}` 拦截形态（自锁两次 + 拒文看不出
 * 是插件所为 ⇒ 被误读成「有人拒绝了我」）。⇒ 本插件**只追加读数**，永不阻断、永不改判。
 * **看不看得见归机制，做不做归主体。**
 */
import { appendFileSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// 副作用 type import：让 dsh-tools 的 declare module 生效——`tools/post-execute` 的类型来源。
// ⚠ 缺它时 tsc 报 TS2345（"tools/post-execute" not assignable to keyof Events）+ 三个隐式 any，
// 与 `dsh-agent-plugin-manager` 的同款用法（它 import 了 defineTool 所以隐式拥有）。
import type {} from '@deepseek-ai/dsh-tools'
import {
  ASK_TOOLS, EMPTY_COUNTER, evidenceLine, formatTraceLine, recordToolCall,
  type CounterState, type TraceLine,
} from './gate.ts'

export const name = 'agent-ask-evidence-gate'
export const inject = ['tools'] as const

export interface Config {
  enabled: boolean
  /** 侧车轨迹路径（相对路径 ⇒ 落在 DSH_HOME 下） */
  tracePath: string
}

export const Config = z.object({
  enabled: z.boolean().default(true),
  tracePath: z.string().default('ask-evidence-trace.jsonl'),
})

/** 最小文本块类型（只用到 text 变体；不为此新增 `dsh-llm` peer 依赖）。 */
type TextBlock = { type: 'text'; text: string }

/** 给结果块**末尾**追加一行读数（其余块保持原序）。 */
function appendLine(blocks: unknown, line: string): unknown[] {
  const list: unknown[] = Array.isArray(blocks) ? blocks : []
  const block: TextBlock = { type: 'text', text: line }
  return [...list, block]
}

/**
 * 挂载取证闸。
 * @param ctx - cordis 上下文（已声明 `tools` 注入）。
 * @param config - 插件配置。
 */
export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  const log = ctx.logger('dsh-ask-evidence-gate')

  /** 解析侧车绝对路径（找不到 DSH_HOME 就退回相对路径，仍不抛）。 */
  const resolveTrace = (): string => {
    if (config.tracePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(config.tracePath)) return config.tracePath
    const home = process.env.DSH_HOME
    return home !== undefined && home !== '' ? home.replace(/[\\/]+$/, '') + '/' + config.tracePath : config.tracePath
  }
  const tracePath = resolveTrace()

  /** 落盘一行轨迹——**吞错返回 bool**（观测绝不反噬主流程 §5.22 规则 3）。 */
  const trace = (line: TraceLine): boolean => {
    try {
      appendFileSync(tracePath, formatTraceLine(line), 'utf8')
      return true
    } catch (error) {
      log.warn('侧车写入失败（已吞，不影响主流程）: ' + String(error))
      return false
    }
  }

  /** 会话键（拿不到 session.id ⇒ `'default'`，与 dsh-prompt-defense 同款）。 */
  const keyOf = (exec: { agent?: unknown }): string => {
    const agent = exec.agent as { session?: { id?: unknown } } | undefined
    const id = agent?.session?.id
    return typeof id === 'string' && id.length > 0 ? id : 'default'
  }

  const counters = new Map<string, CounterState>()

  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    try {
      const key = keyOf(exec)
      // 先记账：本次调用也计入。⚠ ask 类**自己不计**——否则「上抛」会刷新读数，自指污染。
      if (!ASK_TOOLS.has(exec.name)) {
        counters.set(key, recordToolCall(counters.get(key) ?? EMPTY_COUNTER, exec.name))
        return decision
      }
      if (decision.kind !== 'accept') return decision
      const state = counters.get(key) ?? EMPTY_COUNTER
      trace({
        at: new Date().toISOString(), phase: 'ask-observed', sessionId: key, tool: exec.name,
        evidenceCalls: state.evidenceCalls, sinceLastEvidence: state.sinceLastEvidence,
      })
      const blocks = (decision as { content?: unknown }).content ?? (result as { content?: unknown }).content
      // 只重建 accept/content 变体（与 dsh-prompt-defense 同款：accept 的 union 要求 value/content 互斥，
      // 展开 decision 会把 value 一起带过来 ⇒ 这里显式构造干净形状）。
      return { kind: 'accept', content: appendLine(blocks, evidenceLine(exec.name, state)) } as typeof decision
    } catch (error) {
      // 观测绝不反噬：任何异常都原样放行（§5.24 逃逸异常会杀死宿主）
      trace({ at: new Date().toISOString(), phase: 'error', sessionId: keyOf(exec), tool: exec.name, note: String(error) })
      return decision
    }
  })
}
