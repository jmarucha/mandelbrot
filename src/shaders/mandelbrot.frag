precision highp float;

uniform vec2      u_resolution;
uniform vec2      u_center;
uniform float     u_scale;
uniform int       u_maxIter;
uniform sampler2D u_colormap;

vec2 cmul(vec2 a, vec2 b) {
  return vec2(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 c = uv * u_scale + u_center;



  vec2 z = vec2(0.0);
  vec2 dz = vec2(1.,0.);
  float i = 0.0;
  for (int n = 0; n < 2048; n++) {
    if (n >= u_maxIter) break;
    if (dot(z, z) > 4.0) break;
    
    vec4 z0 = texture2D(u_colormap, vec2(float(n), 0.5));

    dz = 2.*cmul(z, dz) + vec2(1.,0.);
    z = cmul(z, z) + c;
    i += 1.0;
  }
  float t = i / float(u_maxIter);
  vec3 col = 0.5 + 0.5 * cos(3.0 + t * 6.2832 * vec3(1.0, 0.7, 0.4));
  gl_FragColor = (i == float(u_maxIter)) ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(col, 1.0);
}
