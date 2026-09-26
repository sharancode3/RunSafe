======================================================================
RUNSAFE — CANONICAL MASTER PROJECT CONTEXT
READ-ONLY PRODUCT CONTEXT / SOURCE OF TRUTH
======================================================================

IMPORTANT INSTRUCTION TO THE AGENT
----------------------------------

You are working on a hackathon project named:

RUNSAFE

This document is the CANONICAL PRODUCT CONTEXT and must be treated as the
single source of truth for the project idea, requirements, architecture,
scope, product philosophy, differentiators, technology direction, safety
boundaries, implementation roadmap, and demo strategy.

DO NOT casually redesign the project.
DO NOT replace the architecture because another framework is trendy.
DO NOT simplify away core differentiators merely to make implementation easier.
DO NOT add random AI features that do not strengthen the main recovery loop.
DO NOT silently change any frozen decision.

The product direction is READ-ONLY unless the user explicitly changes it.

At the beginning of the project:
1. Save this complete context in:
   docs/RUNSAFE_PROJECT_CONTEXT.md

2. Preserve that file as the canonical idea/context document.

3. Only update canonical decisions in that document when the user explicitly
   changes a requirement or approves an architectural change.

4. Maintain a separate living implementation memory file:
   docs/RUNSAFE_PROJECT_MEMORY.md

5. RUNSAFE_PROJECT_MEMORY.md should continuously record:
   - current implementation stage
   - completed modules
   - pending modules
   - deviations from planned architecture
   - technical blockers
   - resolved blockers
   - important implementation decisions
   - actual ports/services/models/tools used
   - known limitations
   - test/demo status
   - decisions approved by the user
   - anything the next coding session must know

6. Never allow implementation reality and documentation to drift apart.

7. Before marking any stage complete, verify the actual repository/runtime,
   not merely that code exists.

======================================================================
1. HACKATHON CONTEXT
======================================================================

Hackathon:

Agents That Act: TrueFoundry × Polaris Hackathon

Core theme:

"Build agents that act, not ones that just answer."

The challenge is NOT to build a chatbot.

The challenge is to build an AI agent for a real-world job that is genuinely
worth handing over to AI.

The agent is expected to:

1. Reach a REAL system/tool.
   Examples from the organizers:
   - database
   - repository
   - cloud account
   - ticket queue
   - infrastructure

2. Run code it generates safely inside a SANDBOX.

3. Know when to stop.

4. Stop before irreversible actions.

5. Request HUMAN APPROVAL before irreversible/destructive actions.

TrueForge is the mandatory agent runtime/harness.

Hackathon date:
26 September 2026
Bengaluru
In-person
One-day hackathon

Teams:
1–4 people
Solo allowed

The user has been selected for the hackathon.

======================================================================
2. OFFICIAL BUILDING RULES THAT MUST NEVER BE VIOLATED
======================================================================

The following rules are mandatory:

1. The project must be built DURING the hackathon.
   Pre-built implementation is not eligible.

2. Prior research, architecture planning, documentation, and reading
   TrueForge documentation are allowed.

3. The agent MUST run on TrueForge.

4. Any language, framework, or model provider may be used.

5. AI coding assistants such as Claude, Cursor, Copilot, etc. are allowed.

6. AI assistants used during development must be disclosed in the README.

7. The team must understand and be able to explain its own:
   - architecture
   - code
   - agent behavior
   - safety system
   - infrastructure
   - model usage

8. The agent must reach a REAL system/tool.

9. Generated code must execute safely inside a sandbox.

10. Before irreversible/destructive actions, the agent MUST STOP and wait
    for human approval.

11. Only the team's OWN:
    - accounts
    - data
    - credentials
    may be connected.

12. Secrets/API keys must NEVER be:
    - committed to Git
    - displayed in repository
    - exposed in demo video
    - printed unnecessarily in logs

13. Environment variables / safe local secret storage must be used.

If implementation occurs before the official hackathon build window:
ONLY planning/documentation/research should be done.
Actual project implementation must comply with the hackathon build rule.

======================================================================
3. PRODUCT NAME
======================================================================

RUNSAFE

Use this exact product name consistently.

Do not rename unless explicitly requested by the user.

======================================================================
4. WHAT RUNSAFE IS
======================================================================

RunSafe is a:

VERIFIED AUTONOMOUS INCIDENT RECOVERY / AI SRE CONTROL PLANE.

It begins from the suggested "Runbook Executor" domain, but it goes far
beyond blindly executing instructions.

A runbook is a human-written operational procedure that tells an engineer
what to do when a particular operational incident occurs.

Example:

CHECKOUT FAILURE RUNBOOK

1. Check API health.
2. Inspect CPU and memory.
3. Inspect logs.
4. Check database connectivity.
5. Check recent deployments.
6. Restart the service if unhealthy.
7. Verify checkout.
8. If the latest deployment caused the problem, roll it back.
9. Escalate if recovery fails.

Traditionally a human engineer reads and manually executes the runbook.

RunSafe turns such operational knowledge into SAFE, VERIFIED,
AGENT-EXECUTABLE RECOVERY WORKFLOWS.

======================================================================
5. WHAT RUNSAFE IS NOT
======================================================================

RunSafe is NOT:

- a generic chatbot
- ChatGPT for DevOps
- a runbook generator
- a RAG chatbot over runbooks
- a dashboard that only shows suggestions
- a system that says "you should restart your server"
- an LLM with unrestricted shell access
- an AI that blindly executes every runbook step
- an AI that decides its own actions are safe
- a fake infrastructure simulation presented as real execution
- a simple incident-summary application
- a generic log summarizer
- a collection of unrelated AI features

The key requirement is:

THE AGENT MUST ACT ON A REAL CONTROLLED SYSTEM.

