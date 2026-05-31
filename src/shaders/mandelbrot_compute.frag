#version 300 es
precision highp float;

uniform vec2      u_resolution;
uniform vec2      u_center;
uniform float     u_scale;
uniform int       u_maxIter;
uniform sampler2D u_colormap;
uniform int       u_colormapIterNumber;
uniform vec2      u_dcenter;  // precomputed: u_center - origin
uniform vec2      u_trapPoint0;
uniform vec2      u_trapPoint1;
uniform vec2      u_trapPoint2;
uniform vec2      u_trapPoint3;

layout(location = 0) out vec4 o_zdz;   // Re(z), Im(z), Re(dz), Im(dz)
layout(location = 1) out vec4 o_iter;  // n, escaped (0/1), 0, 0
layout(location = 2) out vec4 o_traps; // orbit trap values
layout(location = 3) out vec4 o_ptTraps; // point trap distances

#define BUFF_SIZE 64
#define ESCAPE_RADIUS 4096.0

vec2 cmul(vec2 a, vec2 b) {
  return vec2(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

vec2 cdiv(vec2 a, vec2 b) {
  float d = dot(b, b);
  return vec2(a.x*b.x + a.y*b.y, a.y*b.x - a.x*b.y) / d;
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
  vec2 dc = uv * u_scale + u_dcenter;

  vec2 z_pert  = vec2(0.0);
  vec2 dz_pert = vec2(0.0);
  vec2 z0  = vec2(0.0);
  vec2 dz0 = vec2(0.0);

  vec2 z  = vec2(0.0);
  vec2 dz = vec2(1.0, 0.0);
  int i = 1;

  // orbit traps: track minima during iteration
  float trapMinR2   = 1e20; // min |z|^2
  float trapMinAbsX = 1e20; // min |Re(z)|
  float trapMinAbsY = 1e20; // min |Im(z)|
  float trapMinPt   = 1e20; // min |z - (-1,0)|^2
  float ptTrap0 = 1e20;
  float ptTrap1 = 1e20;
  float ptTrap2 = 1e20;
  float ptTrap3 = 1e20;

  for (int n = 1; n < 2048; n++) {
    if (n >= u_maxIter) break;
    if (n >= u_colormapIterNumber) break;
    if (dot(z0 + z_pert, z0 + z_pert) > ESCAPE_RADIUS) break;

    dz_pert = 2.0 * cmul(z0 + z_pert, dz_pert) + vec2(1.0, 0.0);
    z_pert  = cmul(z_pert, z_pert + 2.0 * z0) + dc;
    z0  = get_precalc(n).xy;
    dz0 = get_precalc(n).zw;
    i += 1;

    vec2 zFull = z0 + z_pert;
    trapMinR2   = min(trapMinR2,   dot(zFull, zFull));
    trapMinAbsX = min(trapMinAbsX, abs(zFull.x));
    trapMinAbsY = min(trapMinAbsY, abs(zFull.y));
    vec2 dp = zFull - vec2(-1.0, 0.0);
    trapMinPt   = min(trapMinPt,   dot(dp, dp));
    ptTrap0 = min(ptTrap0, length(zFull - u_trapPoint0));
    ptTrap1 = min(ptTrap1, length(zFull - u_trapPoint1));
    ptTrap2 = min(ptTrap2, length(zFull - u_trapPoint2));
    ptTrap3 = min(ptTrap3, length(zFull - u_trapPoint3));
  }

  z  = z0 + z_pert;
  dz = 1.41 * dz_pert;

  for (int n = 0; n < 2048; n++) {
    if (i >= u_maxIter) break;
    if (dot(z, z) > ESCAPE_RADIUS) break;

    dz = 2.0 * cmul(z, dz) + 1.0;
    z  = cmul(z, z) + c;
    i += 1;

    trapMinR2   = min(trapMinR2,   dot(z, z));
    trapMinAbsX = min(trapMinAbsX, abs(z.x));
    trapMinAbsY = min(trapMinAbsY, abs(z.y));
    vec2 dp2 = z - vec2(-1.0, 0.0);
    trapMinPt   = min(trapMinPt,   dot(dp2, dp2));
    ptTrap0 = min(ptTrap0, length(z - u_trapPoint0));
    ptTrap1 = min(ptTrap1, length(z - u_trapPoint1));
    ptTrap2 = min(ptTrap2, length(z - u_trapPoint2));
    ptTrap3 = min(ptTrap3, length(z - u_trapPoint3));
  }

  float escaped = (i < u_maxIter) ? 1.0 : 0.0;
  o_zdz  = vec4(z, dz);
  o_iter = vec4(float(i), escaped, 0.0, 0.0);
  o_traps = 0.5+0.5*sin(-log(vec4(sqrt(trapMinR2), trapMinAbsX, trapMinAbsY, sqrt(trapMinPt))));
  o_ptTraps = 0.5+0.5*sin(-log(vec4(ptTrap0, ptTrap1, ptTrap2, ptTrap3)));
}
