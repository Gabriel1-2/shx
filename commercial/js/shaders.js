export const vsSource = `#version 300 es
precision highp float;

in float a_index;
in vec3 a_random;
in vec3 a_customTarget;

uniform mat4 u_matrix;
uniform float u_time;
uniform float u_phase;
uniform float u_transition;
uniform float u_particleCount;
uniform float u_seed;

out vec4 v_color;

// Pseudorandom hash injected with LIVE SOLANA BLOCKHASH SEED
float hash(float n) { return fract(sin(n + u_seed * 100.0) * 1e4); }
float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1 + u_seed * 100.0) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

vec3 getShapeTarget(float phase, float id, float total) {
    vec3 pos = vec3(0.0);
    float t = u_time * 0.5;
    
    // Abstract local time for phase animations
    float localTime = mod(u_time, 15.0); // roughly the phase duration
    
    if (phase < 0.5) {
        // 0: Chaos
        pos = a_random * 800.0;
        pos.y += sin(t * 2.0 + a_random.x * 10.0) * 50.0;
    } else if (phase < 1.5) {
        // 1: Helix
        float r = 160.0;
        float th = (id / total) * 3.14159 * 24.0 + t * 2.0;
        float y = (id / total - 0.5) * 800.0;
        float sX = hash(id * 8.4) > 0.5 ? 1.0 : -1.0; 
        pos = vec3(cos(th) * r * sX, y, sin(th) * r * sX);
        pos += a_random * 8.0;
    } else if (phase < 2.5) {
        // 2: Globe (Latitude / Longitude)
        float r = 250.0;
        float u = hash(id) * 3.14159 * 2.0;
        float v = acos(hash(id*2.1) * 2.0 - 1.0);
        
        float lines = 16.0;
        if (hash(id*3.3) > 0.5) {
            u = round(u / (3.14159 * 2.0 / lines)) * (3.14159 * 2.0 / lines);
            u += (hash(id*4.4) - 0.5) * 0.03; // thin lines
        } else {
            v = round(v / (3.14159 / lines)) * (3.14159 / lines);
            v += (hash(id*5.5) - 0.5) * 0.03;
        }
        
        pos.x = r * sin(v) * cos(u + t);
        pos.y = r * cos(v);
        pos.z = r * sin(v) * sin(u + t);
    } else if (phase < 3.5) {
        // 3: Torus (Jupiter Engine)
        float R = 200.0, r = 60.0;
        float u = hash(id * 1.1) * 3.14159 * 2.0;
        float v = hash(id * 2.2) * 3.14159 * 2.0;
        u += t; v -= t * 2.0;
        pos = vec3((R + r * cos(v)) * cos(u), (R + r * cos(v)) * sin(u), r * sin(v));
        pos += a_random * 5.0;
    } else if (phase < 4.5) {
        // 4: 3D Procedural Tokens (Solana, SHX, Trump)
        pos = a_customTarget;
        if (length(pos) < 0.1) {
            // Hide unused particles far away
            pos = a_random * 2000.0;
        } else {
            // Rotate the token continuously
            float spin = u_time * 0.8;
            mat3 localRot = mat3(
                cos(spin), 0.0, sin(spin),
                0.0, 1.0, 0.0,
                -sin(spin), 0.0, cos(spin)
            );
            pos = localRot * pos;
            
            // Add a slight hover effect
            pos.y += sin(u_time * 4.0) * 15.0;
        }
    } else if (phase < 5.5) {
        // 5: Lock (Opening)
        float isBody = hash(id) < 0.65 ? 1.0 : 0.0;
        
        if (isBody == 1.0) {
            float w = 100.0, h = 80.0, d = 40.0;
            pos.x = (hash(id*1.1) - 0.5) * w;
            pos.y = (hash(id*2.2) - 0.5) * h - 40.0; 
            pos.z = (hash(id*3.3) - 0.5) * d;
            
            // Keyhole
            if (length(pos.xy - vec2(0.0, -20.0)) < 18.0) pos.z += 200.0; 
            if (abs(pos.x) < 8.0 && pos.y < -20.0 && pos.y > -50.0) pos.z += 200.0;
        } else {
            float R = 45.0, r = 12.0;
            float u = hash(id*4.4) * 3.14159; 
            float v = hash(id*5.5) * 3.14159 * 2.0;
            
            float openState = smoothstep(0.0, 4.0, mod(u_time, 10.0)); // Animates open
            
            float shackleRot = openState * 3.14159 * 0.5; 
            float shackleY = 40.0 + openState * 30.0; 
            
            vec3 sPos = vec3((R + r * cos(v)) * cos(u), (R + r * cos(v)) * sin(u), r * sin(v));
            sPos.x -= R; // Pivot right
            mat3 sRot = mat3(
                cos(shackleRot), -sin(shackleRot), 0.0,
                sin(shackleRot), cos(shackleRot), 0.0,
                0.0, 0.0, 1.0
            );
            sPos = sRot * sPos;
            sPos.x += R;
            sPos.y += shackleY; 
            pos = sPos;
        }
    } else if (phase < 6.5) {
        // 6: Mobius
        float u = hash(id * 3.3) * 3.14159 * 2.0;
        float v = (hash(id * 4.4) - 0.5) * 60.0;
        u += t * 0.5;
        float R = 180.0;
        pos.x = (R + v * cos(u * 0.5)) * cos(u);
        pos.y = (R + v * cos(u * 0.5)) * sin(u);
        pos.z = v * sin(u * 0.5);
        pos += a_random * 4.0;
    } else if (phase < 7.5) {
        // 7: Diamond
        float u = hash(id * 5.5) * 3.14159 * 2.0;
        float v = acos(hash(id * 6.6) * 2.0 - 1.0);
        float R = 200.0;
        pos.x = R * sign(cos(u)) * pow(abs(cos(u)), 0.5) * sin(v);
        pos.y = R * sign(sin(u)) * pow(abs(sin(u)), 0.5) * sin(v);
        pos.z = R * sign(cos(v)) * pow(abs(cos(v)), 0.5);
        pos += a_random * 5.0;
    } else if (phase < 8.5) {
        // 8: Wave
        float x = (hash(id * 7.7) - 0.5) * 600.0;
        float z = (hash(id * 8.8) - 0.5) * 600.0;
        float y = sin(x * 0.02 + t * 4.0) * 50.0 + cos(z * 0.02 + t * 3.0) * 50.0;
        pos = vec3(x, y, z);
    } else if (phase < 9.5) {
        // 9: Ring
        float a = hash(id) * 3.14159 * 2.0;
        float r = 250.0 + (hash(id*2.0)-0.5)*10.0;
        pos = vec3(cos(a)*r, (hash(id*3.0)-0.5)*5.0, sin(a)*r);
    } else if (phase < 10.5) {
        // 10: Warp
        float a = hash(id) * 3.14159 * 2.0;
        float r = hash(id*2.0) * 800.0 + 50.0;
        float z = mod(hash(id*3.0) * 2000.0 - t * 1500.0, 2000.0) - 1000.0;
        pos = vec3(cos(a)*r, sin(a)*r, z);
    } else if (phase < 11.5) {
        // 11: People Pushing Wall (Highly Realistic Sideways Pushing)
        float isWall = hash(id) < 0.4 ? 1.0 : 0.0; // 40% wall, 60% people
        float localT = u_time - 92.0; 
        float pushAmt = clamp(localT * 0.5, 0.0, 5.0); 
        
        float globalX = -300.0 + pushAmt * 120.0; // Move left to right
        
        if (isWall == 1.0) {
            float wy = (hash(id*1.1) - 0.5) * 600.0;
            float wz = (hash(id*2.2) - 0.5) * 800.0;
            float wx = globalX + 160.0; // Wall is at the hands
            
            float distToCenter = length(vec2(wy, wz));
            
            // Shatter effect with gravity and explosion
            if (distToCenter < 100.0 + pushAmt * 120.0) {
                float fall = pushAmt * pushAmt * 80.0; // Gravity acceleration
                wx += pushAmt * 200.0 + (hash(id*3.3) * pushAmt * 300.0);
                wy += (hash(id*4.4) - 0.5) * pushAmt * 250.0 - fall; // Explosive Y + Gravity
                wz += (hash(id*5.5) - 0.5) * pushAmt * 250.0;
            }
            pos = vec3(wx, wy, wz);
        } else {
            float figId = floor(hash(id*6.6) * 9.0); // 9 distinct people
            float fzOffset = (figId - 4.0) * 90.0; // Spread along Z (depth)
            float fxOffset = (hash(figId) - 0.5) * 60.0; // Stagger X
            
            float part = hash(id*7.7);
            
            // Uniform random point in sphere
            vec3 rDir = vec3(hash(id*1.1)-0.5, hash(id*2.2)-0.5, hash(id*3.3)-0.5);
            rDir = normalize(rDir) * pow(hash(id*4.4), 0.333);
            
            float walkT = u_time * 8.0 + figId;
            float s1 = sin(walkT); 
            float bounce = abs(cos(walkT)) * 4.0;
            
            // Anatomical Skeleton
            vec3 pelvis = vec3(0.0, 0.0, 0.0);
            vec3 neck = vec3(35.0, 50.0, 0.0); // Leaning heavily forward into the push
            vec3 head = neck + vec3(12.0, 18.0, 0.0);
            
            vec3 lShoulder = neck + vec3(-5.0, -5.0, -15.0);
            vec3 rShoulder = neck + vec3(-5.0, -5.0, 15.0);
            vec3 lHip = pelvis + vec3(0.0, 0.0, -10.0);
            vec3 rHip = pelvis + vec3(0.0, 0.0, 10.0);
            
            vec3 lHand = vec3(80.0, 30.0, -15.0) + vec3(s1*5.0, 0.0, 0.0); // Planted on wall
            vec3 rHand = vec3(80.0, 30.0, 15.0) + vec3(-s1*5.0, 0.0, 0.0);
            vec3 lElbow = mix(lShoulder, lHand, 0.5) + vec3(0.0, -20.0, -10.0); // Elbows out
            vec3 rElbow = mix(rShoulder, rHand, 0.5) + vec3(0.0, -20.0, 10.0);
            
            vec3 lKnee = lHip + vec3(s1 * 30.0, -35.0, 0.0);
            vec3 lFoot = lKnee + vec3(-10.0 + s1 * 20.0, -40.0, 0.0);
            if (s1 < 0.0) { lKnee.y += 15.0; lFoot.y += 20.0; lFoot.x += 15.0; } // Knee bend
            
            vec3 rKnee = rHip + vec3(-s1 * 30.0, -35.0, 0.0);
            vec3 rFoot = rKnee + vec3(-10.0 - s1 * 20.0, -40.0, 0.0);
            if (-s1 < 0.0) { rKnee.y += 15.0; rFoot.y += 20.0; rFoot.x += 15.0; }
            
            vec3 fPos = vec3(0.0);
            
            // Build body from capsules (mix) and spheres (rDir)
            if (part < 0.05) { fPos = head + rDir * 10.0; } // Head
            else if (part < 0.25) { fPos = mix(pelvis, neck, hash(id*8.1)) + rDir * 16.0; } // Torso
            else if (part < 0.30) { fPos = mix(neck, lShoulder, hash(id*8.2)) + rDir * 7.0; } // L Collar
            else if (part < 0.35) { fPos = mix(neck, rShoulder, hash(id*8.3)) + rDir * 7.0; } // R Collar
            else if (part < 0.42) { fPos = mix(lShoulder, lElbow, hash(id*8.4)) + rDir * 6.0; } // L Bicep
            else if (part < 0.49) { fPos = mix(lElbow, lHand, hash(id*8.5)) + rDir * 5.0; } // L Forearm
            else if (part < 0.56) { fPos = mix(rShoulder, rElbow, hash(id*8.6)) + rDir * 6.0; } // R Bicep
            else if (part < 0.63) { fPos = mix(rElbow, rHand, hash(id*8.7)) + rDir * 5.0; } // R Forearm
            else if (part < 0.73) { fPos = mix(lHip, lKnee, hash(id*8.8)) + rDir * 9.0; } // L Thigh
            else if (part < 0.81) { fPos = mix(lKnee, lFoot, hash(id*8.9)) + rDir * 7.0; } // L Calf
            else if (part < 0.91) { fPos = mix(rHip, rKnee, hash(id*9.0)) + rDir * 9.0; } // R Thigh
            else { fPos = mix(rKnee, rFoot, hash(id*9.1)) + rDir * 7.0; } // R Calf
            
            fPos.y += bounce;
            fPos *= 2.0; // Scale up the people
            
            fPos.z += fzOffset;
            fPos.x += globalX + fxOffset;
            
            pos = fPos;
        }

    } else {
        // 12: Logo
        pos = a_customTarget;
        if (length(pos) < 0.1) {
            pos = a_random * 1500.0;
        }
    }
    
    return pos;
}

void main() {
    float id = a_index;
    float total = u_particleCount;
    
    float currPhase = floor(u_phase);
    float prevPhase = max(0.0, currPhase - 1.0);
    
    vec3 prevTarget = getShapeTarget(prevPhase, id, total);
    vec3 currTarget = getShapeTarget(currPhase, id, total);
    
    float t = u_transition;
    float easedT = t < 1.0 ? 1.0 - pow(2.0, -10.0 * t) : 1.0;
    
    vec3 finalPos = mix(prevTarget, currTarget, easedT);
    finalPos += a_random * sin(u_time * 2.0 + id) * 4.0;
    
    gl_Position = u_matrix * vec4(finalPos, 1.0);
    gl_PointSize = (450.0 / gl_Position.w) * (0.4 + hash(id) * 1.6);
    
    // Abstract coloring based on phase and height
    vec3 c1 = vec3(0.015, 0.0, 0.94); // Cobalt Blue
    vec3 c2 = vec3(1.0, 1.0, 1.0);    // White
    vec3 c3 = vec3(0.18, 0.95, 0.41); // SHX Green
    
    vec3 col = vec3(1.0);
    
    if (currPhase >= 11.5 || currPhase == 4.0) {
        // Phase 12 Logo & Phase 4 Tokens: Pure SHX Colors or Trump Colors
        vec3 shxGreen = vec3(0.11, 0.64, 0.47); // #1CA478
        vec3 brightGreen = vec3(0.18, 0.95, 0.41); // #2FF36A
        float logoMix = hash(id*2.5);
        col = mix(shxGreen, brightGreen, logoMix);
        
        if (currPhase == 4.0 && u_time > 39.0) {
            // Trump Token: Gold / White
            vec3 gold = vec3(1.0, 0.84, 0.0);
            col = mix(gold, vec3(1.0), hash(id*3.1));
        }

        // Scanline highlight
        if (sin(finalPos.x * 0.1 + u_time * 5.0) > 0.8) col *= 1.8;
        // Multiply by 0.5 so additive blending doesn't completely blow out
        col *= 0.5;
    } else {
        float mixVal = smoothstep(-150.0, 150.0, finalPos.y);
        col = mix(c1, c2, mixVal);
        if (hash(id * 1.3) > 0.95) col = c3;
        
        // Make the wall shatter glow red hot!
        if (currPhase == 11.0 && finalPos.x > -50.0 && hash(id) < 0.4) {
             col = vec3(1.0, 0.2, 0.1); 
        }
    }
    
    v_color = vec4(col, 1.0);
}
`;

