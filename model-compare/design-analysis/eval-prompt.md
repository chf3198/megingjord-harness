You are evaluating an LLM's analysis quality for the Devenv-Ops LLM Evaluation Matrix.
Respond with a single JSON object exactly matching the schema below (no surrounding text):

{
  "clarity": number,    // 0-10 clarity of explanation
  "accuracy": number,   // 0-10 factual correctness and technical accuracy
  "security": number,   // 0-10 identification of security/privacy concerns
  "ux": number,         // 0-10 evaluation of UX/operational readiness
  "notes": string       // 1-2 short sentences supporting the scores
}

Context: Use the repository's `model-compare/design-analysis` artifacts as background. Score conservatively and justify briefly in `notes`.

Evaluation instructions:
- Use integers 0-10 for scores.
- Be succinct in `notes` and state any major caveats (e.g., hallucination risk, missing evidence).
- Avoid mentioning internal repo secrets or keys.

End of prompt.
