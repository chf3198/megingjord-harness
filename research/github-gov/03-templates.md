# Issue & PR Templates

## Issue Templates (Markdown)

Place in `.github/ISSUE_TEMPLATE/`:

**config.yml** controls template chooser:
```yaml
blank_issues_enabled: false  # Force template use
contact_links:
  - name: Support
    url: https://example.com/support
    about: Get help here
```

## Issue Forms (YAML — Recommended)

YAML-based forms with validation, structured fields:
```yaml
name: Bug Report
description: Report a bug
title: "[Bug]: "
labels: ["bug", "triage"]
assignees: ["username"]
body:
  - type: input
    id: version
    attributes:
      label: Version
    validations:
      required: true
  - type: dropdown
    id: severity
    attributes:
      label: Severity
      options: [Critical, High, Medium, Low]
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: Description
    validations:
      required: true
  - type: checkboxes
    id: terms
    attributes:
      label: Acknowledgments
      options:
        - label: I searched existing issues
          required: true
```

**Field types:** input, textarea, dropdown, checkboxes, markdown

**Governance value:**
- `blank_issues_enabled: false` forces structured intake
- Required fields enforce completeness
- Labels and assignees auto-applied on creation
- Title prefixes standardize naming

## PR Templates

Single file: `.github/pull_request_template.md`
Multiple: `.github/PULL_REQUEST_TEMPLATE/` directory
- Markdown only (no form-based PR templates)
- Content pre-fills PR body for consistent format
