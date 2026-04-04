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
  vec2 dc =  uv * u_scale + (u_center - u_origin);
  vec2 z_pert = vec2(0.0);
  vec2 dz_pert = vec2(0.0);

  vec2 z = vec2(0.0);
  vec2 dz = vec2(1.,0.);
  int i = 1;

  vec2 z0 = vec2(0);
  vec2 dz0 = vec2(0);
  for (int n = 1; n < 2048; n++) {
    if (n >= u_maxIter) break;
    if (n >= u_colormapIterNumber) break;
    if (dot(z0+z_pert, z0+z_pert) > ESCAPE_RADIUS) break;

    dz_pert = 2.0 * cmul(z0 + z_pert, dz_pert) + vec2(1.0, 0.0);
    z_pert = cmul(z_pert, z_pert+2.*z0)+dc; // z_pert(n-1) -> z_pert(n)
    z0 = get_precalc(n).xy;
    dz0 = get_precalc(n).zw;

    i += 1;
  }
  z = z0 + z_pert;
  dz = 1.41*dz_pert;
  for (int n = 0; n < 2048; n++) {
    if (i >= u_maxIter) break;
    if (dot(z, z) > ESCAPE_RADIUS) break;

    dz = 2.*cmul(z,dz)+1.;
    z = cmul(z, z) + c;
    i += 1;
  }
  float smooth_i = float(i) - log2(log(dot(z,z))/log(ESCAPE_RADIUS));
  float t = smooth_i / float(u_maxIter);
  float d = sqrt(dot(z,z) * log(dot(z,z))/dot(dz,dz)); //in mandelbrot coordinates;
  d = d/u_scale*u_resolution.x*2.; // should be ~ in pixels

  float l = (clamp(d,0., 1.));

  vec3 col = l*(0.5 + 0.5 * cos(3.0 + u_time/1000. + smooth_i * 0.5 * vec3(1.0, 0.7, 0.4)));


  // vec3 col = vec3((1.-d), t, 0.);

  // crosshair at reference origin: dc == 0 exactly there
  // one-pixel size expressed in dc units
  // vec2 dc_px = vec2(u_resolution.x / u_resolution.y, 1.0) * u_scale / u_resolution;
  // if (abs(dc.x) < dc_px.x || abs(dc.y) < dc_px.y) {
  //   col = vec3(1.0, 0.0, 0.0);
  // }

  gl_FragColor = (i == u_maxIter) ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(col, 1.0);
}
