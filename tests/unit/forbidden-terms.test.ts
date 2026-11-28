// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { FORBIDDEN_TERMS } from '@/lib/booking-terms'

const ROOT = path.resolve(__dirname, '../..')
const SRC = path.join(ROOT, 'src')

/** 不掃描的檔案：型別檔是資料庫定義，用語表本身列有禁用詞 */
const EXCLUDED = new Set(
  ['src/lib/supabase/types.ts', 'src/lib/booking-terms.ts'].map((p) => path.join(ROOT, p)),
)

function listSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !EXCLUDED.has(full)) {
      files.push(full)
    }
  }
  return files
}

describe('禁用詞掃描（設計文件 §2）', () => {
  it('src/ 底下的程式不得出現舊用語', () => {
    const violations: string[] = []
    for (const file of listSourceFiles(SRC)) {
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/)
      lines.forEach((line, i) => {
        if (FORBIDDEN_TERMS.some((term) => line.includes(term))) {
          const rel = path.relative(ROOT, file).split(path.sep).join('/')
          violations.push(`${rel}:${i + 1}:${line.trim()}`)
        }
      })
    }
    expect(violations, `發現禁用詞：\n${violations.join('\n')}`).toEqual([])
  })
})
