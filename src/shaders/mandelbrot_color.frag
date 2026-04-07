#version 300 es
precision highp float;

uniform vec2      u_resolution;
uniform sampler2D u_texZDZ;
uniform sampler2D u_texIter;
uniform float     u_time;
uniform float     u_scale;

out vec4 fragColor;

#define ESCAPE_RADIUS 16.0

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

  float d = sqrt(dot(z, z) * log(dot(z, z)) / dot(dz, dz));
  d = d / u_scale * u_resolution.x * 2.0;

  float l = clamp(d, 0.0, 1.0);

  vec3 col = l * (0.5 + 0.5 * cos(3.0 + u_time / 1000.0 + smooth_i * 0.5 * vec3(1.0, 0.7, 0.4)));

  fragColor = vec4(col, 1.0);
}