======================================================================
6. CORE PRODUCT PROMISE
======================================================================

Core product idea:

"Existing runbooks tell you how to recover.
RunSafe proves the runbook works, then safely executes it when production
actually fails."

Additional product philosophy:

"We don't ask you to trust the AI.
We make the AI prove every recovery action."

The strongest conceptual distinction:

AI = intelligence
Safety Kernel = authority
Verifier = truth

The LLM may reason and propose.

The LLM does NOT control safety policy.

The LLM does NOT determine by itself whether an incident is resolved.

======================================================================
7. HIGH-LEVEL RUNSAFE WORKFLOW
======================================================================

The canonical runtime workflow is:

INCIDENT
   ↓
Observe real system
   ↓
Collect evidence
   ↓
Select / interpret human runbook
   ↓
Diagnose incident
   ↓
Determine next valid recovery step
   ↓
Construct Proof-Carrying Action
   ↓
Check Recovery Contract
   ↓
Safety Kernel evaluation
   ↓
Generated analysis/code needed?
   ↓
Run generated code in TrueForge sandbox
   ↓
Re-evaluate evidence
   ↓
Safe/reversible action?
   ├── YES → execute automatically according to policy
   └── NO / high-risk / destructive → HARD STOP
                                         ↓
                                   HUMAN APPROVAL
                                         ↓
                                      execute
   ↓
Independent post-action verification
   ↓
Recovered?
   ├── YES → close incident
   └── NO → continue runbook / compensate / rollback / escalate
   ↓
Generate audit trail / incident summary
   ↓
Detect runbook drift
   ↓
Suggest evidence-backed runbook improvement
   ↓
Human accepts/rejects runbook change

======================================================================
8. MAJOR PRODUCT DIFFERENTIATORS
======================================================================

RunSafe must preserve the following differentiators.

They are not optional decoration.

They are what separates RunSafe from a basic Runbook Executor.

----------------------------------------------------------------------
8.1 RUNBOOK CI / CONTINUOUS RECOVERY REHEARSAL
----------------------------------------------------------------------

Runbooks should not merely exist.

RunSafe should be able to TEST whether they still work.

Concept:

Human Runbook
   ↓
Recovery Contract
   ↓
Controlled fault injection
   ↓
Runbook execution
   ↓
Objective recovery verification
   ↓
PASS / FAIL
   ↓
Recovery coverage / missing path report

Think:

"CI testing for runbooks."

Example:

Checkout Recovery Runbook

Service crash               PASS
Bad deployment              PASS
Database outage             FAIL

Recovery coverage: 82%

This is a major RunSafe innovation.

The agent does not wait until a real emergency to discover that recovery
instructions are stale.

----------------------------------------------------------------------
8.2 RECOVERY CONTRACTS
----------------------------------------------------------------------

Human-written free-text runbook steps should be converted into structured,
machine-enforceable recovery contracts.

Every executable recovery step should contain fields conceptually equivalent to:

- step_id
- description
- intent
- required_evidence
- preconditions
- action
- action parameters
- risk classification
- reversibility
- blast radius
- approval policy
- timeout
- success criteria
- postconditions
- compensation
- rollback/fallback
- next step on success
- next step on failure
- escalation condition

The agent should NOT simply interpret free-text instructions every time.

The contract creates a deterministic operational boundary around probabilistic
AI reasoning.

----------------------------------------------------------------------
8.3 PROOF-CARRYING ACTIONS
----------------------------------------------------------------------

Every meaningful mutation proposed by RunSafe must carry a justification.

Before execution, RunSafe must be able to answer:

WHAT am I about to do?

WHY am I doing it?

WHAT evidence supports it?

WHICH runbook step authorizes it?

WHAT conditions are currently satisfied?

WHAT could this action affect?

HOW risky is it?

IS it reversible?

WHAT will indicate that the action succeeded?

WHAT happens if it fails?

DOES it require approval?

Example:

PROPOSED ACTION:
Rollback checkout v2 → v1

Evidence:
- 5xx rate increased after v2
- v2 accounts for 94% of failures
- database is healthy
- restart did not restore health

Runbook authority:
Deployment Recovery / Step 7

Risk:
HIGH

Blast radius:
Checkout → Orders → Payments

Success criteria:
- /health = 200
- error rate < 1%
- synthetic checkout PASS

Compensation:
restore prior state if rollback verification fails

Approval:
REQUIRED

This is one of RunSafe's strongest technical/product differentiators.

----------------------------------------------------------------------
8.4 DETERMINISTIC SAFETY KERNEL
----------------------------------------------------------------------

The LLM must NOT be the final authority for infrastructure safety.

RunSafe must include a deterministic safety layer outside the model.

Possible action classes:

READ_ONLY
LOW_RISK_REVERSIBLE
STATE_CHANGING
HIGH_RISK
DESTRUCTIVE
UNKNOWN

Typical policy:

READ_ONLY
→ automatic

LOW_RISK_REVERSIBLE
→ automatic if Recovery Contract permits

STATE_CHANGING
→ policy dependent

HIGH_RISK
→ human approval

DESTRUCTIVE
→ mandatory hard human approval

UNKNOWN
→ deny or escalate

Unknown actions should fail CLOSED, not fail open.

The LLM cannot override the Safety Kernel.

----------------------------------------------------------------------
8.5 TYPED MCP TOOLS
----------------------------------------------------------------------

TrueForge should reach the real system through explicitly defined tools.

Do NOT expose unrestricted production shell access to the model.

Example MCP tools:

get_service_health()
get_service_metrics()
get_recent_logs()
get_database_health()
get_current_deployment()
get_previous_deployment()
get_dependencies()

restart_service()

rollback_canary()
rollback_full()

