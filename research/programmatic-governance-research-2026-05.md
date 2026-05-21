# Deliverable 2 — 2026 cutting-edge research on cross-model governance consistency

Phase-0 ticket: #2038. Parent Epic: #2037.

## Research scope

How do other 2026 production systems guarantee governance-artifact consistency across models of differing capabilities and intelligence? Survey 10 sources spanning architecture, framework, and empirical research.

## Section 1 — Compiled-AI / template-rendering architecture

### 1.1 Compiled AI: Deterministic Code Generation for LLM-Based Workflow Automation (arxiv 2604.05150, 2026)

Core thesis: constrain LLM generation to narrow business-logic functions embedded in validated templates. Trades runtime flexibility for predictability, auditability, cost efficiency, and reduced security exposure. The LLM is the high-level planner; the deterministic renderer is the low-level assembler.

Applicability to harness: baton-handoff artifacts are exactly the "narrow business-logic functions embedded in validated templates" case. The LLM plans the per-ticket content; the template renders the canonical structure.

Source: [arxiv.org/pdf/2604.05150](https://arxiv.org/pdf/2604.05150)

### 1.2 Portal UX Agent — Plug-and-Play Engine for Rendering UIs from Natural Language (arxiv 2511.00843)

Core thesis: separate high-level planning (LLM) from low-level assembly (deterministic renderer) — like model-driven architecture (MDA). Persistent tension between expressivity and governance: unconstrained code generation is flexible but brittle; fully static is reliable but rigid.

Applicability: this is precisely the design choice for baton artifacts — Manager scope is a "natural language specification"; the deterministic renderer assembles the canonical MANAGER_HANDOFF text.

Source: [arxiv.org/pdf/2511.00843](https://arxiv.org/pdf/2511.00843)

### 1.3 LLMOps vs DevOps: Artifact management for LLMs (Cloudsmith 2026)

Core thesis: traditional DevOps was built for deterministic systems; LLM pipelines are probabilistic. LLMOps artifact management must handle probabilistic assets like prompts, embeddings, and fine-tuned models. This requires specialized LLM pipeline management for system traceability and trust.

Applicability: the harness is in a hybrid state — most CI gates are deterministic (DevOps-grade) but baton-artifact generation is probabilistic (LLMOps-grade). Currently treating both as if they were one. The right model: artifacts are ARTIFACTS (DevOps-grade build-from-input) even when their content draws on LLM judgment.

Source: [cloudsmith.com/blog/llmops-vs-devops-what-llmops-means-for-artifact-management](https://cloudsmith.com/blog/llmops-vs-devops-what-llmops-means-for-artifact-management)

### 1.4 AI Deployment in 2026: CI/CD for LLMs & Agents (Harness.io blog, 2026)

Core thesis: AI stack is multi-layered and non-deterministic. Traditional CI/CD was designed for deterministic systems; LLM pipelines are probabilistic — same prompt → different outputs. Production AI deployment requires combining deterministic pipeline steps with structured LLM-output validation at every junction.

Applicability: our megalint validators are exactly this pattern. Promoting more artifact construction to deterministic + validating LLM-judgment slots at the schema layer matches industry direction.

Source: [harness.io/blog/ai-deployment-in-production-orchestrate-llms-rag-agents](https://www.harness.io/blog/ai-deployment-in-production-orchestrate-llms-rag-agents)

## Section 2 — Structured-output frameworks

### 2.1 PydanticAI (Python) — best-of-breed structured output validation

Core mechanism: Pydantic builds the JSON Schema that tells the LLM how to return data, and validates the data at run completion. JSON Schema is a specification defining structure + validation rules. With structured outputs enabled, the model **physically cannot produce tokens that violate your schema**.

Direct quote (from search results): "PydanticAI wins unambiguously for structured output validation."

Applicability: a Python (hooks/scripts/*) tooling layer could enforce JSON Schema on the LLM's structured input to the baton-comment-build template. The template then renders deterministic Markdown from validated JSON.

Source: [ai.pydantic.dev](https://ai.pydantic.dev/)

### 2.2 LangGraph — structured tool-call workflows

Core mechanism: every node execution, state transition, LLM call, and conditional edge decision becomes a structured trace entry. For multi-agent workflows with ≥10 nodes, observability is non-optional.

Applicability: the baton itself IS a multi-node workflow (Manager → Collaborator → Admin → Consultant + handoffs). LangGraph patterns offer a model for state-machine-driven baton execution where each transition is observable.

Source: [medium.com/@shuv.sdr/langgraph-structuring-llm-tool-calls-with-pydantic-and-json-serialization](https://medium.com/@shuv.sdr/langgraph-structuring-llm-tool-calls-with-pydantic-and-json-serialization-1715f7a0c2e0)

### 2.3 Production pattern: PydanticAI + LangGraph composed

Recommended 2026 production pattern: PydanticAI defines individual agent behaviors with type-safe inputs + validated structured outputs; LangGraph routes these as nodes in a workflow with state management + routing.

Applicability: maps onto baton roles as PydanticAI agents (each role has typed input + validated output) routed by a LangGraph workflow (baton sequence). This is the architectural template Phase-1 could adopt for the Python-side governance hooks.

Source: [aiagentskit.com/blog/pydantic-ai-vs-langchain-vs-langgraph](https://aiagentskit.com/blog/pydantic-ai-vs-langchain-vs-langgraph/)

## Section 3 — Cross-team workflow standardization

### 3.1 GitHub Actions Composite Actions + Reusable Workflows (GitHub Docs + 2026 community articles)

Core mechanism: bundle workflow steps into reusable units; share across all private repos in an Org. Composite actions = step bundling. Reusable workflows = entire pipelines shared.

Applicability: the harness already uses this pattern for some CI gates. Promote baton-artifact-build into a composite action callable from each runtime's deploy script. Same input → same output across CC / Copilot / Codex.

Sources:
- [docs.github.com/actions/creating-actions/creating-a-composite-action](https://docs.github.com/actions/creating-actions/creating-a-composite-action)
- [dev.to/hkhelil/github-actions-composite-vs-reusable-workflows](https://dev.to/hkhelil/github-actions-composite-vs-reusable-workflows-4bih)

### 3.2 Composite actions for governance standardization at scale

Production guidance (Medium, Jan 2026): composite actions are "perfect for standardizing common workflows across your organization." Best practice: extract common patterns, version them, document inputs/outputs, start with local actions, graduate to shared repos.

Applicability: the harness's `baton-comment-build.js` is the local-action stage. Phase-1 candidate: graduate it to a shared composite action with full input schema + per-runtime testing.

Source: [medium.com/@ivan.claudio/the-holy-grail-of-automation-composite-actions-reusable-workflows-and-github-wide](https://medium.com/@ivan.claudio/the-holy-grail-of-automation-composite-actions-reusable-workflows-and-github-wide-0c18824e7a96)

## Section 4 — Self-bias and adversarial review research

### 4.1 LLM Evaluators Recognize and Favor Their Own Generations (arxiv 2404.13076)

Core finding: **linear correlation between self-recognition capability and self-preference bias**. Self-recognition interferes with unbiased evaluation. Implication: a single-model rater of its own work systematically inflates scores.

Applicability: the harness's CONSULTANT_CLOSEOUT is rated by the same model that wrote the implementation. The deterministic rubric v3 (#1967) mitigates by reducing judgment surface — but the *narrative slots* still benefit from cross-family adversarial review (validates Epic #2041 — the new red-team integration Epic).

Source: [arxiv.org/pdf/2404.13076](https://arxiv.org/pdf/2404.13076)

### 4.2 Constitutional AI critique-and-revise (arxiv 2212.08073 + 2504.04918)

Core mechanism: model generates response; model critiques response against a constitution; model revises. Iterative reduces harmfulness. **Generating critiques improves harmlessness compared to direct revisions.**

Applicability: the iterative-red-team protocol (Epic #2041) is a Constitutional-AI-style critique-and-revise loop, but with a CROSS-FAMILY critic to avoid self-bias.

Sources:
- [arxiv.org/pdf/2212.08073](https://arxiv.org/pdf/2212.08073)
- [arxiv.org/html/2504.04918v1](https://arxiv.org/html/2504.04918v1)

### 4.3 Risk of model-collapse via recursive RL-AIF (arxiv 2604.17769)

Core warning: reinforcement learning from AI feedback (RL-AIF) may lead to model collapse — degenerative loops when training on recursively generated data.

Applicability: caution against using one fleet model's red-team output to train another model. Our use is point-in-time governance review, not training feedback — so this risk doesn't apply directly. But Phase-1 must NOT auto-feed red-team verdicts into model fine-tuning.

Source: [arxiv.org/html/2604.17769](https://arxiv.org/html/2604.17769)

## Section 5 — LLM evaluation frameworks (production tooling)

### 5.1 RAGAS, TruLens, DeepEval — production LLM evaluation (atlan.com 2026 comparison)

Production-grade LLM evaluation tooling exists. DeepEval offers >40 metrics; RAGAS focuses on RAG; TruLens focuses on observability. All three offer structured-output comparison + regression detection.

Applicability: the harness's `tests/eval/` directory is the right place for adopted patterns. Phase-1 candidate: replay-eval harness for baton-artifact output drift detection (does the same input produce the same output across models / over time?).

Source: [atlan.com/know/llm-evaluation-frameworks-compared](https://atlan.com/know/llm-evaluation-frameworks-compared/)

## Synthesis: the 5 design principles for Phase-1

From the 10 sources, 5 design principles emerge that should anchor the Phase-1 plan:

1. **Separation of planning + assembly** — LLM authors the per-ticket data; deterministic template renders the canonical artifact.
2. **JSON Schema validation at the boundary** — structured input must validate before template render; structured output must validate before comment post.
3. **Reusable composite action** — Phase-1 ships builder logic as a shared composite action callable from all 3 runtimes.
4. **Cross-family adversarial review** — for governance-quality grading, use a different-family rater (Constitutional-AI-style critique-and-revise across families).
5. **Replay-eval calibration** — programmatic-vs-LLM-generated parity tracked via replay corpus, not calendar-day soak.

## References (10 cited)

1. Compiled AI deterministic codegen (arxiv 2604.05150)
2. Portal UX Agent planning-assembly separation (arxiv 2511.00843)
3. LLMOps artifact management (Cloudsmith 2026)
4. Harness.io AI deployment CI/CD 2026
5. PydanticAI structured-output (pydantic.dev)
6. LangGraph state-machine workflows (Medium 2026)
7. PydanticAI+LangGraph production composition (aiagentskit.com 2026)
8. GitHub Actions composite actions (docs.github.com + dev.to 2026)
9. LLM self-bias evaluators (arxiv 2404.13076)
10. Constitutional AI critique-and-revise (arxiv 2212.08073 + 2504.04918)

Bonus: 11. LLM evaluation frameworks (atlan.com 2026); 12. RL-AIF model collapse warning (arxiv 2604.17769)
