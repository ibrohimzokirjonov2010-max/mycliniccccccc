# Rule: Zero-Regression Policy (Bug Regression Prevention Qoidasi)

Always prevent regressions by checking previously solved issues in the regression registry before modifying any code, and logging newly solved issues immediately upon completion.

## Constraints & Requirements

1. **Check Registry BEFORE Writing Code**:
   - BEFORE proposing or writing any modifications to source code, configurations, database schemas, API routes, or environment files, you MUST check and read [.agents/regression-registry.md](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/.agents/regression-registry.md).
   - If there is an entry related to the component/file you are modifying (e.g., payments, auth, appointments, treatment plans), you must read its "Qaytalamaslik choralari" (Prevention measures) and verify your changes adhere strictly to them.

2. **Register Fixed Bugs IMMEDIATELY**:
   - AFTER resolving any bug, issue, logic error, or translation mismatch, you MUST document the fix immediately in [.agents/regression-registry.md](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/.agents/regression-registry.md).
   - Never close a task, notify the user of completion, or ask for verification without registering the fix first.

3. **Safeguard Payment & Authorization Logic**:
   - Never simplify or refactor code in ways that remove safety boundaries (try-catch, authorization checks, clinic tenant isolation validation, Stripe hooks signatures).
   - Any refactoring on components with entries in the registry must preserve all previous bug resolutions.