modify_safe_config()

delete_resource()

Each tool should have:

- strict input schema
- strict output schema
- known risk classification
- timeout
- error handling
- audit event
- explicit approval behavior where relevant

----------------------------------------------------------------------
8.6 SANDBOXED GENERATED CODE
----------------------------------------------------------------------

The organizers explicitly require generated code to run safely in a sandbox.

RunSafe must make this visible and meaningful.

Example:

Agent receives thousands of log lines.

Instead of reasoning over raw logs inefficiently, it writes a diagnostic script:

analyze_logs.py

The generated script may:

- group errors
- count exception types
- calculate failure frequency
- compare deployment versions
- correlate timestamps
- identify anomalous patterns
- calculate error percentages

Generated code flow:

Agent
  ↓
Generated diagnostic code
  ↓
TrueForge Sandbox
  ↓
Execute safely
  ↓
Structured result
  ↓
Evidence Engine
  ↓
Planner

Generated arbitrary code should NOT directly execute against real infrastructure.

----------------------------------------------------------------------
8.7 EVIDENCE-BASED DIAGNOSIS
----------------------------------------------------------------------

RunSafe must show WHY it believes something.

Example:

Weak:
"AI thinks database is the problem."

Good:
- API health: 503
- CPU: normal
- RAM: normal
- DB reachable
- DB connection pool: 100/100
- logs contain connection timeout errors
- errors started at 14:31 after deployment v2

Conclusion:
Likely application connection-pool exhaustion.

Every important diagnosis should be traceable to collected evidence.

----------------------------------------------------------------------
8.8 PROGRESSIVE / CANARY REMEDIATION
----------------------------------------------------------------------

RunSafe should minimize blast radius where possible.

Do not immediately change the entire system.

Example:

Two replicas:
checkout-1 → v2
checkout-2 → v2

Instead of full rollback:

rollback checkout-1 → v1

Then compare:

v1 error rate: 0.2%
v2 error rate: 18%

If canary recovery succeeds:

propose/approve complete rollback.

This creates:

"smallest safe change first"

and converts blast-radius awareness into actual execution behavior.

----------------------------------------------------------------------
8.9 BLAST-RADIUS AWARENESS
----------------------------------------------------------------------

Before meaningful changes, RunSafe should determine what can be affected.

Example dependency graph:

Users
  ↓
Frontend
  ↓
Checkout API
  ├── Order Service
  └── Payment Service
        ↓
     PostgreSQL

If a rollback/change affects Checkout:

RunSafe should surface the dependent systems.

Blast radius is not only a visualization.

It should influence remediation strategy.

----------------------------------------------------------------------
8.10 INDEPENDENT RECOVERY VERIFICATION
----------------------------------------------------------------------

Command success is NOT incident success.

Example:

docker restart checkout-api
exit code: 0

This does NOT mean:
incident resolved.

RunSafe must independently verify objective recovery criteria.

Examples:

GET /health == 200

database query succeeds

error_rate < configured threshold

synthetic login succeeds

synthetic checkout succeeds

expected replica count exists

required dependency reachable

The component that executed the action should not merely declare itself successful.

Objective checks determine success.

----------------------------------------------------------------------
8.11 CONFIDENCE-BASED ABSTENTION
----------------------------------------------------------------------

RunSafe must be allowed to say:

"I do not have enough evidence to safely act."

Example:

Database issue     42%
Deployment issue   31%
Network issue      27%

Confidence insufficient.

AUTONOMOUS REMEDIATION BLOCKED.

Engineer input required.

This is important because the hackathon explicitly values agents that
"know when to stop."

RunSafe should stop not only for destructive actions but also when
evidence is too weak for responsible autonomous action.

----------------------------------------------------------------------
8.12 TRANSACTIONAL RUNBOOK EXECUTION
----------------------------------------------------------------------

Conceptual step lifecycle:

PRECONDITION
   ↓
EVIDENCE
   ↓
ACTION
   ↓
POSTCONDITION
   ↓
VERIFY
   ↓
PASS?
 ┌───────┴───────┐
YES              NO
 ↓                ↓
next step      compensation/fallback

Every important runbook action should have a defined success/failure path.

----------------------------------------------------------------------
8.13 INCIDENT MEMORY / AUDIT TRAIL
----------------------------------------------------------------------

RunSafe should maintain a complete timeline.

Example:

14:32:01 incident opened
14:32:03 health check failed
14:32:06 logs collected
14:32:11 DB checked
14:32:15 hypothesis created
14:32:18 restart executed
14:32:25 verification failed
14:32:29 rollback proposed
14:32:35 human approved
14:32:40 canary rollback executed
14:32:52 verification passed
14:32:54 full recovery completed

Every:
- observation
- tool call
- evidence item
- model decision
- policy decision
- approval
- action
- verification
should be auditable.

----------------------------------------------------------------------
8.14 RUNBOOK DRIFT / SELF-IMPROVEMENT
----------------------------------------------------------------------

RunSafe may identify that a runbook is outdated.

Example:

Existing instruction:
"Restart service when database errors occur."

Observed incidents:
restart repeatedly fails
connection-pool recovery succeeds

RunSafe may propose:

Suggested update:
Before restart:
1. check connection-pool saturation
2. reset stale connections if policy permits
3. restart only if health remains degraded

CRITICAL RULE:

RunSafe must NEVER silently rewrite operational policy.

Runbook improvements are proposals.

Human accepts or rejects them.

======================================================================
9. WHY RUNSAFE IS DIFFERENT FROM GENERIC AI SRE AGENTS
======================================================================

Do NOT pitch basic features as if they are unique innovations.

Features such as:
- AI log analysis
- incident summarization
- runbook execution
- automatic remediation
- postmortem generation
already exist in parts of the industry.

