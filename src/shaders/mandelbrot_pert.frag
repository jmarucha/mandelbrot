precision highp float;

uniform vec2      u_resolution;
uniform vec2      u_center;
uniform float     u_scale;
uniform int       u_maxIter;
uniform sampler2D u_colormap;
uniform int       u_colormapIterNumber;
uniform int       u_debug;
uniform vec2      u_origin;

vec2 cmul(vec2 a, vec2 b) {
  return vec2(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

vec2 get_z0(int n) {
  int y = n / 256;
  int x = (n < 256) ? n : n - y * 256;
  return texture2D(u_colormap, vec2(
    float(x)/255.,
    float(y)/255.
    )).xy;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

  vec2 c = uv * u_scale + u_center;
  vec2 dc =  uv * u_scale + (u_center - u_origin);
  vec2 dz = vec2(0.0);

  vec2 z = vec2(0.0);
  float i = 0.0;

  vec2 z0;
  for (int n = 0; n < 1024; n++) {
    if (n < u_colormapIterNumber) {
      z0 = get_z0(n);
    }

    if (n >= u_maxIter) break;
    if (u_debug == 0) {
      if (dot(z0+dz, z0+dz) > 4.0) break;
    } else {
    if (dot(z, z) > 4.0) break;
    }
    z = cmul(z, z) + c;
    
    dz = cmul(dz, dz+2.*z0)+dc;

    i += 1.0;
  }
  //  z = cmul(z, z) + c;
  float t = i / float(u_maxIter);
  vec3 col = 0.5 + 0.5 * cos(3.0 + t * 6.2832 * vec3(1.0, 0.7, 0.4));

  // crosshair at reference origin: dc == 0 exactly there
  // one-pixel size expressed in dc units
  vec2 dc_px = vec2(u_resolution.x / u_resolution.y, 1.0) * u_scale / u_resolution;
  if (abs(dc.x) < dc_px.x || abs(dc.y) < dc_px.y) {
    col = vec3(1.0, 0.0, 0.0);
  }

  gl_FragColor = (i == float(u_maxIter)) ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(col, 1.0);
}
