import { randomBytes } from 'node:crypto';

import { normalizeSwitchCaseHandles } from '../../automations/switchHandles.js';
import { inject } from '../../container.js';

import type { AutomationRun } from '../../automations/trace.js';
import type { LoggerService } from '../../services/logger/index.js';
import type { Database } from '../database/index.js';
import type { DBAutomation } from '../database/types.js';
import type { CreateAutomationInput, ImportBlueprintInput, PatchAutomationInput } from '../schemas/automations.schema.js';

const RUN_PREFIX = 'run:';
const CONTEXT_PREFIX = 'context:';
const MAX_RUNS_PER_FLOW = 50;

export class AutomationsService {
  private dbs: Database;
  private logger: LoggerService;

  constructor() {
    this.dbs = inject('dbs');
    this.logger = inject('logger');
  }

  public list(): DBAutomation[] {
    return [...this.dbs.automationsDB.getRange()].map(({ value }) => value);
  }

  public getById(id: string): DBAutomation | undefined {
    return this.dbs.automationsDB.get(id);
  }

  public async create(input: CreateAutomationInput): Promise<DBAutomation> {
    const automation: DBAutomation = {
      _id: randomBytes(12).toString('hex'),
      name: input.name,
      enabled: input.enabled,
      nodes: this.ensureWebhookSecrets(input.nodes),
      edges: input.edges,
      suppressDuplicates: input.suppressDuplicates,
      singleExecution: input.singleExecution,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.dbs.automationsDB.put(automation._id, automation);

    this.logger.log(`Automation created: ${automation.name} (${automation._id})`);
    this.notifyEngine(automation._id);

    return automation;
  }

  public async update(id: string, input: PatchAutomationInput): Promise<DBAutomation | undefined> {
    const automation = await this.dbs.commit(this.dbs.automationsDB, id, (current) => {
      if (!current) return undefined;

      if (input.name !== undefined) current.name = input.name;
      if (input.enabled !== undefined) current.enabled = input.enabled;
      if (input.nodes !== undefined) current.nodes = this.ensureWebhookSecrets(input.nodes);
      if (input.edges !== undefined) current.edges = input.edges;
      if (input.suppressDuplicates !== undefined) current.suppressDuplicates = input.suppressDuplicates;
      if (input.singleExecution !== undefined) current.singleExecution = input.singleExecution;

      current.requiresUpdate = false;
      current.updatedAt = Date.now();

      return current;
    });
    if (!automation) return undefined;

    this.notifyEngine(id);

    return automation;
  }

  public async delete(id: string): Promise<boolean> {
    const automation = this.getById(id);
    if (!automation) return false;

    await this.dbs.automationsDB.remove(id);
    await this.clearRunState(id);

    this.logger.log(`Automation deleted: ${automation.name} (${id})`);
    this.notifyEngineDeleted(id);

    return true;
  }

  public async addRun(run: AutomationRun): Promise<void> {
    const key = `${RUN_PREFIX}${run.flowId}:${String(run.startedAt).padStart(15, '0')}`;
    await this.dbs.automationStateDB.put(key, run);

    const keys = [...this.dbs.automationStateDB.getRange({ start: `${RUN_PREFIX}${run.flowId}:`, end: `${RUN_PREFIX}${run.flowId}:￿` })].map((e) => e.key);
    if (keys.length > MAX_RUNS_PER_FLOW) {
      await Promise.all(keys.slice(0, keys.length - MAX_RUNS_PER_FLOW).map((k) => this.dbs.automationStateDB.remove(k)));
    }
  }

  public listRuns(flowId: string, limit = MAX_RUNS_PER_FLOW): AutomationRun[] {
    const runs = [...this.dbs.automationStateDB.getRange({ start: `${RUN_PREFIX}${flowId}:`, end: `${RUN_PREFIX}${flowId}:￿` })].map((e) => e.value as AutomationRun);
    return runs.slice(-limit).reverse();
  }

  public saveLastTriggerContext(flowId: string, payload: Record<string, unknown>): void {
    this.dbs.automationStateDB.put(`${CONTEXT_PREFIX}${flowId}`, payload);
  }

  public getLastTriggerContext(flowId: string): Record<string, unknown> | undefined {
    return this.dbs.automationStateDB.get(`${CONTEXT_PREFIX}${flowId}`) as Record<string, unknown> | undefined;
  }

  public async setLastRun(id: string, lastRun: DBAutomation['lastRun']): Promise<void> {
    await this.dbs.commit(this.dbs.automationsDB, id, (current) => {
      if (!current) return undefined;

      current.lastRun = lastRun;

      return current;
    });
  }

  public async disableFlowsReferencingCamera(cameraId: string): Promise<DBAutomation[]> {
    const candidates = [...this.dbs.automationsDB.getRange()]
      .filter(({ value }) => !value.requiresUpdate && value.nodes.some((n) => n.data.cameraId === cameraId || n.data.targetId === cameraId))
      .map(({ value }) => value._id);

    const affected = await Promise.all(
      candidates.map((id) =>
        this.dbs.commit(this.dbs.automationsDB, id, (current) => {
          if (!current || current.requiresUpdate) return undefined;

          current.requiresUpdate = true;
          current.enabled = false;

          return current;
        }),
      ),
    );

    return affected.filter((flow) => flow !== undefined);
  }

  public async importBlueprint(input: ImportBlueprintInput): Promise<DBAutomation> {
    const idMap = new Map<string, string>();
    const nodes = input.nodes.map((node) => {
      const newId = randomBytes(6).toString('hex');
      idMap.set(node.id, newId);
      return { ...node, id: newId };
    });

    const edges = input.edges.map((edge) => ({
      ...edge,
      id: randomBytes(6).toString('hex'),
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
    }));

    const flow = { nodes, edges };
    if (input.version === 1) {
      normalizeSwitchCaseHandles(flow);
    }

    return this.create({
      name: input.name,
      enabled: false,
      nodes: flow.nodes,
      edges: flow.edges,
      suppressDuplicates: false,
      singleExecution: false,
    });
  }

  public exportBlueprint(id: string): { version: number; name: string; nodes: DBAutomation['nodes']; edges: DBAutomation['edges'] } | undefined {
    const automation = this.getById(id);
    if (!automation) return undefined;

    return {
      version: 2,
      name: automation.name,
      nodes: automation.nodes,
      edges: automation.edges,
    };
  }

  private ensureWebhookSecrets(nodes: DBAutomation['nodes']): DBAutomation['nodes'] {
    return nodes.map((node) => {
      if (node.type === 'trigger-webhook' && !node.data.webhookSecret) {
        return { ...node, data: { ...node.data, webhookSecret: randomBytes(32).toString('hex') } };
      }
      if (node.type === 'trigger-geofence') {
        const data = { ...node.data };
        data.geofenceId ??= randomBytes(12).toString('hex');
        const users = (data.users as string[] | undefined) ?? [];
        const existing = (data.geofenceUserSecrets as Record<string, string> | undefined) ?? {};
        const secrets: Record<string, string> = {};
        for (const username of users) {
          secrets[username] = existing[username] ?? randomBytes(32).toString('hex');
        }
        data.geofenceUserSecrets = secrets;
        return { ...node, data };
      }
      return node;
    });
  }

  private async clearRunState(flowId: string): Promise<void> {
    const keys = [...this.dbs.automationStateDB.getRange({ start: `${RUN_PREFIX}${flowId}:`, end: `${RUN_PREFIX}${flowId}:￿` })].map((e) => e.key);
    await Promise.all(keys.map((k) => this.dbs.automationStateDB.remove(k)));
    await this.dbs.automationStateDB.remove(`${CONTEXT_PREFIX}${flowId}`);
  }

  private notifyEngine(flowId: string): void {
    try {
      const engine = inject('automationEngine');
      engine.onFlowChanged(flowId);
    } catch (error) {
      this.logger.warn(`Failed to notify automation engine: ${error}`);
    }
  }

  private notifyEngineDeleted(flowId: string): void {
    try {
      const engine = inject('automationEngine');
      engine.onFlowDeleted(flowId);
    } catch (error) {
      this.logger.warn(`Failed to notify automation engine: ${error}`);
    }
  }
}
