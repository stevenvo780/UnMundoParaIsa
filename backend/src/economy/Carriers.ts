/**
 * Carriers.ts - Sistema de Transporte de Recursos
 *
 * Gestiona el transporte activo de recursos entre stockpiles
 * usando partículas especializadas como carriers.
 */

const WORLD_WIDTH = 512;
const WORLD_HEIGHT = 512;

export interface CarrierTask {
  id: string;
  carrierId: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  resourceType: string;
  amount: number;
  progress: number;
  status: "pending" | "pickup" | "delivery" | "completed" | "failed";
  createdAt: number;
  priority: number;
}

export interface CarrierConfig {
  maxCarriers: number;
  carryCapacity: number;
  speedMultiplier: number;
  searchRadius: number;
  timeoutTicks: number;
}

interface TransportRequest {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  resourceType: string;
  amount: number;
  priority: number;
}

/**
 * Sistema de carriers para transporte activo de recursos
 */
export class CarrierSystem {
  private tasks: Map<string, CarrierTask> = new Map();
  private pendingRequests: TransportRequest[] = [];
  private assignedCarriers: Set<number> = new Set();
  private config: CarrierConfig;
  private taskIdCounter = 0;
  private width: number;
  private height: number;

  constructor(
    width: number = WORLD_WIDTH,
    height: number = WORLD_HEIGHT,
    config: Partial<CarrierConfig> = {},
  ) {
    this.width = width;
    this.height = height;
    this.config = {
      maxCarriers: config.maxCarriers ?? 100,
      carryCapacity: config.carryCapacity ?? 10,
      speedMultiplier: config.speedMultiplier ?? 1.5,
      searchRadius: config.searchRadius ?? 32,
      timeoutTicks: config.timeoutTicks ?? 500,
    };
  }

  /**
   * Solicitar transporte de recursos
   */
  requestTransport(
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    resourceType: string,
    amount: number,
    priority: number = 1,
  ): void {
    this.pendingRequests.push({
      sourceX,
      sourceY,
      targetX,
      targetY,
      resourceType,
      amount: Math.min(amount, this.config.carryCapacity),
      priority,
    });

    this.pendingRequests.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Asignar carriers disponibles a tareas pendientes
   */
  assignCarriers(availableParticleIds: number[]): CarrierTask[] {
    const newTasks: CarrierTask[] = [];

    for (const request of [...this.pendingRequests]) {
      if (this.assignedCarriers.size >= this.config.maxCarriers) break;
      if (availableParticleIds.length === 0) break;

      const nearestId = this.findNearestParticle(
        availableParticleIds,
        request.sourceX,
        request.sourceY,
      );

      if (nearestId !== null) {
        const task: CarrierTask = {
          id: `carrier_${this.taskIdCounter++}`,
          carrierId: nearestId,
          sourceX: request.sourceX,
          sourceY: request.sourceY,
          targetX: request.targetX,
          targetY: request.targetY,
          resourceType: request.resourceType,
          amount: request.amount,
          progress: 0,
          status: "pending",
          createdAt: Date.now(),
          priority: request.priority,
        };

        this.tasks.set(task.id, task);
        this.assignedCarriers.add(nearestId);
        availableParticleIds.splice(availableParticleIds.indexOf(nearestId), 1);
        newTasks.push(task);

        const idx = this.pendingRequests.indexOf(request);
        if (idx >= 0) this.pendingRequests.splice(idx, 1);
      }
    }

    return newTasks;
  }

  /**
   * Buscar partícula más cercana a una posición
   */
  private findNearestParticle(
    particleIds: number[],
    x: number,
    y: number,
  ): number | null {
    return particleIds.length > 0 ? particleIds[0] : null;
  }

  /**
   * Actualizar progreso de una tarea
   */
  updateTaskProgress(
    taskId: string,
    carrierX: number,
    carrierY: number,
  ): {
    action:
      | "move_to_source"
      | "move_to_target"
      | "pickup"
      | "deliver"
      | "done"
      | "failed";
    targetX: number;
    targetY: number;
  } {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { action: "failed", targetX: 0, targetY: 0 };
    }

    const distToSource = Math.hypot(
      carrierX - task.sourceX,
      carrierY - task.sourceY,
    );
    const distToTarget = Math.hypot(
      carrierX - task.targetX,
      carrierY - task.targetY,
    );

    switch (task.status) {
      case "pending":
        task.status = "pickup";
        return {
          action: "move_to_source",
          targetX: task.sourceX,
          targetY: task.sourceY,
        };

      case "pickup":
        if (distToSource < 2) {
          task.status = "delivery";
          return {
            action: "pickup",
            targetX: task.targetX,
            targetY: task.targetY,
          };
        }
        return {
          action: "move_to_source",
          targetX: task.sourceX,
          targetY: task.sourceY,
        };

      case "delivery":
        if (distToTarget < 2) {
          task.status = "completed";
          return {
            action: "deliver",
            targetX: task.targetX,
            targetY: task.targetY,
          };
        }
        task.progress =
          1 -
          distToTarget /
            Math.hypot(
              task.targetX - task.sourceX,
              task.targetY - task.sourceY,
            );
        return {
          action: "move_to_target",
          targetX: task.targetX,
          targetY: task.targetY,
        };

      case "completed":
        this.completeTask(taskId);
        return { action: "done", targetX: carrierX, targetY: carrierY };

      default:
        return { action: "failed", targetX: 0, targetY: 0 };
    }
  }

