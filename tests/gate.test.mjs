/**
 * tests/gate.test.mjs — 取证计数与读数文案的回归测试（跑 lib 产物，与运行时同源）。
 *
 * 判据的核心是**分辨力**：零取证与有取证两态不许同貌——若它们长得一样，
 * 这个读数就抓不到「没查就上抛」那一类（§5.9 规则 2：恒为空的输出不是证据）。
 * 跑法：node --test tests/gate.test.mjs（先 tsc -p tsconfig.json 构建）
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ASK_TOOLS, EVIDENCE_TOOLS, EMPTY_COUNTER, evidenceLine, formatTraceLine, recordToolCall,
} from '../lib/gate.js'

test('recordToolCall：取证类累加并刷新间隔；非取证类只累加总数', () => {
  let s = EMPTY_COUNTER
  assert.deepEqual(s, { evidenceCalls: 0, totalCalls: 0, sinceLastEvidence: null })
  s = recordToolCall(s, 'read')
  assert.equal(s.evidenceCalls, 1)
  assert.equal(s.sinceLastEvidence, 0)
  s = recordToolCall(s, 'plugin_mount')
  assert.equal(s.evidenceCalls, 1, '非取证类不该增加取证计数')
  assert.equal(s.totalCalls, 2)
  assert.equal(s.sinceLastEvidence, 1, '间隔要 +1')
  s = recordToolCall(s, 'grep')
  assert.equal(s.evidenceCalls, 2)
  assert.equal(s.sinceLastEvidence, 0, '取证类刷新间隔为 0')
})

test('间隔在「还没有过取证」时保持 null（不是 0——0 是「刚查过」）', () => {
  let s = EMPTY_COUNTER
  s = recordToolCall(s, 'plugin_mount')
  s = recordToolCall(s, 'plugin_mount')
  assert.equal(s.sinceLastEvidence, null, '「从未查过」与「刚查过」是两件事')
  assert.equal(s.totalCalls, 2, '总数照常累计')
})

test('★ 尸体：零取证与有取证两态**不许同貌**（读数的分辨力）', () => {
  const zero = evidenceLine('ask_user_question', EMPTY_COUNTER)
  const some = evidenceLine('ask_user_question', recordToolCall(EMPTY_COUNTER, 'read'))
  assert.notEqual(zero, some, '两态文案相同 = 读数没有分辨力')
  assert.match(zero, /0 次/, '零取证必须明说 0 次')
  assert.match(zero, /没有查过任何东西/, '零取证必须明说没查过')
  assert.ok(zero.startsWith('⚠'), '零取证要显眼（⚠ 开头）')
  assert.ok(!some.startsWith('⚠'), '有取证不该用同样的警示形态（否则两者同貌）')
  assert.match(some, /1 次/)
})

test('尸体：零取证文案不得出现「劝阻」措辞（只报事实，判断不可代填）', () => {
  const zero = evidenceLine('telegram_ask', EMPTY_COUNTER)
  for (const banned of ['应该', '必须', '建议', '请先', '不该']) {
    assert.ok(!zero.includes(banned), '读数里出现了劝阻词: ' + banned)
  }
})

test('间隔文案三态（0 / N / 未计算）互不相同', () => {
  const a = evidenceLine('telegram_ask', recordToolCall(EMPTY_COUNTER, 'read'))
  const b = evidenceLine('telegram_ask', recordToolCall(recordToolCall(EMPTY_COUNTER, 'read'), 'plugin_mount'))
  assert.match(a, /就是上一次调用/)
  assert.match(b, /1 次调用之前/)
  assert.notEqual(a, b)
})

test('formatTraceLine：输出单行合法 JSON（append-only 侧车的格式契约）', () => {
  const line = formatTraceLine({
    at: '2026-10-15T00:00:00.000Z', phase: 'ask-observed', sessionId: 's1',
    tool: 'telegram_ask', evidenceCalls: 3, sinceLastEvidence: 1,
  })
  assert.ok(line.endsWith('\n'))
  const parsed = JSON.parse(line.trim())
  assert.equal(parsed.phase, 'ask-observed')
  assert.equal(parsed.evidenceCalls, 3)
  assert.equal(parsed.tool, 'telegram_ask')
})

test('集合非空且互斥（ask 工具不该被算成取证工具——否则上抛会刷新读数，自指污染）', () => {
  assert.ok(EVIDENCE_TOOLS.size > 10, '取证集合太小，判据会漏')
  assert.equal(ASK_TOOLS.size, 2)
  for (const t of ASK_TOOLS) assert.ok(!EVIDENCE_TOOLS.has(t), t + ' 同时在两个集合里 ⇒ 自指')
})