RunSafe's differentiation should instead center on:

1. Runbook CI / Recovery Rehearsal
2. Recovery Contracts
3. Proof-Carrying Actions
4. Deterministic Safety Kernel
5. Progressive / Canary Remediation
6. Independent Outcome Verification
7. Confidence-Based Abstention

Core idea:

RunSafe does not ask operators to TRUST autonomous remediation.

RunSafe makes remediation EXPLAINABLE, BOUNDED, TESTABLE, REVERSIBLE,
APPROVABLE, and VERIFIABLE.

======================================================================
10. TRUEFORGE'S ROLE
======================================================================

TrueForge is mandatory.

TrueForge should be a central runtime, not a decorative dependency.

Use it for the agentic system.

Expected TrueForge responsibilities:

- agent runtime
- sessions
- agent tool execution
- MCP integration
- sandboxed generated-code execution
- human approval/checkpoint flows where applicable
- subagents if useful
- agent event/state flow

Do NOT insert LangChain/LangGraph between the product and TrueForge unless
a hard technical constraint makes it unavoidable.

The hackathon is specifically about TrueForge.

The project should visibly demonstrate meaningful TrueForge usage.

======================================================================
11. MODEL STRATEGY
======================================================================

The system should NOT blindly depend on paid hosted models.

----------------------------------------------------------------------
11.1 LOCAL MODEL
----------------------------------------------------------------------

Preferred local model:

Qwen3 4B

Runtime:

Ollama

Use Qwen3 4B efficiently for tasks such as:

- runbook extraction
- structured runbook parsing
- log summarization
- incident triage
- evidence summarization
- local/private operational analysis
- fallback reasoning
- lightweight classification
- converting unstructured input into schemas

Advantages:

- local
- private
- offline-capable
- no token cost
- useful fallback if internet/model credits fail

----------------------------------------------------------------------
11.2 GEMMA
----------------------------------------------------------------------

Available:

Gemma 3 4B

Gemma is OPTIONAL.

Possible uses:
- secondary fallback
- postmortem generation
- explanation/report generation
- model comparison if useful

Do NOT run Qwen3 4B and Gemma 3 4B simultaneously without a good reason.

Do NOT add a second local model merely for marketing.

Qwen3 4B is the preferred local specialist.

----------------------------------------------------------------------
11.3 HOSTED MODEL
----------------------------------------------------------------------

Hackathon overview mentions:

AWS and OpenAI credits for shortlisted teams.

However:

DO NOT assume the credits/access are actually usable until organizers provide
them.

If strong OpenAI access is provided:

Use the stronger hosted model for:
- difficult incident planning
- multi-step reasoning
- root-cause hypothesis
- runbook branch selection
- complex action planning

Architecture must remain capable of operating without depending completely
on paid model access.

----------------------------------------------------------------------
11.4 VERIFICATION IS NOT AN LLM TASK
----------------------------------------------------------------------

The Verifier should prefer deterministic checks.

Example:

health endpoint
database query
synthetic transaction
error threshold
expected deployment
HTTP response
latency threshold

Do NOT ask another LLM:

"Do you think the incident is fixed?"

Machines should verify machines.

======================================================================
12. DEVELOPMENT MACHINE / HARDWARE
======================================================================

Primary machine:

HP Victus

Known hardware:

- AMD Ryzen 5000 series CPU
- 24 GB RAM
- NVIDIA RTX 3050 Laptop GPU
- 4 GB VRAM
- approximately 150 GB free SSD space
- Windows 11

This hardware is sufficient.

Optimize local architecture around these constraints.

Do NOT require:
- large local LLMs
- GPU-heavy training
- fine-tuning
- huge distributed systems
- multiple simultaneously loaded 4B models

WSL2 / Docker may be used as needed.

======================================================================
13. LOCAL-FIRST REAL INFRASTRUCTURE
======================================================================

RunSafe must not require paid cloud for the core demo.

The user's laptop can host a miniature REAL production-like environment.

Canonical local demo topology:

                     NGINX
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
      checkout-api-1      checkout-api-2
          version A           version B
             \                   /
              \                 /
                 PostgreSQL

Additional components may include:

- traffic generator
- health endpoints
- metrics
- logs
- deployment metadata
- failure-injection endpoints/scripts
- synthetic transaction runner

Use Docker Compose.

The system should involve real:

- containers/processes
- HTTP traffic
- database operations
- logs
- health checks
- application failures
- restarts
- deployments/versions
- rollbacks

The demo environment is small in scale but REAL in behavior.

Cloud/AWS is OPTIONAL.

If AWS credits are provided and integration is reliable, it can be added,
but the main demo must not depend on unstable cloud/Wi-Fi access.

======================================================================
14. CANONICAL TECHNOLOGY STACK
======================================================================

Unless a hard technical blocker appears, prefer the following stack.

----------------------------------------------------------------------
AGENT RUNTIME
----------------------------------------------------------------------

TrueForge

Mandatory.

----------------------------------------------------------------------
PRIMARY LANGUAGE
----------------------------------------------------------------------

TypeScript

Prefer TypeScript end-to-end to minimize integration friction.

----------------------------------------------------------------------
FRONTEND
----------------------------------------------------------------------

Next.js
React
TypeScript
Tailwind CSS

Purpose:

Professional incident command interface.

----------------------------------------------------------------------
BACKEND / CONTROL PLANE
----------------------------------------------------------------------

Fastify
TypeScript

Responsibilities:

- incidents
- runbooks
- Recovery Contracts
- evidence
- approvals
- agent orchestration integration
- audit state
- verification
- infrastructure adapter
- failure injection APIs
- frontend API/events

