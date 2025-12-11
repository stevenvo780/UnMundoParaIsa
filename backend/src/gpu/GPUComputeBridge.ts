import { Worker } from "node:worker_threads";
import { Logger } from "../utils/Logger";
import {
  DiffuseDecayRequest,
  GPUJobType,
  GPUWorkerLifecycleMessage,
  GPUWorkerRequest,
  AdvectResourceRequest,
} from "./messages";

interface DiffuseDecayParams {
  width: number;
  height: number;
  diffusion: number;
  decay: number;
  maxValue: number;
  input: SharedArrayBuffer;
  output: SharedArrayBuffer;
}

interface AdvectParams {
  width: number;
  height: number;
  maxFlow: number;
  deltaTime: number;
  resourceInput: SharedArrayBuffer;
  velocityX: SharedArrayBuffer;
  velocityY: SharedArrayBuffer;
  output: SharedArrayBuffer;
}

const DEFAULT_MIN_ELEMENTS = 256 * 256;
const DEFAULT_TIMEOUT_MS = 2000;

export class GPUComputeBridge {
  private static instance?: GPUComputeBridge;

  static getInstance(): GPUComputeBridge {
    if (!GPUComputeBridge.instance) {
      GPUComputeBridge.instance = new GPUComputeBridge();
    }
    return GPUComputeBridge.instance;
  }

  private worker?: Worker;
  private ready = false;
  private jobCounter = 0;
  private destroyed = false;
  private readonly minElements: number;
  private readonly waitTimeoutMs: number;

  private constructor() {
    const envMinElements = parseInt(process.env.GPU_MIN_ELEMENTS ?? "", 10);
    const envTimeout = parseInt(process.env.GPU_JOB_TIMEOUT_MS ?? "", 10);

    this.minElements = Number.isNaN(envMinElements)
      ? DEFAULT_MIN_ELEMENTS
      : Math.max(envMinElements, 1);
    this.waitTimeoutMs = Number.isNaN(envTimeout)
      ? DEFAULT_TIMEOUT_MS
      : Math.max(envTimeout, 100);

    if (process.env.DISABLE_GPU === "1") {
      Logger.warn("[GPU] Hardware acceleration disabled via DISABLE_GPU=1");
      this.destroyed = true;
      return;
    }

    this.spawnWorker();
  }

  isReady(): boolean {
    return this.ready && !this.destroyed;
  }

  tryDiffuseDecay(params: DiffuseDecayParams): boolean {
    if (
      !this.isReady() ||
      params.width * params.height < this.minElements ||
      (params.diffusion === 0 && params.decay === 0)
    ) {
      return false;
    }

    const request: DiffuseDecayRequest = {
      id: ++this.jobCounter,
      type: GPUJobType.DIFFUSE_DECAY,
      width: params.width,
      height: params.height,
      diffusion: params.diffusion,
      decay: params.decay,
      maxValue: params.maxValue,
      input: params.input,
      output: params.output,
      signal: new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT),
    };

    return this.runJob(request);
  }

  tryAdvectResource(params: AdvectParams): boolean {
    if (!this.isReady() || params.width * params.height < this.minElements) {
      return false;
    }

    const request: AdvectResourceRequest = {
      id: ++this.jobCounter,
      type: GPUJobType.ADVECT_RESOURCE,
      width: params.width,
      height: params.height,
      maxFlow: params.maxFlow,
      deltaTime: params.deltaTime,
      resourceInput: params.resourceInput,
      velocityX: params.velocityX,
      velocityY: params.velocityY,
      output: params.output,
      signal: new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT),
    };

    return this.runJob(request);
  }

  private runJob(request: GPUWorkerRequest): boolean {
    const worker = this.worker;
    if (!worker || !this.isReady()) return false;

    const signalArray = new Int32Array(request.signal);
    signalArray[0] = 0;

    try {
      worker.postMessage(request);
    } catch (error) {
      Logger.warn("[GPU] Failed to post job to worker:", error);
      this.disableWorker();
      return false;
    }

    const waitResult = Atomics.wait(signalArray, 0, 0, this.waitTimeoutMs);

    if (waitResult === "timed-out") {
      Logger.warn("[GPU] Job timed out, disabling GPU worker");
      this.disableWorker();
      return false;
    }

    if (signalArray[0] !== 1) {
      Logger.warn("[GPU] Job failed inside worker, falling back to CPU");
      return false;
    }

    return true;
  }

  private spawnWorker(): void {
    if (this.worker || this.destroyed) return;

    try {
      const importUrl = new URL(
        import.meta.url.endsWith(".ts") ? "./GPUWorker.ts" : "./GPUWorker.js",
        import.meta.url,
      );

      this.worker = new Worker(importUrl, {
        execArgv: import.meta.url.endsWith(".ts")
          ? ["--loader", "tsx"]
          : undefined,
      });

      this.worker.on("message", (message: GPUWorkerLifecycleMessage) => {
        if (message.type === "gpu-ready") {
          this.ready = true;
          const info = message.adapterInfo?.name ?? "unknown adapter";
          Logger.info(`[GPU] WebGPU worker ready (${info})`);
        } else if (message.type === "gpu-error") {
          Logger.error(`[GPU] Worker error: ${message.error}`);
          if (message.jobId === undefined) {
            this.disableWorker();
          }
        }
      });

      this.worker.on("error", (err) => {
        Logger.error("[GPU] Worker crashed:", err);
        this.disableWorker();
      });

      this.worker.on("exit", (code) => {
        if (code !== 0) {
          Logger.warn(`[GPU] Worker exited with code ${code}`);
        }
        this.disableWorker();
      });
    } catch (error) {
      Logger.warn("[GPU] Unable to start worker:", error);
      this.disableWorker();
    }
  }

  private disableWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
    this.ready = false;
    this.destroyed = true;
  }
}
