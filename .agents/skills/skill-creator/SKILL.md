---
name: skill-creator
description: >-
  Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

At a high level, the process of creating a skill goes like this:

1. Decide what you want the skill to do and roughly how it should do it.
2. Write a draft of the skill.
3. Create a few test prompts and run evaluations with access to the skill.
4. Help the user evaluate the results both qualitatively and quantitatively.
5. While runs happen in the background, draft quantitative evals if there aren't any.
6. Use the `eval-viewer/generate_review.py` script to show the user the results.
7. Rewrite the skill based on feedback and benchmarking.
8. Repeat until satisfied.
9. Expand the test set and try again at a larger scale.

## Communicating with the User
Pay attention to context cues to understand how to phrase your communication:
- "evaluation" and "benchmark" are acceptable terms.
- For technical jargon like "JSON" and "assertion", check if the user is familiar with them, or briefly explain them.

## Creating a Skill

### 1. Capture Intent
Start by understanding the user's intent:
- What should this skill enable the assistant to do?
- When should this skill trigger? (what user phrases/contexts)
- What's the expected output format?
- Should we set up test cases to verify the skill works?

### 2. Interview and Research
Proactively ask questions about edge cases, input/output formats, example files, success criteria, and dependencies.

### 3. Write the SKILL.md
Every generated `SKILL.md` must follow this structure:
```markdown
---
name: {skill-name}
description: >-
  {description}
---

# {Skill Title}

## Overview
{Brief description of what the skill does.}

## Dependencies
{List of required skills, if any.}

## Quick Start
{Minimal example to get started.}

## Utility Scripts (if CLI-based)
{Document each subcommand with examples.}

## Workflow (if instruction-only)
{Numbered steps with clear instructions.}

## Rate Limiting (if applicable)
{Document rate limits and how they are enforced.}

## Common Mistakes
{List 2-3 common pitfalls.}
```

### 4. Test Cases
Save test cases to `evals/evals.json` in the following format:
```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result",
      "files": []
    }
  ]
}
```

### 5. Running and Evaluating Test Cases
1. **Spawn Runs**: Run tests and baseline configurations.
2. **Draft Assertions**: While runs are in progress, draft quantitative assertions.
3. **Capture Timing**: Save execution duration and tokens used to `timing.json`.
4. **Grade and Benchmark**: Grade each run and aggregate results into `benchmark.json` and `benchmark.md`.
5. **Launch Viewer**: Start the evaluation viewer helper.

### 6. Description Optimization
Optimize the description in frontmatter to improve triggering accuracy by generating both trigger and non-trigger eval queries.
