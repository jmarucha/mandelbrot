precision mediump float;

uniform vec2      u_resolution;
uniform vec2      u_center;
uniform float     u_scale;
uniform int       u_maxIter;
uniform sampler2D u_colormap;
uniform int       u_colormapIterNumber;
uniform int       u_debug;
uniform vec2      u_origin;
uniform float     u_time;


#define PERTURBATION 1
#define BASIC 0

#define BUFF_SIZE 64
#define ESCAPE_RADIUS 16.0

vec2 cmul(vec2 a, vec2 b) {
  return vec2(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

vec2 get_z0(int n) {
  int y = n / BUFF_SIZE;
  int x = (n < BUFF_SIZE) ? n : n - y * BUFF_SIZE;
  return texture2D(u_colormap, vec2(
    float(x)/float(BUFF_SIZE),
    float(y)/float(BUFF_SIZE)
    )).xy;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

  vec2 c = uv * u_scale + u_center;
  vec2 dc =  uv * u_scale + (u_center - u_origin);
  vec2 dz = vec2(0.0);

  vec2 z = vec2(0.0);
  int i = 1;

  vec2 z0 = vec2(0.);
  for (int n = 1; n < 2048; n++) {
    if (n >= u_maxIter) break;
    if (n >= u_colormapIterNumber) break;
    if (dot(z0+dz, z0+dz) > ESCAPE_RADIUS) break;

    dz = cmul(dz, dz+2.*z0)+dc; // dz(n-1) -> dz(n)
    z0 = get_z0(n);

    i += 1;
  }
  z = z0 + dz;
  for (int n = 0; n < 2048; n++) {
    if (i >= u_maxIter) break;
    if (dot(z, z) > ESCAPE_RADIUS) break;
    z = cmul(z, z) + c;
    i += 1;
  }
  float t = float(i) / float(u_maxIter);
  float smooth_i = float(i) - log(dot(z,z))/log(ESCAPE_RADIUS);
  vec3 col = 0.5 + 0.5 * cos(3.0 + smooth_i * 0.1 * vec3(1.0, 0.7, 0.4));

  // crosshair at reference origin: dc == 0 exactly there
  // one-pixel size expressed in dc units
  // vec2 dc_px = vec2(u_time/1000. + u_resolution.x / u_resolution.y, 1.0) * u_scale / u_resolution;
  // if (abs(dc.x) < dc_px.x || abs(dc.y) < dc_px.y) {
  //   col = vec3(1.0, 0.0, 0.0);
  // }

  gl_FragColor = (i == u_maxIter) ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(col, 1.0);
}
