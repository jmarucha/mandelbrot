precision highp float;

uniform vec2      u_resolution;
uniform vec2      u_center;
uniform float     u_scale;
uniform int       u_maxIter;
uniform sampler2D u_colormap;
uniform int       u_colormapIterNumber;
uniform int       u_debug;
uniform vec2      u_origin;

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
  return texture2D(u_colormap, vec2(
    float(x)/float(BUFF_SIZE),
    float(y)/float(BUFF_SIZE)
    ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

  vec2 c = uv * u_scale + u_center;
  vec2 dc = uv * u_scale + (u_center - u_origin);
  vec2 z_pert = vec2(0.0);

  vec2 z = vec2(0.0);
  int i = 0;

  vec2 z0;
  for (int n = 1; n < 2048; n++) {
    if (n >= u_maxIter) break;
    if (n >= u_colormapIterNumber) break;
    if (dot(z0+z_pert, z0+z_pert) > ESCAPE_RADIUS) break;

    z_pert = cmul(z_pert, z_pert+2.*z0)+dc; // z_pert(n-1) -> z_pert(n)
    z0 = get_precalc(n).xy;
    i += 1;
  }
  z = z0 + z_pert;
  for (int n = 0; n < 2048; n++) {
    if (i >= u_maxIter) break;
    if (dot(z, z) > ESCAPE_RADIUS) break;

    z = cmul(z, z) + c;
    i += 1;
  }
  float t = 1.-float(i) / float(u_maxIter);
  vec3 col = vec3(t, t/256., t/65536.);
  gl_FragColor = vec4(col, 1.0);
}