  /**
   * Completar y limpiar una tarea
   */
  completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      this.assignedCarriers.delete(task.carrierId);
      this.tasks.delete(taskId);
    }
  }

  /**
   * Cancelar una tarea
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "failed";
      this.assignedCarriers.delete(task.carrierId);
      this.tasks.delete(taskId);
    }
  }

  /**
   * Verificar y limpiar tareas expiradas
   */
  cleanupExpiredTasks(currentTick: number): void {
    const now = Date.now();
    const timeout = this.config.timeoutTicks * 50;

    for (const [taskId, task] of this.tasks) {
      if (now - task.createdAt > timeout && task.status !== "completed") {
        this.cancelTask(taskId);
      }
    }
  }

  /**
   * Obtener tarea asignada a un carrier
   */
  getTaskForCarrier(carrierId: number): CarrierTask | undefined {
    for (const task of this.tasks.values()) {
      if (task.carrierId === carrierId) {
        return task;
      }
    }
    return undefined;
  }

  /**
   * Verificar si una partícula es carrier
   */
  isCarrier(particleId: number): boolean {
    return this.assignedCarriers.has(particleId);
  }

  /**
   * Obtener estadísticas del sistema
   */
  getStats(): {
    activeCarriers: number;
    pendingRequests: number;
    completedTasks: number;
    tasksByStatus: Record<string, number>;
  } {
    const tasksByStatus: Record<string, number> = {
      pending: 0,
      pickup: 0,
      delivery: 0,
      completed: 0,
      failed: 0,
    };

    for (const task of this.tasks.values()) {
      tasksByStatus[task.status]++;
    }

    return {
      activeCarriers: this.assignedCarriers.size,
      pendingRequests: this.pendingRequests.length,
      completedTasks: tasksByStatus.completed,
      tasksByStatus,
    };
  }

  /**
   * Obtener todas las tareas activas
   */
  getActiveTasks(): CarrierTask[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status !== "completed" && t.status !== "failed",
    );
  }

  /**
   * Obtener direcciones de transporte para visualización
   */
  getTransportRoutes(): Array<{
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    progress: number;
  }> {
    return this.getActiveTasks().map((task) => ({
      sourceX: task.sourceX,
      sourceY: task.sourceY,
      targetX: task.targetX,
      targetY: task.targetY,
      progress: task.progress,
    }));
  }
}