----------------------------------------------------------------------
SCHEMAS / VALIDATION
----------------------------------------------------------------------

Zod

All important contracts/tool payloads should be typed and validated.

----------------------------------------------------------------------
MCP
----------------------------------------------------------------------

TypeScript MCP server

Tools should be explicitly typed.

----------------------------------------------------------------------
CONTROL-PLANE DATABASE
----------------------------------------------------------------------

SQLite

Store:

- runbooks
- incidents
- evidence
- tool/action records
- approvals
- verification results
- audit events
- rehearsal results
- drift proposals

Keep setup simple and reliable.

----------------------------------------------------------------------
DEMO APPLICATION DATABASE
----------------------------------------------------------------------

PostgreSQL

This belongs to the demo workload/infrastructure, not necessarily the RunSafe
control-plane database.

----------------------------------------------------------------------
REAL DEMO INFRASTRUCTURE
----------------------------------------------------------------------

Docker Compose

----------------------------------------------------------------------
REVERSE PROXY / CANARY ROUTING
----------------------------------------------------------------------

Nginx

Allows:

- traffic routing
- replicas
- version comparison
- canary rollback/recovery scenarios

----------------------------------------------------------------------
DEPENDENCY / BLAST-RADIUS GRAPH
----------------------------------------------------------------------

React Flow

----------------------------------------------------------------------
METRICS VISUALIZATION
----------------------------------------------------------------------

Recharts

----------------------------------------------------------------------
LOCAL AI
----------------------------------------------------------------------

Ollama
Qwen3 4B

Gemma 3 4B optional only.

----------------------------------------------------------------------
VERSION CONTROL
----------------------------------------------------------------------

Git
GitHub

----------------------------------------------------------------------
REAL-TIME UI
----------------------------------------------------------------------

Prefer SSE or WebSocket depending implementation simplicity.

The UI should show live:

- observations
- evidence
- tool calls
- actions
- approval requests
- verification
- recovery status

======================================================================
15. TECHNOLOGIES TO AVOID UNLESS ABSOLUTELY REQUIRED
======================================================================

Do NOT add unnecessary infrastructure.

Avoid:

Kubernetes
LangChain
LangGraph
vector databases
RAG frameworks
Kafka
RabbitMQ
Redis
Celery
heavy distributed observability stacks
multiple cloud providers
fine-tuning
large local LLMs
unnecessary microservices
multiple backend languages
blockchain
random buzzword technologies

Do not confuse complexity with quality.

The sophistication must exist in:

- recovery reasoning
- safety
- evidence
- execution
- verification
- runbook validation

not infrastructure bloat.

======================================================================
16. UI / PRODUCT EXPERIENCE
======================================================================

RunSafe should look like a serious operational product.

Chat should NOT be the primary interface.

Core screens:

----------------------------------------------------------------------
16.1 COMMAND CENTER
----------------------------------------------------------------------

Shows:

- infrastructure/service status
- active incidents
- severity
- agent state
- current recovery phase
- MTTR timer
- recent incidents
- overall Runbook CI health
- system readiness

----------------------------------------------------------------------
16.2 INCIDENT ROOM
----------------------------------------------------------------------

The main live demo screen.

Shows:

- active incident
- affected service
- severity
- current hypothesis
- confidence
- evidence
- runbook progress
- agent actions
- tool execution
- sandbox execution
- timeline
- verification
- recovery status

----------------------------------------------------------------------
16.3 RUNBOOK LAB
----------------------------------------------------------------------

Shows:

- original human-written runbook
- parsed structure
- Recovery Contract
- runbook versions
- validation issues
- rehearsal results
- recovery coverage
- drift suggestions

----------------------------------------------------------------------
16.4 RECOVERY / DEPENDENCY GRAPH
----------------------------------------------------------------------

Shows service dependencies.

Used for:

- blast radius
- affected systems
- proposed remediation scope
- canary recovery visualization

----------------------------------------------------------------------
16.5 APPROVAL CENTER
----------------------------------------------------------------------

High-risk/destructive actions should show:

- proposed action
- why it is needed
- supporting evidence
- runbook authority
- risk
- reversibility
- blast radius
- sandbox/preflight result
- expected outcome
- verification criteria
- compensation/rollback
- Approve
- Reject

This should be much stronger than a basic:

"Allow tool call? YES/NO"

----------------------------------------------------------------------
16.6 RUNBOOK CI / REHEARSAL
----------------------------------------------------------------------

Shows:

- test scenarios
- last verified time
- pass/fail
- recovery coverage
- broken steps
- missing fallback paths
- average recovery time
- runbook readiness score if useful

----------------------------------------------------------------------
16.7 AUDIT / POSTMORTEM
----------------------------------------------------------------------

Shows:

- complete timeline
- evidence
- decisions
- approvals
- actions
- verification
- MTTR
- recovery result
- runbook improvement proposal

======================================================================
17. CORE DEMO SCENARIOS
======================================================================

Prepare THREE scenarios.

Do not build ten shallow scenarios.

The three scenarios should prove different agent qualities.

----------------------------------------------------------------------
SCENARIO 1 — PROCESS/SERVICE CRASH
----------------------------------------------------------------------

Purpose:

Demonstrate autonomous execution of known low-risk recovery.

Flow:

service crashes
→ health fails
→ incident detected
→ RunSafe collects evidence
→ correct runbook selected
→ restart permitted
→ automatic reversible restart
→ independent verification
→ service recovered

Shows:

- real system
- agent action
- no unnecessary human interruption
- safe autonomous recovery
- verification

----------------------------------------------------------------------
SCENARIO 2 — BAD DEPLOYMENT
----------------------------------------------------------------------

This is the HERO DEMO.

Example:

checkout-api version v2 has a bug.
v1 is healthy.

