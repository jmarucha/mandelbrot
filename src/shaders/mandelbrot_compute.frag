#version 300 es
precision highp float;

uniform vec2      u_resolution;
uniform vec2      u_center;
uniform float     u_scale;
uniform int       u_maxIter;
uniform sampler2D u_colormap;
uniform int       u_colormapIterNumber;
uniform vec2      u_origin;

layout(location = 0) out vec4 o_zdz;   // Re(z), Im(z), Re(dz), Im(dz)
layout(location = 1) out vec4 o_iter;  // n, escaped (0/1), 0, 0

#define BUFF_SIZE 64
#define ESCAPE_RADIUS 16.0

vec2 cmul(vec2 a, vec2 b) {
  return vec2(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

vec4 get_precalc(int n) {
  int y = n / BUFF_SIZE;
  int x = (n < BUFF_SIZE) ? n : n - y * BUFF_SIZE;
  return texture(u_colormap, vec2(
    float(x) / float(BUFF_SIZE),
    float(y) / float(BUFF_SIZE)
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

  vec2 c  = uv * u_scale + u_center;
  vec2 dc = uv * u_scale + (u_center - u_origin);

  vec2 z_pert  = vec2(0.0);
  vec2 dz_pert = vec2(0.0);
  vec2 z0  = vec2(0.0);
  vec2 dz0 = vec2(0.0);

  vec2 z  = vec2(0.0);
  vec2 dz = vec2(1.0, 0.0);
  int i = 1;

  for (int n = 1; n < 2048; n++) {
    if (n >= u_maxIter) break;
    if (n >= u_colormapIterNumber) break;
    if (dot(z0 + z_pert, z0 + z_pert) > ESCAPE_RADIUS) break;

    dz_pert = 2.0 * cmul(z0 + z_pert, dz_pert) + vec2(1.0, 0.0);
    z_pert  = cmul(z_pert, z_pert + 2.0 * z0) + dc;
    z0  = get_precalc(n).xy;
    dz0 = get_precalc(n).zw;
    i += 1;
  }

  z  = z0 + z_pert;
  dz = 1.41 * dz_pert;

  for (int n = 0; n < 2048; n++) {
    if (i >= u_maxIter) break;
    if (dot(z, z) > ESCAPE_RADIUS) break;

    dz = 2.0 * cmul(z, dz) + 1.0;
    z  = cmul(z, z) + c;
    i += 1;
  }

  float escaped = (i < u_maxIter) ? 1.0 : 0.0;
  o_zdz  = vec4(z, dz);
  o_iter = vec4(float(i), escaped, 0.0, 0.0);
}
