# Dashboard View-Section-Tag Matrix

**Status**: Accepted | **Date**: 2026-04-17 | **Ticket**: #214

## Summary

| Tag | Description | Panels |
|-----|-------------|--------|
| animated-updates | Real-time SSE/streaming data | 6 |
| monitoring | Read-only status display | 6 |
| workflow | Agile baton/ticket/governance | 4 |
| configuration | User-editable settings | 3 |
| inventory | Device/service/resource lists | 4 |
| diagnostics | Health checks, probes, tests | 3 |
| reference | Documentation, help content | 3 |
| analytics | Metrics, usage stats, quotas | 5 |

## Panel Tag Assignments

| Panel | anim | mon | wf | cfg | inv | diag | ref | anl | View |
|-------|:----:|:---:|:--:|:---:|:---:|:----:|:---:|:---:|------|
| Agent Baton | ✅ | | ✅ | | | | | | LIVE |
| Live Activity | ✅ | | | | | | | | LIVE |
| Context Flow | ✅ | ✅ | | | | | | | LIVE |
| Fleet Health Log | ✅ | | | | | ✅ | | | LOGS |
| LLM Router Log | ✅ | | | | | | | | LOGS |
| Ticket Log | ✅ | | ✅ | | | | | | LOGS |
| GitHub Activity | | ✅ | ✅ | | | | | | OPS |
| Quotas | | ✅ | | | | | | ✅ | OPS |
| Task Router | | ✅ | | | | | | ✅ | OPS |
| Governance | | | ✅ | | | | | | OPS |
| LLM Context | | ✅ | | | | | | ✅ | OPS |
| Wiki Health | | ✅ | | | | | | ✅ | OPS |
| Fleet Devices | | | | | ✅ | | | | FLEET |
| Services | | | | | ✅ | | | | FLEET |
| Fleet Resources | | | | ✅ | ✅ | ✅ | | | FLEET |
| Dashboard Config | | | | ✅ | | | | | FLEET |
| Stress Test | | | | | | ✅ | | | FLEET |
| Wiki Metrics | | | | | | | | ✅ | WIKI |
| Research Wiki | | | | | | | ✅ | | WIKI |
| Help Center | | | | | | | ✅ | | HELP |

## Proposed View Layout (7 views, ≤6 panels each)

| View | Nav | Panels | Grid |
|------|-----|--------|------|
| 🔴 LIVE | default | Baton, Activity, Context Flow | 1×3 or 2+1 |
| 📜 LOGS | click | Health Log, Router Log, Ticket Log | 1×3 |
| 📊 OPS | click | GitHub, Quotas, Router, Governance, LLM Context, Wiki Health | 2×3 |
| 🌐 FLEET | click | Devices, Services, Resources, Config, Stress Test | 2×3 |
| 📚 WIKI | click | Metrics, Reader | 1×2 |
| 📘 HELP | click | Help Center | 1×1 full |

## Panel Height Audit

| Panel | Content Type | Scrollable? | Min Useful Height |
|-------|-------------|-------------|-------------------|
| Agent Baton | SVG pipeline | No | 120px |
| Live Activity | Event list | Internal | 150px |
| Context Flow | SVG diagram | No | 200px |
| Fleet Health Log | Timestamped log | Internal | 150px |
| LLM Router Log | Table rows | Internal | 150px |
| Ticket Log | Table rows | Internal | 150px |
| GitHub Activity | Card list | Internal | 140px |
| Quotas | Bar charts | No | 120px |
| Task Router | Lane bars | No | 100px |
| Governance | Status flags | No | 80px |
| LLM Context | Token bars | No | 100px |
| Wiki Health | Stats | No | 80px |
| Fleet Devices | Cards | Internal | 140px |
| Services | Cards | Internal | 140px |
| Fleet Resources | Table | Internal | 200px |
| Dashboard Config | Form | No | 120px |
| Stress Test | Progress bar | No | 100px |
| Wiki Metrics | Stats grid | No | 120px |
| Research Wiki | Article list | Internal | 200px |
| Help Center | Search+list | Internal | 400px |

## Actionable Next Steps

1. Implement responsive CSS grid (#215, #219)
2. Create LIVE and LOGS views (#216)
3. Restructure OPS to 6 panels (#217)
4. Merge Resources+Settings into FLEET (#218)
