export const GPUJobType = {
  DIFFUSE_DECAY: "diffuse-decay",
  ADVECT_RESOURCE: "advect-resource",
} as const;

export type GPUJobType = (typeof GPUJobType)[keyof typeof GPUJobType];

export interface GPUWorkerReadyMessage {
  type: "gpu-ready";
  adapterInfo?: { name?: string; vendor?: string };
}

export interface GPUWorkerErrorMessage {
  type: "gpu-error";
  error: string;
  jobId?: number;
}

export type GPUWorkerLifecycleMessage =
  | GPUWorkerReadyMessage
  | GPUWorkerErrorMessage;

export interface GPUWorkerRequestBase {
  id: number;
  type: GPUJobType;
  signal: SharedArrayBuffer;
}

export interface DiffuseDecayRequest extends GPUWorkerRequestBase {
  type: typeof GPUJobType.DIFFUSE_DECAY;
  width: number;
  height: number;
  diffusion: number;
  decay: number;
  maxValue: number;
  input: SharedArrayBuffer;
  output: SharedArrayBuffer;
}

export interface AdvectResourceRequest extends GPUWorkerRequestBase {
  type: typeof GPUJobType.ADVECT_RESOURCE;
  width: number;
  height: number;
  maxFlow: number;
  deltaTime: number;
  resourceInput: SharedArrayBuffer;
  velocityX: SharedArrayBuffer;
  velocityY: SharedArrayBuffer;
  output: SharedArrayBuffer;
}

export type GPUWorkerRequest = DiffuseDecayRequest | AdvectResourceRequest;

export interface GPUWorkerJobResult {
  success: boolean;
  error?: string;
}
