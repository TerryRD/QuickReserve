import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import zxcvbnCommonPackage from '@zxcvbn-ts/language-common'

// Initialize once at module load (idempotent if reimported).
// We only read result.score, not result.feedback — translations omitted.
zxcvbnOptions.setOptions({
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: { ...zxcvbnCommonPackage.dictionary },
})

// zxcvbn returns a score 0–4: 0 = trivially guessable, 4 = very strong.
// We accept ≥2: "somewhat guessable; protection from unthrottled online attacks."
// Stricter than score≥3 would reject reasonable passphrases like "MyDog2024!".
// Looser would let "password" / "12345678" / "qwerty" / keyboard runs through.
const MIN_SCORE = 2

export function checkPasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4
  ok: boolean
} {
  const result = zxcvbn(password)
  return { score: result.score, ok: result.score >= MIN_SCORE }
}