Flow:

bad version deployed
→ error rate rises
→ RunSafe detects incident
→ reads health/logs/deployment state
→ generates diagnostic analysis code
→ diagnostic code runs in TrueForge sandbox
→ evidence shows v2 strongly correlates with failures
→ low-risk restart attempted
→ restart does NOT solve incident
→ Verifier keeps incident OPEN
→ RunSafe proposes canary rollback
→ Proof-Carrying Action created
→ blast radius displayed
→ high-risk change triggers HUMAN APPROVAL
→ human approves
→ one replica rolled back to v1
→ traffic comparison verifies v1 healthy / v2 unhealthy
→ RunSafe proves canary recovery
→ safe/full recovery proceeds according to policy/approval
→ objective verification
→ incident resolved
→ runbook improvement suggested

This scenario should demonstrate almost the entire product.

----------------------------------------------------------------------
SCENARIO 3 — UNKNOWN / AMBIGUOUS FAILURE
----------------------------------------------------------------------

Purpose:

Demonstrate maturity.

Flow:

incident occurs
→ evidence collected
→ hypotheses remain ambiguous
→ confidence below threshold
→ RunSafe refuses unsafe remediation
→ engineer escalation requested

Shows:

"knows when to stop"

This directly aligns with the hackathon philosophy.

======================================================================
18. HERO DEMO STORY
======================================================================

Presentation should not begin with a feature tour.

Begin with the problem.

Possible opening:

"Companies already have runbooks that tell engineers how to recover from
production incidents. The problem is that nobody knows whether those runbooks
still work until production actually fails. RunSafe continuously verifies
those procedures and safely executes them when incidents happen."

Then demonstrate:

Runbook Status:
VERIFIED

Inject a controlled bad deployment.

Only manually trigger the failure.

After that:

LET RUNSAFE ACT.

The agent should:

- observe
- investigate
- collect evidence
- run generated code safely
- diagnose
- execute safe action
- detect failure of first remediation
- propose stronger remediation
- stop for human approval
- execute after approval
- verify
- recover
- learn

The user should interact only where human judgment is intentionally required.

======================================================================
19. IMPORTANT DEMO PRINCIPLE
======================================================================

Do NOT fake backend actions in the UI.

If UI says:

"Service restarted"

the service must genuinely have restarted.

If UI says:

"rollback completed"

the deployment state must genuinely change.

If UI says:

"database healthy"

a real database health check must have run.

If UI says:

"generated diagnostic code executed"

the code must genuinely have run through the sandbox.

Judges should be able to see that RunSafe ACTS.

======================================================================
20. SYSTEM ARCHITECTURE — HIGH LEVEL
======================================================================

Canonical conceptual architecture:

                         USER
                          │
                          ▼
                 NEXT.JS DASHBOARD
                          │
                          ▼
                 FASTIFY CONTROL PLANE
                  /       |        \
                 /        |         \
        Incident Store  Safety    Infrastructure
           SQLite       Kernel       Adapter
                          │             │
                          │          Docker API /
                          │          typed ops
                          │             │
                          │       REAL DEMO SYSTEM
                          │
                          ▼
                      TRUEFORGE
                  /       |        \
                 /        |         \
        Hosted Model   Qwen3      MCP Tools
         optional      Ollama       │
                                    │
                             typed observations/
                                actions

Generated code:

TrueForge Agent
   ↓
Generated diagnostic script
   ↓
TrueForge Sandbox
   ↓
Structured evidence
   ↓
Evidence Engine / Planner

Mutation flow:

Agent proposal
   ↓
Recovery Contract
   ↓
Proof-Carrying Action
   ↓
Safety Kernel
   ↓
Low-risk?
   ├── YES → execute
   └── NO → Human Approval
   ↓
Real system
   ↓
Independent Verifier
   ↓
PASS / FAIL

======================================================================
21. AGENT RESPONSIBILITIES
======================================================================

Avoid uncontrolled "swarm" complexity.

Use clear roles.

Possible logical agent roles:

----------------------------------------------------------------------
INVESTIGATOR
----------------------------------------------------------------------

Purpose:

- gather evidence
- inspect tools/system
- analyze logs
- identify hypotheses
- avoid mutations

----------------------------------------------------------------------
PLANNER
----------------------------------------------------------------------

Purpose:

- interpret runbook
- evaluate Recovery Contract
- choose next valid recovery step
- create Proof-Carrying Action

----------------------------------------------------------------------
EXECUTOR
----------------------------------------------------------------------

Purpose:

- invoke authorized tools
- perform approved/reversible actions
- never bypass safety policy

----------------------------------------------------------------------
VERIFIER
----------------------------------------------------------------------

Purpose:

- objectively test recovery
- validate postconditions
- keep incident open if success criteria fail

The Safety Kernel is NOT an LLM agent.

It is deterministic application logic.

======================================================================
22. FAILURE INJECTION
======================================================================

Because the demo needs repeatable incidents, controlled failure injection
should be part of the demo infrastructure.

Examples:

- kill service
- return HTTP 500/503
- introduce faulty application version
- create DB connection exhaustion
- create artificial latency
- break environment/config value
- route traffic to unhealthy version

Failure injection must only affect our own controlled environment.

Provide reset scripts/actions so the demo can be quickly restored.

======================================================================
23. OBSERVABILITY / EVIDENCE MODEL
======================================================================

RunSafe does NOT need a massive enterprise observability stack.

Collect only what supports the demo and product logic.

Useful signals:

- HTTP health
- status codes
- latency
- error rate
- request count
- application logs
- DB connectivity
- DB connection count
- deployment version
- replica health
- restart count
- synthetic transaction result

Every evidence item should ideally contain:

- source
- timestamp
- metric/fact
- value
- relevance
- incident_id

