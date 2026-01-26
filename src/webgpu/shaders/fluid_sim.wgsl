// fluid_sim.wgsl
// 3D Fluid Simulation Compute Shaders

struct FluidUniforms {
  dt: f32,
  width: f32,
  height: f32,
  depth: f32,
  decay: f32,
};

@group(0) @binding(0) var<uniform> uniforms: FluidUniforms;

// Bindings for Double-Buffering (Read -> Write)
// Group 1: Velocity / Density
@group(1) @binding(0) var field_in: texture_3d<f32>;
@group(1) @binding(1) var field_out: texture_storage_3d<rgba16float, write>;

// Sampler for linear interpolation
@group(1) @binding(2) var field_sampler: sampler;

// ----------------------------------------------------------------------------
// ADVECTION
// Moves quantities along the velocity field
// ----------------------------------------------------------------------------
@group(2) @binding(0) var velocity_field: texture_3d<f32>;

@compute @workgroup_size(8, 8, 8)
fn advect(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec3<f32>(uniforms.width, uniforms.height, uniforms.depth);
  let coords = vec3<f32>(global_id);

  if (any(coords >= dims)) { return; }

  // 1. Sample velocity at current position
  // Note: textureSampleLevel requires normalized coordinates [0, 1]
  let uvw = (coords + 0.5) / dims;
  let vel = textureSampleLevel(velocity_field, field_sampler, uvw, 0.0).xyz;

  // 2. Trace back in time
  let dt = uniforms.dt;
  // Scale velocity back to grid units?
  // Uniforms velocity tends to be in grid-units per second.
  // Backtrace coordinate:
  let back_pos = coords - vel * dt;

  // 3. Sample field at previous position
  let back_uvw = (back_pos + 0.5) / dims;
  let new_val = textureSampleLevel(field_in, field_sampler, back_uvw, 0.0);

  // 4. Apply decay
  let decayed = new_val * uniforms.decay;

  textureStore(field_out, global_id, decayed);
}

// ----------------------------------------------------------------------------
// DIFFUSION (Jacobi Iteration)
// ----------------------------------------------------------------------------
// x_new = (x_old + alpha * neighbor_sum) * inverse_beta
struct JacobiUniforms {
  alpha: f32,
  rBeta: f32,
};
@group(3) @binding(0) var<uniform> jacobi: JacobiUniforms;
@group(3) @binding(1) var b_field: texture_3d<f32>; // The 'b' vector in Ax=b (usually previous state or inputs)
@group(3) @binding(2) var x_field: texture_3d<f32>; // The 'x' vector (current guess)

@compute @workgroup_size(8, 8, 8)
fn diffuse(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec3<i32>(i32(uniforms.width), i32(uniforms.height), i32(uniforms.depth));
  let pos = vec3<i32>(global_id);
  
  if (any(pos >= dims)) { return; }

  // Neighbors
  let left   = textureLoad(x_field, pos + vec3<i32>(-1, 0, 0), 0);
  let right  = textureLoad(x_field, pos + vec3<i32>(1, 0, 0), 0);
  let down   = textureLoad(x_field, pos + vec3<i32>(0, -1, 0), 0);
  let up     = textureLoad(x_field, pos + vec3<i32>(0, 1, 0), 0);
  let back   = textureLoad(x_field, pos + vec3<i32>(0, 0, -1), 0);
  let front  = textureLoad(x_field, pos + vec3<i32>(0, 0, 1), 0);

  let bC = textureLoad(b_field, pos, 0);

  // Jacobi step
  let result = (left + right + down + up + back + front) * jacobi.alpha + bC;
  let next_val = result * jacobi.rBeta;

  textureStore(field_out, global_id, next_val);
}

// ----------------------------------------------------------------------------
// DIVERGENCE
// ----------------------------------------------------------------------------
@compute @workgroup_size(8, 8, 8)
fn divergence(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec3<i32>(i32(uniforms.width), i32(uniforms.height), i32(uniforms.depth));
  let pos = vec3<i32>(global_id);

  if (any(pos >= dims)) { return; }

  let left   = textureLoad(field_in, pos + vec3<i32>(-1, 0, 0), 0).x;
  let right  = textureLoad(field_in, pos + vec3<i32>(1, 0, 0), 0).x;
  let down   = textureLoad(field_in, pos + vec3<i32>(0, -1, 0), 0).y;
  let up     = textureLoad(field_in, pos + vec3<i32>(0, 1, 0), 0).y;
  let back   = textureLoad(field_in, pos + vec3<i32>(0, 0, -1), 0).z;
  let front  = textureLoad(field_in, pos + vec3<i32>(0, 0, 1), 0).z;

  let div = 0.5 * ((right - left) + (up - down) + (front - back));

  textureStore(field_out, global_id, vec4<f32>(div, 0.0, 0.0, 1.0));
}

// ----------------------------------------------------------------------------
// GRADIENT SUBTRACTION
// u_new = u_old - gradient(p)
// ----------------------------------------------------------------------------
@group(4) @binding(0) var pressure_field: texture_3d<f32>;

@compute @workgroup_size(8, 8, 8)
fn subtract_gradient(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec3<i32>(i32(uniforms.width), i32(uniforms.height), i32(uniforms.depth));
  let pos = vec3<i32>(global_id);

  if (any(pos >= dims)) { return; }

  let pLeft   = textureLoad(pressure_field, pos + vec3<i32>(-1, 0, 0), 0).x;
  let pRight  = textureLoad(pressure_field, pos + vec3<i32>(1, 0, 0), 0).x;
  let pDown   = textureLoad(pressure_field, pos + vec3<i32>(0, -1, 0), 0).x;
  let pUp     = textureLoad(pressure_field, pos + vec3<i32>(0, 1, 0), 0).x;
  let pBack   = textureLoad(pressure_field, pos + vec3<i32>(0, 0, -1), 0).x;
  let pFront  = textureLoad(pressure_field, pos + vec3<i32>(0, 0, 1), 0).x;

  let old_vel = textureLoad(field_in, pos, 0).xyz;
  let grad = vec3<f32>(pRight - pLeft, pUp - pDown, pFront - pBack) * 0.5;
  let new_vel = old_vel - grad;

  textureStore(field_out, global_id, vec4<f32>(new_vel, 1.0));
}
