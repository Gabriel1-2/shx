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
uniform float u_shake;
uniform float u_audioReact;

out vec4 v_color;
out float v_depth; // Pass depth to fragment for dynamic glow

float hash(float n) { return fract(sin(n + u_seed * 100.0) * 1e4); }
float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1 + u_seed * 100.0) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

vec3 getShapeTarget(float phase, float id, float total) {
    vec3 pos = vec3(0.0);
    float t = u_time * 0.5;
    
    if (phase < 0.5) {
        pos = a_random * 800.0;
        pos.y += sin(t * 2.0 + a_random.x * 10.0) * 50.0;
    } else if (phase < 1.5) {
        float h = 600.0;
        float y = (hash(id*2.0) - 0.5) * h;
        float twist = y * 0.01 + t * 2.0;
        float r = 180.0;
        
        float strand = hash(id) > 0.5 ? 0.0 : 3.14159;
        
        if (hash(id*3.0) < 0.15) {
            float bondT = hash(id*4.0);
            float th1 = twist;
            float th2 = twist + 3.14159;
            vec3 p1 = vec3(cos(th1)*r, y, sin(th1)*r);
            vec3 p2 = vec3(cos(th2)*r, y, sin(th2)*r);
            pos = mix(p1, p2, bondT);
        } else {
            pos = vec3(cos(twist + strand) * r, y, sin(twist + strand) * r);
        }
        pos += a_random * 5.0;
    } else if (phase < 2.5) {
        float r = 250.0;
        float u = hash(id) * 3.14159 * 2.0;
        float v = acos(hash(id*2.1) * 2.0 - 1.0);
        float lines = 16.0;
        if (hash(id*3.3) > 0.5) {
            u = round(u / (3.14159 * 2.0 / lines)) * (3.14159 * 2.0 / lines);
            u += (hash(id*4.4) - 0.5) * 0.03;
        } else {
            v = round(v / (3.14159 / lines)) * (3.14159 / lines);
            v += (hash(id*5.5) - 0.5) * 0.03;
        }
        pos.x = r * sin(v) * cos(u + t);
        pos.y = r * cos(v);
        pos.z = r * sin(v) * sin(u + t);
    } else if (phase < 3.5) {
        // God Candles: An infinite city of pumping candlesticks
        float step = 50.0;
        float cx = round((hash(id*1.1) - 0.5) * 1200.0 / step) * step;
        float cz = round((hash(id*3.3) - 0.5) * 1200.0 / step) * step;
        
        // Base candle height pumped by music
        float pump = pow(max(0.0, sin(t * 8.0 + cx * 0.01 + cz * 0.01)), 4.0) * 400.0;
        float candleH = hash(cx + cz * 0.1) * 300.0 + pump;
        
        float isWick = hash(id*4.4) > 0.8 ? 1.0 : 0.0;
        float px, py, pz;
        
        if (isWick == 1.0) {
            // Thin wick going higher
            px = cx + (hash(id*5.5) - 0.5) * 4.0;
            pz = cz + (hash(id*6.6) - 0.5) * 4.0;
            py = (hash(id*7.7) - 0.5) * (candleH + 200.0);
        } else {
            // Thick candle body
            px = cx + (hash(id*5.5) - 0.5) * 20.0;
            pz = cz + (hash(id*6.6) - 0.5) * 20.0;
            py = (hash(id*7.7) - 0.5) * candleH;
        }
        // Offset downwards so they grow up from the floor
        pos = vec3(px, py - 100.0, pz);
    } else if (phase < 4.5) {
        pos = a_customTarget;
        if (length(pos) < 0.1) {
            pos = a_random * 2000.0;
        } else {
            float spin = u_time * 0.8;
            mat3 localRot = mat3(cos(spin), 0.0, sin(spin), 0.0, 1.0, 0.0, -sin(spin), 0.0, cos(spin));
            pos = localRot * pos;
            pos.y += sin(u_time * 4.0) * 15.0;
        }
    } else if (phase < 5.5) {
        float isBody = hash(id) < 0.65 ? 1.0 : 0.0;
        if (isBody == 1.0) {
            float w = 100.0, h = 80.0, d = 40.0;
            pos.x = (hash(id*1.1) - 0.5) * w;
            pos.y = (hash(id*2.2) - 0.5) * h - 40.0; 
            pos.z = (hash(id*3.3) - 0.5) * d;
            if (length(pos.xy - vec2(0.0, -20.0)) < 18.0) pos.z += 200.0; 
            if (abs(pos.x) < 8.0 && pos.y < -20.0 && pos.y > -50.0) pos.z += 200.0;
        } else {
            float R = 45.0, r = 12.0;
            float u = hash(id*4.4) * 3.14159; 
            float v = hash(id*5.5) * 3.14159 * 2.0;
            float openState = smoothstep(0.0, 4.0, mod(u_time, 10.0));
            float shackleRot = openState * 3.14159 * 0.5; 
            float shackleY = 40.0 + openState * 30.0; 
            vec3 sPos = vec3((R + r * cos(v)) * cos(u), (R + r * cos(v)) * sin(u), r * sin(v));
            sPos.x -= R;
            mat3 sRot = mat3(cos(shackleRot), -sin(shackleRot), 0.0, sin(shackleRot), cos(shackleRot), 0.0, 0.0, 0.0, 1.0);
            sPos = sRot * sPos;
            sPos.x += R;
            sPos.y += shackleY; 
            pos = sPos;
        }
    } else if (phase < 6.5) {
        float u = hash(id * 3.3) * 3.14159 * 2.0;
        float v = (hash(id * 4.4) - 0.5) * 100.0;
        u += t * 1.0;
        float R = 240.0;
        float r = R + v * cos(u * 1.5);
        pos.x = r * cos(u);
        pos.y = r * sin(u);
        pos.z = v * sin(u * 1.5) + sin(u * 3.0) * 120.0;
        pos += a_random * 3.0;
    } else if (phase < 7.5) {
        // Brilliant-Cut Diamond / Diamond Hands
        float r1 = 150.0; 
        float r2 = 250.0; 
        float hTop = 100.0;
        float hMid = 0.0;
        float hBot = -250.0;
        
        float face = floor(hash(id * 1.1) * 16.0); // 16 facets
        float angle = face * (3.14159 * 2.0 / 16.0);
        float nextAngle = (face + 1.0) * (3.14159 * 2.0 / 16.0);
        
        float yT = hash(id * 2.2);
        float u = mix(angle, nextAngle, hash(id * 3.3));
        
        vec3 pTop = vec3(cos(u)*r1, hTop, sin(u)*r1);
        vec3 pMid = vec3(cos(u)*r2, hMid, sin(u)*r2);
        vec3 pBot = vec3(0.0, hBot, 0.0); // Point
        
        if (hash(id*4.4) > 0.5) {
            pos = mix(pTop, pMid, yT); // Crown
        } else {
            pos = mix(pMid, pBot, yT); // Pavilion
        }
        
        if (hash(id*5.5) > 0.8) {
            float rr = sqrt(hash(id*6.6)) * r1;
            float aa = hash(id*7.7) * 3.14159 * 2.0;
            pos = vec3(cos(aa)*rr, hTop, sin(aa)*rr); // Table
        }
        
        float spin = t * 0.5;
        mat3 rotY = mat3(cos(spin), 0.0, sin(spin), 0.0, 1.0, 0.0, -sin(spin), 0.0, cos(spin));
        pos = rotY * pos;
        pos += a_random * 2.0;
    } else if (phase < 8.5) {
        float x = (hash(id * 7.7) - 0.5) * 1000.0;
        float z = (hash(id * 8.8) - 0.5) * 1000.0;
        float d = length(vec2(x, z));
        float y = sin(d * 0.02 - t * 4.0) * 120.0 * exp(-d * 0.001);
        
        x = round(x / 30.0) * 30.0;
        z = round(z / 30.0) * 30.0;
        
        pos = vec3(x, y - 150.0, z);
    } else if (phase < 9.5) {
        // Phase 9: 3D Orderbook (Candlesticks)
        float gridX = floor((hash(id) - 0.5) * 40.0) * 40.0;
        float gridZ = floor((hash(id*2.2) - 0.5) * 40.0) * 40.0;
        float height = pow(hash(gridX * 0.1 + gridZ * 0.2 + 1.2), 3.0) * 500.0 + 50.0;
        
        // Dynamic volume surging
        height += sin(u_time * 5.0 + gridX * 0.05) * 100.0 * u_audioReact;
        
        float py = hash(id*3.3) * height - 200.0;
        
        // Add wick
        float isWick = hash(id*4.4) > 0.8 ? 1.0 : 0.0;
        float px = gridX + (isWick == 0.0 ? (hash(id*5.5)-0.5)*15.0 : 0.0);
        float pz = gridZ + (isWick == 0.0 ? (hash(id*6.6)-0.5)*15.0 : 0.0);
        
        if (isWick == 1.0) py += (hash(id*7.7)-0.5) * 150.0;
        
        pos = vec3(px, py, pz);
    } else if (phase < 10.5) {
        // Phase 10: Hyper-Speed Data Tunnel
        float a = hash(id) * 3.14159 * 2.0;
        float r = 200.0 + hash(id*1.1) * 50.0;
        
        // Tunnel curvature
        float z = (hash(id*2.2) - 0.5) * 2000.0;
        z = mod(z + u_time * 2000.0, 2000.0) - 1000.0; // Fly through speed
        
        float tunnelWarpX = sin(z * 0.002 + u_time) * 100.0;
        float tunnelWarpY = cos(z * 0.002 + u_time) * 100.0;
        
        // Spin the tunnel
        a += u_time * 2.0 + z * 0.001;
        
        pos = vec3(cos(a)*r + tunnelWarpX, sin(a)*r + tunnelWarpY, z);
    } else if (phase < 11.5) {
        // Phase 11: Ring (No Deposits)
        float a = hash(id) * 3.14159 * 2.0;
        float r = 250.0 + (hash(id*2.0)-0.5)*10.0;
        pos = vec3(cos(a)*r, (hash(id*3.0)-0.5)*5.0, sin(a)*r);
    } else if (phase < 12.5) {
        // Phase 12: Black Hole Singularity
        float a = hash(id) * 3.14159 * 2.0;
        float rStart = hash(id*2.0) * 1500.0 + 100.0;
        float localT = u_time - 103.0; // Updated timing
        float progress = clamp(localT / 6.5, 0.0, 1.0); 
        float collapse = pow(progress, 5.0); // Exponential collapse
        
        float r = mix(rStart, 0.0, collapse);
        a += localT * 4.0 * (1.0 / max(0.1, (r/rStart))); // Accretion disk spiral
        float z = (hash(id*3.0) - 0.5) * 400.0 * (1.0 - collapse);
        
        pos = vec3(cos(a)*r, sin(a)*r, z);
    } else if (phase < 13.5) {
        // Phase 13: Wall Push
        float isWall = hash(id) < 0.4 ? 1.0 : 0.0; 
        float localT = u_time - 110.0; // Updated timing
        float pushAmt = clamp(localT * 0.5, 0.0, 5.0); 
        float globalX = -300.0 + pushAmt * 120.0; 
        
        if (isWall == 1.0) {
            float wy = (hash(id*1.1) - 0.5) * 600.0;
            float wz = (hash(id*2.2) - 0.5) * 800.0;
            float wx = globalX + 160.0; 
            
            float chunkID = floor(wy / 50.0) * 100.0 + floor(wz / 50.0);
            float chunkHash = hash(chunkID * 0.1337);
            
            float distToCenter = length(vec2(wy, wz));
            if (pushAmt > 2.0 && distToCenter < (pushAmt - 2.0) * 400.0) {
                float explosionPower = (pushAmt - 2.0) * 150.0;
                wx += explosionPower * (1.0 + chunkHash * 2.0);
                wy += (hash(chunkID * 1.1) - 0.5) * explosionPower * 3.0;
                wz += (hash(chunkID * 2.2) - 0.5) * explosionPower * 3.0;
                wy -= explosionPower * explosionPower * 0.05;
            } else {
                if (distToCenter < 200.0) {
                    wx += pushAmt * 15.0 * (1.0 - distToCenter/200.0);
                }
            }
            pos = vec3(wx, wy, wz);
        } else {
            float isLaser = hash(id*9.9) < 0.02 ? 1.0 : 0.0; // 2% laser
            
            float figId = floor(hash(id*6.6) * 35.0); // 35 people in the swarm! (Massive increase)
            float fzOffset = (hash(figId*1.1) - 0.5) * 500.0; 
            float fxOffset = (hash(figId*2.2) - 0.5) * 200.0 - hash(figId*3.3) * 80.0; // Swarm spread
            
            float part = hash(id*7.7);
            float walkT = u_time * 15.0 + figId;
            float bounce = abs(cos(walkT*2.0)) * 6.0; // More aggressive bounce
            
            // Highly realistic biomechanical pose (pushing hard into a wall)
            float exertion = clamp((pushAmt - 1.0) * 0.5, 0.0, 1.0);
            vec3 pelvis = vec3(-10.0 - exertion * 20.0, -10.0, 0.0); // Lean forward
            vec3 chest = vec3(20.0, 25.0 - exertion * 5.0, 0.0); // Arched back
            vec3 neck = vec3(35.0, 45.0 - exertion * 10.0, 0.0);
            vec3 headCenter = neck + vec3(12.0, 12.0, 0.0);
            
            vec3 lShoulder = chest + vec3(0.0, 10.0, -25.0);
            vec3 rShoulder = chest + vec3(0.0, 10.0, 25.0);
            vec3 handPush = vec3(60.0 + exertion * 15.0, 20.0 + exertion * 10.0, 0.0); // Pushing higher
            
            float footCycleL = fract(walkT/(2.0*3.14159));
            float footCycleR = fract((walkT+3.14159)/(2.0*3.14159));
            float lFootY = footCycleL < 0.5 ? -40.0 : -20.0 + sin(footCycleL*3.14159*2.0)*25.0;
            float rFootY = footCycleR < 0.5 ? -40.0 : -20.0 + sin(footCycleR*3.14159*2.0)*25.0;
            
            // Stride length increases with exertion
            float stride = 70.0 + exertion * 20.0;
            float lFootX = footCycleL < 0.5 ? 20.0 - footCycleL*2.0*stride : -40.0 + (footCycleL-0.5)*2.0*stride;
            float rFootX = footCycleR < 0.5 ? 20.0 - footCycleR*2.0*stride : -40.0 + (footCycleR-0.5)*2.0*stride;
            
            vec3 lFoot = vec3(lFootX, lFootY, -15.0);
            vec3 rFoot = vec3(rFootX, rFootY, 15.0);
            
            vec3 fPos = vec3(0.0);
            float rScale = 1.0;
            
            if (isLaser == 1.0 && pushAmt > 1.0) {
                float sweep = sin(u_time * 12.0 + figId) * 0.8;
                float laserDist = hash(id*8.1) * 500.0 * (pushAmt - 1.0); 
                vec3 rDir = normalize(vec3(hash(id)-0.5, hash(id*2.0)-0.5, hash(id*3.0)-0.5));
                fPos = headCenter + vec3(laserDist, 0.0, laserDist * sweep) + rDir * 2.0; 
            } else {
                if (part < 0.08) { 
                    float u = hash(id*8.8) * 3.14159 * 2.0;
                    float v = acos(hash(id*9.9) * 2.0 - 1.0);
                    float r = 12.0 * pow(hash(id*1.2), 0.33); // Slightly larger head
                    // Head bob offset from body - looks more realistic
                    vec3 headBob = vec3(0.0, sin(walkT * 2.0 + 1.0) * 3.0, sin(walkT) * 2.0);
                    fPos = headCenter + headBob + vec3(r*sin(v)*cos(u), r*cos(v), r*sin(v)*sin(u));
                } else if (part < 0.45) {
                    float h = (part - 0.08) / 0.37;
                    fPos = mix(pelvis, chest, h);
                    // Breathing - chest expands and contracts
                    float breathe = 1.0 + sin(walkT * 0.7) * 0.08;
                    rScale = 18.0 * breathe * (1.0 + sin(h*3.14159)*0.6); // Massive chests (heroic proportions)
                    // Shoulder sway
                    float sway = sin(walkT) * 8.0 * (1.0 - exertion);
                    float a = hash(id*8.8) * 3.14159 * 2.0;
                    float r = rScale * sqrt(hash(id*9.9));
                    fPos += vec3(0.0, r*cos(a), r*sin(a) + sway * h);
                } else if (part < 0.6) { 
                    float h = (part - 0.45) / 0.15;
                    // Arms pump forward and back when walking
                    float armSwing = sin(walkT + 1.57) * 15.0 * (1.0 - exertion * 0.8);
                    vec3 elbow = mix(lShoulder, handPush, 0.4) + vec3(armSwing, -10.0 + armSwing * 0.3, -15.0 * exertion);
                    if (h < 0.5) fPos = mix(lShoulder, elbow, h*2.0);
                    else fPos = mix(elbow, handPush + vec3(0.0,0.0,-10.0), (h-0.5)*2.0);
                    rScale = 9.0 * (1.0 - h*0.4); 
                    float a = hash(id*8.8) * 3.14159 * 2.0;
                    float r = rScale * sqrt(hash(id*9.9));
                    fPos += vec3(r*cos(a), 0.0, r*sin(a));
                } else if (part < 0.75) { 
                    float h = (part - 0.6) / 0.15;
                    float armSwing = sin(walkT + 1.57 + 3.14159) * 15.0 * (1.0 - exertion * 0.8);
                    vec3 elbow = mix(rShoulder, handPush, 0.4) + vec3(armSwing, -10.0 + armSwing * 0.3, 15.0 * exertion);
                    if (h < 0.5) fPos = mix(rShoulder, elbow, h*2.0);
                    else fPos = mix(elbow, handPush + vec3(0.0,0.0,10.0), (h-0.5)*2.0);
                    rScale = 9.0 * (1.0 - h*0.4); 
                    float a = hash(id*8.8) * 3.14159 * 2.0;
                    float r = rScale * sqrt(hash(id*9.9));
                    fPos += vec3(r*cos(a), 0.0, r*sin(a));
                } else if (part < 0.875) { 
                    float h = (part - 0.75) / 0.125;
                    vec3 knee = mix(pelvis + vec3(0.0, 0.0, -18.0), lFoot, 0.5) + vec3(20.0, 0.0, 0.0);
                    // Knee bends more at mid-stride
                    knee.y += sin(footCycleL * 3.14159 * 2.0) * 8.0;
                    if (h < 0.5) fPos = mix(pelvis + vec3(0.0, 0.0, -18.0), knee, h*2.0);
                    else fPos = mix(knee, lFoot, (h-0.5)*2.0);
                    rScale = 12.0 * (1.0 - h*0.5); // Thick thighs
                    float a = hash(id*8.8) * 3.14159 * 2.0;
                    float r = rScale * sqrt(hash(id*9.9));
                    fPos += vec3(r*cos(a), 0.0, r*sin(a));
                } else { 
                    float h = (part - 0.875) / 0.125;
                    vec3 knee = mix(pelvis + vec3(0.0, 0.0, 18.0), rFoot, 0.5) + vec3(20.0, 0.0, 0.0);
                    knee.y += sin(footCycleR * 3.14159 * 2.0) * 8.0;
                    if (h < 0.5) fPos = mix(pelvis + vec3(0.0, 0.0, 18.0), knee, h*2.0);
                    else fPos = mix(knee, rFoot, (h-0.5)*2.0);
                    rScale = 12.0 * (1.0 - h*0.5); 
                    float a = hash(id*8.8) * 3.14159 * 2.0;
                    float r = rScale * sqrt(hash(id*9.9));
                    fPos += vec3(r*cos(a), 0.0, r*sin(a));
                }
            }
            
            fPos.y += bounce;
            fPos *= 2.0; 
            fPos.z += fzOffset;
            fPos.x += globalX + fxOffset;
            pos = fPos;
        }
    } else {
        pos = a_customTarget;
        
        float localT2 = max(0.0, u_time - 118.0);
        if (localT2 < 3.0 && length(pos) > 0.1) {
            float u = hash(id*8.8) * 3.14159 * 2.0;
            float v = acos(hash(id*9.9) * 2.0 - 1.0);
            vec3 sphereDir = vec3(sin(v)*cos(u), cos(v), sin(v)*sin(u));
            
            float force = 0.0;
            if (localT2 < 0.5) {
                // Violent blast outward
                force = sin(localT2 * 2.0 * 3.14159 * 0.5) * 5000.0;
            } else if (localT2 < 2.5) {
                // Gravity well suck back in
                float suckT = (localT2 - 0.5) / 2.0; // 0 to 1
                force = 5000.0 * (1.0 - pow(suckT, 3.0));
            }
            
            if (force > 0.0) {
                pos = mix(pos, sphereDir * force, force / 5000.0);
                float angle = force * 0.002 * (hash(id) > 0.5 ? 1.0 : -1.0);
                float c = cos(angle), s = sin(angle);
                pos.xy = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
                pos.xz = vec2(pos.x * c - pos.z * s, pos.x * s + pos.z * c);
            }
        }
        
        if (length(pos) < 0.1) {
            // "To The Moon" Blast Exhaust
            float localT = max(0.0, u_time - 118.0);
            float blastHeight = localT * 1500.0;
            
            float py = (hash(id*1.1) - 0.5) * blastHeight - 300.0;
            
            // Taper blast at top
            float width = 50.0 + (blastHeight - (py + 300.0)) * 0.1;
            float angle = hash(id*2.2) * 3.14159 * 2.0;
            float r = sqrt(hash(id*3.3)) * width;
            
            float px = cos(angle) * r;
            float pz = sin(angle) * r;
            
            // Noise turbulence in blast
            px += sin(py * 0.05 + u_time * 20.0) * 30.0;
            pz += cos(py * 0.05 + u_time * 20.0) * 30.0;
            
            pos = vec3(px, py, pz);
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
    // Smooth cubic ease-in-out for fluid morphing
    float easedT = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
    easedT = clamp(easedT, 0.0, 1.0);
    
    // Fluid morphing with subtle per-particle stagger
    vec3 finalPos;
    if (t > 0.0 && t < 1.0) {
        // Each particle has a slightly different transition timing
        float particleDelay = hash(id * 9.99) * 0.3; // 0 to 0.3 stagger
        float personalT = clamp((easedT - particleDelay) / (1.0 - particleDelay), 0.0, 1.0);
        
        // Smooth arc path instead of linear interpolation
        vec3 mid = (prevTarget + currTarget) * 0.5;
        mid.y += (hash(id * 5.55) - 0.3) * 100.0 * (1.0 - personalT); // Arc upward
        
        if (personalT < 0.5) {
            finalPos = mix(prevTarget, mid, personalT * 2.0);
        } else {
            finalPos = mix(mid, currTarget, (personalT - 0.5) * 2.0);
        }
        
        // Subtle sparkle/scatter at transition midpoint
        float scatter = sin(personalT * 3.14159) * 20.0;
        finalPos += a_random * scatter;
    } else {
        finalPos = currTarget;
    }
    
    // Add jitter for organic feel
    finalPos += a_random * sin(u_time * 2.0 + id) * 4.0;
    
    // True 3D Holographic Glitch
    if (u_shake > 15.0 && hash(id * 13.37) > 0.8) {
        float tear = (hash(id * 42.0) - 0.5) * u_shake * 15.0;
        if (hash(id * 7.77) > 0.5) finalPos.x += tear;
        else finalPos.z += tear;
    }
    
    gl_Position = u_matrix * vec4(finalPos, 1.0);
    
    // Calculate depth for size and brightness
    v_depth = gl_Position.z / 1000.0; 
    
    // Size scaling based on distance. Closer particles are much larger to simulate bokeh.
    float baseSize = 450.0 / max(0.1, gl_Position.w);
    gl_PointSize = baseSize * (0.5 + hash(id) * 2.5);
    
    // Emissive Colors (HDR values)
    vec3 c1 = vec3(0.05, 0.2, 2.5); // Deep Sci-Fi Blue (emissive > 1.0)
    vec3 c2 = vec3(2.5, 2.5, 2.8);  // Hot White
    vec3 c3 = vec3(0.2, 3.5, 1.2);  // Neon Green
    
    vec3 col = vec3(1.0);
    
    if (currPhase >= 13.5 || currPhase == 4.0 || currPhase == 3.0 || currPhase == 7.0 || currPhase == 9.0 || currPhase == 10.0) {
        vec3 shxGreen = vec3(0.1, 1.5, 0.8); 
        vec3 brightGreen = vec3(0.5, 3.5, 1.2); 
        col = mix(shxGreen, brightGreen, hash(id*2.5));
        
        if (currPhase == 9.0) {
            // Candlesticks are green or red
            float gridX = floor((hash(id) - 0.5) * 40.0) * 40.0;
            float gridZ = floor((hash(id*2.2) - 0.5) * 40.0) * 40.0;
            float isRed = hash(gridX * 0.4 + gridZ * 0.7) > 0.5 ? 1.0 : 0.0;
            if (isRed == 1.0) col = vec3(3.5, 0.1, 0.2); // Red candles
        }
        
        if (currPhase == 10.0) {
            // Tunnel is deep blue and white
            col = mix(vec3(0.1, 0.5, 3.5), vec3(3.0, 3.0, 3.5), hash(id*4.1));
            // Add hyper-speed glow strips
            if (hash(id*7.7) > 0.95) col = vec3(5.0); 
        }
        
        if (currPhase == 4.0 && u_time > 39.0) {
            vec3 gold = vec3(3.0, 2.2, 0.5); // Emissive Gold
            col = mix(gold, vec3(2.5), hash(id*3.1));
        }

        if (sin(finalPos.x * 0.1 + u_time * 5.0) > 0.8) col *= 2.5; // High intensity scanline
    } else {
        float mixVal = smoothstep(-150.0, 150.0, finalPos.y);
        col = mix(c1, c2, mixVal);
        if (hash(id * 1.3) > 0.95) col = c3;
        
        if (currPhase == 13.0) {
            float isWall = hash(id) < 0.4 ? 1.0 : 0.0;
            if (isWall == 1.0) {
                col = vec3(2.5, 0.5, 0.5); // Wall is red/orange
            } else {
                float isLaser = hash(id*9.9) < 0.1 ? 1.0 : 0.0;
                if (isLaser == 1.0) {
                    col = vec3(8.0, 0.1, 0.1); // PURE LASER RED
                } else {
                    col = vec3(0.5, 4.0, 1.5); // GIGACHADS ARE BRIGHT GREEN
                }
            }
        }
    }
    
    // Fade out particles that are too close or behind camera
    float fade = smoothstep(0.1, 50.0, gl_Position.w);
    v_color = vec4(col, fade);
}
`;

export const fsSource = `#version 300 es
precision highp float;
in vec4 v_color;
in float v_depth;
out vec4 outColor;
void main() {
    // Volumetric 3D Shaded Spheres
    vec2 pc = gl_PointCoord - vec2(0.5);
    float dist = length(pc);
    if (dist > 0.5) discard;
    
    // Calculate accurate normal for physical sphere shading
    float z = sqrt(max(0.0, 0.25 - dist * dist)) * 2.0; 
    vec3 normal = normalize(vec3(pc.x * 2.0, -pc.y * 2.0, z));
    
    // Lighting Rig
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0)); // Main directional light
    vec3 backLight = normalize(vec3(-1.0, -1.0, -0.5)); // Rim light
    
    // Lambertian diffuse
    float diff = max(dot(normal, lightDir), 0.0);
    float rim = max(dot(normal, backLight), 0.0);
    
    // Blinn-Phong Specular
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
    
    // Internal Core Glow (simulating energy/heat inside)
    float core = pow(1.0 - (dist * 2.0), 3.0) * 2.5; 
    
    // Combine Surface Shading + Energy Core
    float depthFade = 1.0 - clamp(v_depth, 0.0, 1.0);
    
    vec3 surfaceColor = v_color.rgb * (diff * 0.8 + rim * 0.5 + 0.2); // 0.2 ambient
    surfaceColor += vec3(1.0) * spec * 2.0; // White specular highlights
    
    // Base color mixed with physical shading
    vec3 c = mix(surfaceColor, v_color.rgb * core, 0.5) * depthFade;
    
    outColor = vec4(c, v_color.a);
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
uniform sampler2D u_hudTexture;
uniform float u_time;
uniform float u_shake;
uniform float u_audioReact;

out vec4 outColor;

float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

// ACES Filmic Tonemapping Curve
vec3 ACESFilm(vec3 x) {
    float a = 2.51f;
    float b = 0.03f;
    float c = 2.43f;
    float d = 0.59f;
    float e = 0.14f;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

// Multi-tap Anamorphic Streak (Sci-Fi horizontal flare)
vec3 anamorphicFlare(vec2 uv) {
    vec3 flare = vec3(0.0);
    float weights[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
    float spread = 0.008; // Stretch width
    
    // Only bloom bright pixels (Thresholding)
    for(int i = 1; i < 5; ++i) {
        vec3 colRight = texture(u_texture, uv + vec2(float(i) * spread, 0.0)).rgb;
        vec3 colLeft  = texture(u_texture, uv - vec2(float(i) * spread, 0.0)).rgb;
        
        // Threshold: Only stretch highlights > 1.5
        float tR = max(0.0, dot(colRight, vec3(0.333)) - 1.5);
        float tL = max(0.0, dot(colLeft, vec3(0.333)) - 1.5);
        
        // Add a blue/cyan tint to the flare for that JJ Abrams look
        vec3 flareTint = vec3(0.2, 0.6, 1.0);
        flare += colRight * tR * weights[i] * flareTint * 0.5;
        flare += colLeft  * tL * weights[i] * flareTint * 0.5;
    }
    return flare;
}

// Radial Blur / Fake Depth of Field
vec3 radialBlur(vec2 uv) {
    vec3 color = vec3(0.0);
    vec2 center = vec2(0.5, 0.5);
    vec2 dir = uv - center;
    float dist = length(dir);
    
    // Blur gets stronger towards the edges
    float blurAmount = smoothstep(0.2, 0.8, dist) * 0.02;
    
    for(int i=0; i<8; i++) {
        float scale = 1.0 - float(i) * blurAmount;
        color += texture(u_texture, center + dir * scale).rgb;
    }
    return color / 8.0;
}

void main() {
    // Base UV
    vec2 uv = v_texCoord;
    
    // 1. Cinematic Barrel Distortion (Warp scales with shake intensity)
    vec2 centeredUv = uv - 0.5;
    float distSq = dot(centeredUv, centeredUv);
    float warpAmt = 0.15 + (clamp(u_shake * 0.005, 0.0, 0.5));
    vec2 distortedUv = uv + centeredUv * (distSq * warpAmt);
    uv = mix(uv, distortedUv, 1.0); 
    
    // Screen Shake
    if (u_shake > 0.0) {
        uv.x += sin(u_time * 50.0) * (u_shake * 0.001);
        uv.y += cos(u_time * 40.0) * (u_shake * 0.001);
    }
    
    // 2. Base Image with Volumetric Radial Blur (God Rays)
    vec3 hdrColor = radialBlur(uv);
    
    // 3. Anamorphic Lens Flare
    hdrColor += anamorphicFlare(uv);
    
    // 4. High-Quality Chromatic Aberration based on lens edge AND AUDIO
    float distToCenter = length(uv - 0.5);
    float caAmt = (u_shake * 0.002) + (distToCenter * 0.015) + (u_audioReact * 0.02); // EXTREME Chromatic Aberration
    
    float r = texture(u_texture, vec2(uv.x + caAmt, uv.y)).r;
    float b = texture(u_texture, vec2(uv.x - caAmt, uv.y)).b;
    hdrColor.r = mix(hdrColor.r, r, 0.8);
    hdrColor.b = mix(hdrColor.b, b, 0.8);
    
    // 5. ACES Filmic Tonemapping
    vec3 ldrColor = ACESFilm(hdrColor);
    
    // 6. Cinematic Color Grading (Teal & Orange Hollywood Look)
    // Darken shadows, push them toward teal (0.1, 0.3, 0.4)
    // Push highlights toward orange (1.0, 0.8, 0.5)
    float luma = dot(ldrColor, vec3(0.299, 0.587, 0.114));
    vec3 shadowColor = vec3(0.05, 0.15, 0.2);
    vec3 highlightColor = vec3(1.0, 0.9, 0.7);
    ldrColor = mix(ldrColor * shadowColor * 2.0, ldrColor * highlightColor, smoothstep(0.1, 0.9, luma));
    
    // 7. Film Grain (Photographic Noise + Audio React)
    float noise = fract(sin(dot(uv + u_time, vec2(12.9898, 78.233))) * 43758.5453);
    ldrColor -= noise * (0.05 + u_audioReact * 0.1);
    
    // 8. Cinematic Vignette
    float vignette = smoothstep(1.3, 0.4, distToCenter * 2.0);
    ldrColor *= vignette;
    
    // 9. EMP Shockwave Ripple
    float maxShake = 200.0;
    if (u_shake > 10.0 && u_shake <= maxShake) {
        float shockProgress = 1.0 - (u_shake / maxShake);
        float shockRadius = shockProgress * 1.5; 
        
        float ringThickness = 0.05;
        float distToRing = abs(distToCenter - shockRadius);
        
        if (distToRing < ringThickness) {
            float shockWarp = (ringThickness - distToRing) * (u_shake / maxShake) * 0.5;
            vec2 warpUv = uv + normalize(uv - 0.5) * shockWarp;
            
            ldrColor.r += texture(u_texture, warpUv + vec2(shockWarp, 0.0)).r;
            ldrColor.b += texture(u_texture, warpUv - vec2(shockWarp, 0.0)).b;
            ldrColor *= 1.5; // Brighten
        }
    }
    
    // 10. HUD Compositing (AFTER all destructive WebGL effects)
    // By compositing the HUD at the very end, we guarantee 100% legibility.
    // The HUD still bends with the lens (because we use the distorted 'uv'),
    // but it won't be smeared by flares, god rays, or chromatic aberration.
    vec4 hud = texture(u_hudTexture, vec2(uv.x, 1.0 - uv.y));
    if (hud.a > 0.0) {
        // Sexy glow composite
        ldrColor = mix(ldrColor, hud.rgb * 1.5, hud.a);
    }
    
    outColor = vec4(ldrColor, 1.0);
}
`;