======================================================================
24. SAFETY PRINCIPLES
======================================================================

These are non-negotiable.

1. LLM reasoning is untrusted.

2. Tool schemas are strict.

3. Unknown actions fail closed.

4. Generated arbitrary code runs in sandbox.

5. Production-like infrastructure mutations occur only through known tools.

6. High-risk/destructive actions require approval.

7. The agent cannot self-approve.

8. Approval state must be explicit and auditable.

9. The same proposed action should not execute twice accidentally.

10. Timeouts must exist.

11. Failed actions must be reported truthfully.

12. Verification must happen after mutation.

13. No secrets should be passed unnecessarily into sandbox/model context.

14. The runbook is human operational authority.

15. RunSafe can propose improvements but never silently redefine policy.

======================================================================
25. DOCUMENTATION EXPECTED BEFORE IMPLEMENTATION
======================================================================

The implementation roadmap assumes project documentation is already created
and aligned.

Recommended documents:

01. Project Master Context / Project Memory
02. PRD — Product Requirements Document
03. TRD — Technical Requirements Document
04. System Architecture Document
05. Workflow / Data Flow Document
06. UI/UX Specification
07. Data Architecture / Database Design
08. TrueForge / Agent Architecture
09. MCP / Tool Integration Specification
10. Runbook / Recovery Contract Specification
11. Safety / Approval / Threat Model
12. Sandbox Execution Design
13. Model Strategy / Local AI Design
14. Testing / Validation / Evaluation Plan
15. Deployment / DevOps / Local Environment Guide
16. API Specification
17. Demo Runbook / Presentation Flow
18. Requirements Traceability Matrix
19. README plan / AI-assistant disclosure
20. Implementation Roadmap

Do not allow these documents to contradict each other.

======================================================================
26. IMPLEMENTATION ROADMAP
======================================================================

The canonical implementation stages are:

----------------------------------------------------------------------
STAGE 1 — FOUNDATION & RUNTIME BOOTSTRAP
----------------------------------------------------------------------

Create:

- repository
- monorepo/project structure
- Next.js frontend
- Fastify backend/control plane
- shared TypeScript packages
- Zod schemas
- SQLite
- Docker Compose base
- environment/secrets handling
- logging
- health endpoints
- development scripts
- lint/typecheck/test setup

Goal:

stable development foundation.

----------------------------------------------------------------------
STAGE 2 — REAL DEMO INFRASTRUCTURE
----------------------------------------------------------------------

Create real controlled infrastructure:

- Nginx
- API replicas
- PostgreSQL
- health endpoints
- logs
- metrics
- versions
- traffic generation
- synthetic transaction
- failure injection
- reset functionality

Goal:

RunSafe has a REAL system to operate on.

----------------------------------------------------------------------
STAGE 3 — TRUEFORGE AGENT CORE & MODEL ROUTING
----------------------------------------------------------------------

Integrate:

- TrueForge
- sessions
- agent configuration
- Ollama
- Qwen3 4B
- hosted model option if available
- model routing

Goal:

functional agent runtime.

----------------------------------------------------------------------
STAGE 4 — TYPED MCP TOOL LAYER
----------------------------------------------------------------------

Implement observations/actions as strict MCP tools.

Goal:

no unrestricted infrastructure access.

----------------------------------------------------------------------
STAGE 5 — RUNBOOK COMPILER & RECOVERY CONTRACTS
----------------------------------------------------------------------

Human runbook
→ structured executable Recovery Contracts.

Must include:

- evidence
- preconditions
- action
- risk
- blast radius
- success criteria
- timeout
- compensation
- fallback
- approval policy

----------------------------------------------------------------------
STAGE 6 — DETERMINISTIC SAFETY KERNEL
----------------------------------------------------------------------

Implement action classification and enforcement.

Goal:

LLM cannot override operational safety.

----------------------------------------------------------------------
STAGE 7 — INCIDENT & EVIDENCE ENGINE
----------------------------------------------------------------------

Implement:

- incident lifecycle
- evidence collection
- evidence storage
- hypotheses
- confidence
- timeline

----------------------------------------------------------------------
STAGE 8 — TRUEFORGE SANDBOX EXECUTION
----------------------------------------------------------------------

Generated diagnostic code:

agent
→ sandbox
→ structured result
→ evidence

Make sandbox execution visible in UI/audit.

----------------------------------------------------------------------
STAGE 9 — PROOF-CARRYING AUTONOMOUS RECOVERY ORCHESTRATOR
----------------------------------------------------------------------

Implement core loop:

Observe
→ Diagnose
→ Runbook Step
→ Proof-Carrying Action
→ Safety
→ Act
→ Observe Again

This is the core RunSafe engine.

----------------------------------------------------------------------
STAGE 10 — PROGRESSIVE / CANARY RECOVERY & ROLLBACK
----------------------------------------------------------------------

Implement:

- smallest safe action first
- canary rollback
- partial restart
- compensation
- fallback
- rollback

----------------------------------------------------------------------
STAGE 11 — INDEPENDENT VERIFICATION & ABSTENTION
----------------------------------------------------------------------

Implement deterministic success checks.

Implement confidence threshold.

RunSafe must be capable of refusing unsafe autonomous action.

----------------------------------------------------------------------
STAGE 12 — RUNBOOK CI / RECOVERY REHEARSAL
----------------------------------------------------------------------

Implement:

controlled fault injection
→ execute runbook
→ verify
→ coverage/report

This is a major differentiator.

----------------------------------------------------------------------
STAGE 13 — LEARNING, DRIFT & AUDIT INTELLIGENCE
----------------------------------------------------------------------

Implement:

