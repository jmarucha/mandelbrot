#version 300 es
precision highp float;

uniform vec2      u_resolution;
uniform sampler2D u_texZDZ;
uniform sampler2D u_texIter;
uniform sampler2D u_texTraps;
uniform sampler2D u_texPtTraps;
uniform sampler2D u_trapImage;
uniform int       u_hasTrapImage;
uniform float     u_time;
uniform float     u_scale;
uniform float     u_debug;
uniform int       u_colouring_mode_ext; // 0 = DISTANCE_ESTIMATE, 1 = ITER_NUM, 2 = ORBIT_TRAPS, 3 = POINT_TRAPS, 4 = PLAIN_COLOR
uniform int       u_colouring_mode_int; // same enum, for interior
uniform vec3      u_plainColorInt;
uniform vec3      u_plainColorExt;
uniform int       u_shade_de;        // 1 = shade based on DE, 0 = flat colour
uniform float     u_speed;
uniform float     u_phase;
uniform int       u_invert;
uniform int       u_invertInt;

out vec4 fragColor;

#define ESCAPE_RADIUS 8192.0

vec3 fns_swizzle(int t, vec4 rgba) {
    int i = (t % 24) / 6;
    int j_idx = (t % 6) / 2;
    int k_idx = (t % 6) % 2;
    
    int j = j_idx + (j_idx >= i ? 1 : 0);
    
    int lo = min(i, j);
    int hi = max(i, j);
    int k = k_idx;
    k += (k >= lo ? 1 : 0);
    k += (k >= hi ? 1 : 0);
    
    float leftover = 0.01*rgba[6-i-j-k];
    return vec3(
      rgba[i]-leftover,
      rgba[j]-leftover,
      rgba[k]-leftover
    );
}

vec3 fns_swizzle_smooth(float t, vec4 rgba) {
    int t_int = int(t);
    float t_frac = t - floor(t);
    vec3 curr = fns_swizzle(t_int, rgba);
    vec3 next = fns_swizzle(t_int+1, rgba);

    float a = 1.0;
    float t_smooth = pow(t_frac, a) *(1.0 - pow(1.0-t_frac, a));
    return t_smooth*next + (1.-t_smooth)*curr;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  vec4 zdz  = texture(u_texZDZ,  uv);
  vec4 iter = texture(u_texIter, uv);
  vec4 traps = texture(u_texTraps, uv); // r=min|z|, g=min|Re(z)|, b=min|Im(z)|, a=min|z-(-1,0)|
  vec4 ptTraps = texture(u_texPtTraps, uv); // r=pt0, g=pt1, b=pt2

  float n       = iter.r;
  float escaped = iter.g;

  // if (escaped < 0.5) {
  //   fragColor = vec4(0.0, 0.0, 0.0, 1.0);
  //   return;
  // }

  vec2 z  = zdz.xy;
  vec2 dz = zdz.zw;

  float smooth_i = n - log2(log(dot(z, z)) / log(ESCAPE_RADIUS));

  float d = sqrt(dot(z, z) / dot(dz, dz) /4.) * log(dot(z, z));
  float d_pixels = d / u_scale * u_resolution.x * 2.0;
  float l = clamp(d_pixels+0.2, 0.0, 1.0);

  float phase;
  vec3 col;

  int mode = (escaped > 0.5) ? u_colouring_mode_ext : u_colouring_mode_int;

  if (mode == 0) {
    // Distance Estimate
    phase = u_time / 1000.0 + log((d_pixels+0.25)/50.);
    col = (0.5 + 0.5 * cos(3.0 + phase * vec3(1.0, 0.7, 0.4)));
  } else if (mode == 1) {
    // Escape Time
    phase = u_time / 1000.0 + smooth_i * 0.5;
    col = (0.5 + 0.5 * cos(3.0 + phase * vec3(1.0, 0.7, 0.4)));
  } else if (mode == 2) {
    // Orbit Traps
    col = fns_swizzle_smooth(u_time / 1000.0, traps);
  } else if (mode == 3) {
    // Point Traps
    col = fns_swizzle_smooth(u_time / 1000.0, ptTraps);
  } else {
    // Plain Color
    col = (escaped > 0.5) ? u_plainColorExt : u_plainColorInt;
  }
  if (escaped > 0.5 && u_invert == 1) {
    col = vec3(1.0) - col;
  }
  if (escaped < 0.5 && u_invertInt == 1) {
    col = vec3(1.0) - col;
  }

  if (u_shade_de == 1) {
    col *= l;
  }


  if (u_hasTrapImage == 1) {
    col = texture(u_trapImage, traps.ra).rgb;
  }


  fragColor = vec4(col, 1.0);
}
