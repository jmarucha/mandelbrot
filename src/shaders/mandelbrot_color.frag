#version 300 es
precision highp float;

uniform vec2      u_resolution;
uniform sampler2D u_texZDZ;
uniform sampler2D u_texIter;
uniform float     u_time;
uniform float     u_scale;
uniform float     u_debug;
uniform int       u_colouring_mode; // 0 = DISTANCE_ESTIMATE, 1 = ITER_NUM
uniform int       u_shade_de;        // 1 = shade based on DE, 0 = flat colour

out vec4 fragColor;

#define ESCAPE_RADIUS 8192.0

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  vec4 zdz  = texture(u_texZDZ,  uv);
  vec4 iter = texture(u_texIter, uv);

  float n       = iter.r;
  float escaped = iter.g;

  if (escaped < 0.5) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 z  = zdz.xy;
  vec2 dz = zdz.zw;

  float smooth_i = n - log2(log(dot(z, z)) / log(ESCAPE_RADIUS));

  float d = sqrt(dot(z, z) / dot(dz, dz) /4.) * log(dot(z, z));
  float d_pixels = d / u_scale * u_resolution.x * 2.0;
  float l = clamp(d_pixels+0.2, 0.0, 1.0);

  float phase = u_time / 1000.0 + smooth_i * 0.5;
  if (u_colouring_mode == 1) {
    phase = u_time / 1000.0 + smooth_i * 0.5;
  } else {
    phase = u_time / 1000.0 + log((d_pixels+0.25)/50.);
  }

  vec3 col = (0.5 + 0.5 * cos(3.0 + phase * vec3(1.0, 0.7, 0.4)));

  if (u_shade_de == 1) {
    col *= l;
  }

  fragColor = vec4(col, 1.0);
}