- complete timeline
- audit trail
- postmortem
- MTTR
- runbook drift
- suggested improvement
- human accept/reject

----------------------------------------------------------------------
STAGE 14 — PRODUCT UI / COMMAND CENTER
----------------------------------------------------------------------

Complete/integrate:

- Command Center
- Incident Room
- Runbook Lab
- Recovery Graph
- Approval Center
- Runbook CI
- Audit/Postmortem

UI must reflect REAL backend state.

----------------------------------------------------------------------
STAGE 15 — END-TO-END VALIDATION & DEMO HARDENING
----------------------------------------------------------------------

STOP adding random features.

Validate:

Scenario 1:
process crash
→ autonomous recovery

Scenario 2:
bad deployment
→ sandbox diagnosis
→ canary rollback
→ approval
→ verified recovery

Scenario 3:
unknown failure
→ low confidence
→ abstain/escalate

Also validate:

- repo clean
- secrets safe
- README
- AI disclosures
- startup scripts
- reset scripts
- demo reliability
- recovery after crashes
- architecture explanation
- backup demo path if something fails

======================================================================
27. IMPLEMENTATION PHILOSOPHY
======================================================================

Do not chase number of features.

A winning RunSafe prototype should demonstrate a COMPLETE vertical slice.

Prefer:

ONE real recovery workflow that is impressive and reliable

over:

TWENTY fake or disconnected features.

The prototype may not implement every future enterprise capability.

However, the architecture must clearly show how RunSafe could evolve into an
industry-grade system.

Prototype claims must be honest.

Use wording such as:

"Prototype currently demonstrates X.
The architecture supports future extension to Y."

Do not pretend unimplemented capabilities exist.

======================================================================
28. QUALITY BAR
======================================================================

RunSafe should feel:

- coherent
- intentional
- safe
- technical
- explainable
- professional
- visually polished
- industry-inspired
- highly demoable

Every major feature must answer:

"How does this improve autonomous incident recovery?"

If there is no strong answer, do not add the feature.

======================================================================
29. WINNING PRESENTATION ANGLE
======================================================================

The goal is not:

"We used five AI models."

The goal is not:

"We have 20 dashboard pages."

The goal is not:

"We used many frameworks."

The winning story is:

A REAL system fails.

RunSafe autonomously investigates.

RunSafe collects evidence.

RunSafe generates and safely runs diagnostic code.

RunSafe proves which remediation is justified.

RunSafe automatically performs safe actions.

RunSafe refuses unsafe uncertainty.

RunSafe stops before dangerous changes.

A human sees exactly WHY approval is requested.

The human approves.

RunSafe performs a progressive recovery.

RunSafe independently verifies the actual business function.

Only then does RunSafe declare recovery.

Then RunSafe shows how the runbook should improve.

======================================================================
30. KEY LINES / POSITIONING
======================================================================

Primary:

"Existing runbooks tell you how to recover.
RunSafe proves the runbook works, then safely executes it when production
actually fails."

Safety philosophy:

"We don't ask you to trust the AI.
We make the AI prove every recovery action."

Technical philosophy:

"AI provides intelligence.
The Safety Kernel provides authority.
The Verifier provides truth."

Theme alignment:

"RunSafe doesn't just answer how to recover.
It reaches the system, acts on it, and knows when to stop."

======================================================================
31. IMPORTANT NON-NEGOTIABLES
======================================================================

DO NOT REMOVE:

- TrueForge
- real system interaction
- sandboxed generated code
- human approval
- Recovery Contracts
- Proof-Carrying Actions
- deterministic Safety Kernel
- objective verification
- Runbook CI
- abstention
- progressive recovery

DO NOT TURN RUNSAFE INTO:

- chatbot
- runbook generator
- generic DevOps assistant
- simple monitoring dashboard
- fake incident simulator
- AI log summarizer

======================================================================
32. WHEN IMPLEMENTATION REALITY DIFFERS FROM THIS PLAN
======================================================================

If a technical assumption proves false:

1. Verify the actual blocker.
2. Record it in RUNSAFE_PROJECT_MEMORY.md.
3. Preserve the product requirement if possible.
4. Find the simplest architecture-compatible alternative.
5. Do not silently remove major product behavior.
6. If a frozen product decision must change, ask the user first.

TrueForge/API/library reality takes priority over assumptions.

Never fabricate support for a capability.

======================================================================
33. PROJECT MEMORY DISCIPLINE
======================================================================

After every meaningful implementation session update:

docs/RUNSAFE_PROJECT_MEMORY.md

Minimum structure:

# RunSafe Project Memory

## Current Stage

## Completed

## Partially Completed

## Pending

## Current Architecture Reality

## Services / Ports

## TrueForge Configuration

## Models

## MCP Tools

## Recovery Contracts

## Safety Policies

## Demo Infrastructure

## Demo Scenarios

## Known Bugs

## Known Limitations

## Decisions Made

## Decisions Awaiting User Approval

## Next Exact Steps

This file exists so another coding agent/session can continue RunSafe without
losing context.

======================================================================
34. FINAL INSTRUCTION TO THE CODING AGENT
======================================================================

Treat RunSafe as a serious autonomous operational system, not a hackathon toy.

Optimize for:

1. real execution
2. safety
3. evidence
4. recoverability
5. verification
6. explainability
7. demo reliability
8. professional UX
9. architectural coherence
10. theme alignment

Do not optimize primarily for writing the most code.

When uncertain, ask:

"Does this make RunSafe better at safely recovering a real system?"

If yes, implement it properly.

If no, do not waste hackathon time on it.

This document is the canonical RunSafe product context.

Preserve it.
Build from it.
Do not casually redefine it.

======================================================================
END OF RUNSAFE CANONICAL MASTER PROJECT CONTEXT
======================================================================