export const fsSource = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main() {
    vec2 pt = gl_PointCoord - vec2(0.5);
    float dist = dot(pt, pt);
    if (dist > 0.25) discard;
    
    // Core of particle is solid, edge is soft
    float core = smoothstep(0.25, 0.05, dist); 
    float glow = smoothstep(0.25, 0.0, dist) * 0.5;
    float alpha = (core + glow) * v_color.a;
    
    // Boost RGB for intense blooming
    outColor = vec4(v_color.rgb * alpha * 2.5, alpha);
}
`;

export const postVsSource = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_texCoord;
void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const postFsSource = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_time;
uniform float u_shake;
out vec4 outColor;

float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

void main() {
    vec2 uv = v_texCoord;
    
    // Screen Shake
    if (u_shake > 0.0) {
        uv.x += sin(u_time * 50.0) * (u_shake * 0.001);
        uv.y += cos(u_time * 40.0) * (u_shake * 0.001);
    }
    
    // Chromatic Aberration
    float caAmt = u_shake * 0.0003;
    float r = texture(u_texture, vec2(uv.x + caAmt, uv.y)).r;
    float g = texture(u_texture, uv).g;
    float b = texture(u_texture, vec2(uv.x - caAmt, uv.y)).b;
    vec3 col = vec3(r, g, b);
    
    // Film Grain
    float noise = (rand(uv * u_time) - 0.5) * 0.06;
    col += noise;
    
    // Vignette
    vec2 pos = (uv - 0.5) * 2.0;
    float len = length(pos);
    float vignette = smoothstep(1.5, 0.5, len);
    col *= vignette;
    
    // Scanline overlay for hacker feel
    float scanline = sin(uv.y * 800.0) * 0.04;
    col -= scanline;
    
    outColor = vec4(col, 1.0);
}
`;
