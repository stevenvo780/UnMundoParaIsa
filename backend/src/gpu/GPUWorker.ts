/// <reference types="@webgpu/types" />
import { parentPort } from "node:worker_threads";
import { create, globals } from "webgpu";
import {
  DiffuseDecayRequest,
  GPUJobType,
  GPUWorkerRequest,
  GPUWorkerErrorMessage,
  AdvectResourceRequest,
} from "./messages";

const WORKGROUP_SIZE = 16;

const port = parentPort;
if (!port) {
  throw new Error("GPU worker must be started as a worker thread");
}

Object.assign(globalThis, globals);
const navigatorRef = { gpu: create([]) };

const adapter = await navigatorRef.gpu.requestAdapter();
if (!adapter) {
  port.postMessage({
    type: "gpu-error",
    error: "No compatible GPU adapter found",
  } satisfies GPUWorkerErrorMessage);
  process.exit(1);
}

const device = await adapter.requestDevice();

port.postMessage({
  type: "gpu-ready",
});

port.on("message", (message: GPUWorkerRequest) => {
  handleMessage(message).catch((error: unknown) => {
    const err =
      error instanceof Error ? error.message : `Unknown GPU error: ${error}`;
    port.postMessage({
      type: "gpu-error",
      error: err,
      jobId: message.id,
    } satisfies GPUWorkerErrorMessage);
    signalJob(message.signal, false);
  });
});

let diffusePipeline: GPUComputePipeline | null = null;
let advectPipeline: GPUComputePipeline | null = null;

async function handleMessage(message: GPUWorkerRequest): Promise<void> {
  switch (message.type) {
    case GPUJobType.DIFFUSE_DECAY:
      await runDiffuseDecay(message);
      signalJob(message.signal, true);
      break;
    case GPUJobType.ADVECT_RESOURCE:
      await runAdvection(message);
      signalJob(message.signal, true);
      break;
    default:
      throw new Error("Unsupported GPU job type");
  }
}

function signalJob(signalBuffer: SharedArrayBuffer, success: boolean): void {
  const signal = new Int32Array(signalBuffer);
  Atomics.store(signal, 0, success ? 1 : -1);
  Atomics.notify(signal, 0, 1);
}

function getDiffusePipeline(): GPUComputePipeline {
  if (diffusePipeline) return diffusePipeline;

  diffusePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: /* wgsl */ `
          struct Field {
            values: array<f32>;
          };

          struct Params {
            dim: vec2<f32>;
            config0: vec2<f32>;
            config1: vec2<f32>;
          };

          @group(0) @binding(0) var<storage, read> inputField : Field;
          @group(0) @binding(1) var<storage, read_write> outputField : Field;
          @group(0) @binding(2) var<uniform> params : Params;

          @compute @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
          fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
            let width = u32(params.dim.x + 0.5);
            let height = u32(params.dim.y + 0.5);

            let x = global_id.x;
            let y = global_id.y;
            if (x >= width || y >= height) {
              return;
            }

            let index = y * width + x;
            let center = inputField.values[index];

            var sum = 0.0;
            var count = 0.0;

            for (var dy = -1; dy <= 1; dy = dy + 1) {
              for (var dx = -1; dx <= 1; dx = dx + 1) {
                if (dx == 0 && dy == 0) {
                  continue;
                }

                let nx = i32(x) + dx;
                let ny = i32(y) + dy;

                if (nx >= 0 && nx < i32(width) && ny >= 0 && ny < i32(height)) {
                  let nIndex = u32(ny) * width + u32(nx);
                  sum = sum + inputField.values[nIndex];
                  count = count + 1.0;
                }
              }
            }

            let avg = select(0.0, sum / count, count > 0.0);
            let diffused = center + params.config0.x * (avg - center);
            let decayed = diffused * (1.0 - params.config0.y);

            outputField.values[index] = clamp(decayed, 0.0, params.config1.x);
          }
        `,
      }),
      entryPoint: "main",
    },
  });

  return diffusePipeline;
}

async function runDiffuseDecay(request: DiffuseDecayRequest): Promise<void> {
  const { width, height, diffusion, decay, maxValue } = request;
  const elementCount = width * height;
  const byteLength = elementCount * Float32Array.BYTES_PER_ELEMENT;

  const inputArray = new Float32Array(request.input);
  const outputArray = new Float32Array(request.output);

  const inputBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(inputBuffer, 0, inputArray);

  const outputBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const uniformData = new Float32Array(8);
  uniformData[0] = width;
  uniformData[1] = height;
  uniformData[2] = diffusion;
  uniformData[3] = decay;
  uniformData[4] = maxValue;

  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  const bindGroup = device.createBindGroup({
    layout: getDiffusePipeline().getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } },
      { binding: 2, resource: { buffer: uniformBuffer } },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(getDiffusePipeline());
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(
    Math.ceil(width / WORKGROUP_SIZE),
    Math.ceil(height / WORKGROUP_SIZE),
  );
  pass.end();

  const readbackBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, byteLength);
  device.queue.submit([encoder.finish()]);

  await readbackBuffer.mapAsync(GPUMapMode.READ);
  const mapped = readbackBuffer.getMappedRange();
  outputArray.set(new Float32Array(mapped));
  readbackBuffer.unmap();

  inputBuffer.destroy();
  outputBuffer.destroy();
  uniformBuffer.destroy();
  readbackBuffer.destroy();
}

function getAdvectPipeline(): GPUComputePipeline {
  if (advectPipeline) return advectPipeline;

  advectPipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: /* wgsl */ `
          struct Field {
            values: array<f32>;
          };

          struct AdvectParams {
            dim: vec2<f32>;
            config0: vec2<f32>;
            padding: vec2<f32>;
          };

          @group(0) @binding(0) var<storage, read> resourceField : Field;
          @group(0) @binding(1) var<storage, read> velocityX : Field;
          @group(0) @binding(2) var<storage, read> velocityY : Field;
          @group(0) @binding(3) var<storage, read_write> outputField : Field;
          @group(0) @binding(4) var<uniform> params : AdvectParams;

          fn sampleField(width: u32, height: u32, coord: vec2<f32>) -> f32 {
            let maxX = f32(width) - 1.001;
            let maxY = f32(height) - 1.001;
            let clamped = vec2<f32>(clamp(coord.x, 0.0, maxX), clamp(coord.y, 0.0, maxY));

            let x0 = u32(floor(clamped.x));
            let y0 = u32(floor(clamped.y));
            let x1 = min(x0 + 1u, width - 1u);
            let y1 = min(y0 + 1u, height - 1u);

            let fx = fract(clamped.x);
            let fy = fract(clamped.y);

            let idx00 = y0 * width + x0;
            let idx10 = y0 * width + x1;
            let idx01 = y1 * width + x0;
            let idx11 = y1 * width + x1;

            let v0 = mix(resourceField.values[idx00], resourceField.values[idx10], fx);
            let v1 = mix(resourceField.values[idx01], resourceField.values[idx11], fx);
            return mix(v0, v1, fy);
          }

          @compute @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
          fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
            let width = u32(params.dim.x + 0.5);
            let height = u32(params.dim.y + 0.5);

            let x = global_id.x;
            let y = global_id.y;
            if (x >= width || y >= height) {
              return;
            }

            let idx = y * width + x;
            let maxFlow = params.config0.x;
            let dt = params.config0.y;

            var vx = clamp(velocityX.values[idx], -maxFlow, maxFlow);
            var vy = clamp(velocityY.values[idx], -maxFlow, maxFlow);

            let samplePos = vec2<f32>(f32(x), f32(y)) - vec2<f32>(vx * dt, vy * dt);
            outputField.values[idx] = sampleField(width, height, samplePos);
          }
        `,
      }),
      entryPoint: "main",
    },
  });

  return advectPipeline;
}

async function runAdvection(request: AdvectResourceRequest): Promise<void> {
  const { width, height, maxFlow, deltaTime } = request;
  const elementCount = width * height;
  const byteLength = elementCount * Float32Array.BYTES_PER_ELEMENT;

  const resourceArray = new Float32Array(request.resourceInput);
  const velXArray = new Float32Array(request.velocityX);
  const velYArray = new Float32Array(request.velocityY);
  const outputArray = new Float32Array(request.output);

  const resourceBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(resourceBuffer, 0, resourceArray);

  const velXBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(velXBuffer, 0, velXArray);

  const velYBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(velYBuffer, 0, velYArray);

  const outputBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const uniformData = new Float32Array(8);
  uniformData[0] = width;
  uniformData[1] = height;
  uniformData[2] = maxFlow;
  uniformData[3] = deltaTime;

  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  const bindGroup = device.createBindGroup({
    layout: getAdvectPipeline().getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: resourceBuffer } },
      { binding: 1, resource: { buffer: velXBuffer } },
      { binding: 2, resource: { buffer: velYBuffer } },
      { binding: 3, resource: { buffer: outputBuffer } },
      { binding: 4, resource: { buffer: uniformBuffer } },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(getAdvectPipeline());
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(
    Math.ceil(width / WORKGROUP_SIZE),
    Math.ceil(height / WORKGROUP_SIZE),
  );
  pass.end();

  const readbackBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, byteLength);
  device.queue.submit([encoder.finish()]);

  await readbackBuffer.mapAsync(GPUMapMode.READ);
  const mapped = readbackBuffer.getMappedRange();
  outputArray.set(new Float32Array(mapped));
  readbackBuffer.unmap();

  resourceBuffer.destroy();
  velXBuffer.destroy();
  velYBuffer.destroy();
  outputBuffer.destroy();
  uniformBuffer.destroy();
  readbackBuffer.destroy();
}
