export class ParticleSystem {
    constructor(glEngine, vsSource, fsSource, postVs, postFs) {
        this.glEngine = glEngine;
        this.gl = glEngine.gl;
        this.count = 250000;
        
        this.program = glEngine.createProgram(vsSource, fsSource);
        this.postProgram = glEngine.createProgram(postVs, postFs);
        
        this.initBuffers();
        this.initPostProcessing();
    }

    initBuffers() {
        const gl = this.gl;
        
        const indices = new Float32Array(this.count);
        const randoms = new Float32Array(this.count * 3);
        const customTargets = new Float32Array(this.count * 3);
        
        for (let i = 0; i < this.count; i++) {
            indices[i] = i;
            randoms[i*3] = (Math.random() - 0.5) * 2.0;
            randoms[i*3+1] = (Math.random() - 0.5) * 2.0;
            randoms[i*3+2] = (Math.random() - 0.5) * 2.0;
        }

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this.randomBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.randomBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, randoms, gl.STATIC_DRAW);

        this.targetBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.targetBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, customTargets, gl.DYNAMIC_DRAW);
        
        this.aIndexLoc = gl.getAttribLocation(this.program, "a_index");
        this.aRandomLoc = gl.getAttribLocation(this.program, "a_random");
        this.aTargetLoc = gl.getAttribLocation(this.program, "a_customTarget");
    }

    initPostProcessing() {
        const gl = this.gl;
        const quad = new Float32Array([
            -1,-1,  1,-1,  -1,1,
            -1,1,   1,-1,   1,1
        ]);
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
        this.aPosLoc = gl.getAttribLocation(this.postProgram, "a_position");
    }

    updateTargets(points) {
        if (!points || points.length === 0) {
            const zeros = new Float32Array(this.count * 3);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.targetBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, zeros, this.gl.DYNAMIC_DRAW);
            return;
        }

        const targets = new Float32Array(this.count * 3);
        for (let i = 0; i < this.count; i++) {
            const pt = points[Math.floor(Math.random() * points.length)];
            targets[i*3] = pt.x + (Math.random()-0.5)*4.0;
            targets[i*3+1] = pt.y + (Math.random()-0.5)*4.0;
            targets[i*3+2] = pt.z + (Math.random()-0.5)*15.0;
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.targetBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, targets, this.gl.DYNAMIC_DRAW);
    }

    draw(time, phase, transition, camRotX, camRotY, zoom) {
        const gl = this.gl;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.glEngine.fbo);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.disable(gl.DEPTH_TEST);

        gl.useProgram(this.program);

        const aspect = gl.canvas.width / gl.canvas.height;
        const proj = this.glEngine.getPerspectiveMatrix(Math.PI/4, aspect, 1, 10000);
        let view = this.glEngine.getTranslationMatrix(0, 0, -zoom);
        view = this.glEngine.multiplyMatrices(view, this.glEngine.getRotationX(camRotX));
        view = this.glEngine.multiplyMatrices(view, this.glEngine.getRotationY(camRotY));
        const matrix = this.glEngine.multiplyMatrices(proj, view);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "u_matrix"), false, matrix);
        gl.uniform1f(gl.getUniformLocation(this.program, "u_time"), time);
        gl.uniform1f(gl.getUniformLocation(this.program, "u_phase"), phase);
        gl.uniform1f(gl.getUniformLocation(this.program, "u_transition"), transition);
        gl.uniform1f(gl.getUniformLocation(this.program, "u_particleCount"), this.count);
        gl.uniform1f(gl.getUniformLocation(this.program, "u_seed"), window.solanaSeed || 0.5);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.indexBuffer);
        gl.enableVertexAttribArray(this.aIndexLoc);
        gl.vertexAttribPointer(this.aIndexLoc, 1, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.randomBuffer);
        gl.enableVertexAttribArray(this.aRandomLoc);
        gl.vertexAttribPointer(this.aRandomLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.targetBuffer);
        gl.enableVertexAttribArray(this.aTargetLoc);
        gl.vertexAttribPointer(this.aTargetLoc, 3, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.POINTS, 0, this.count);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.postProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.glEngine.fboTexture);
        gl.uniform1i(gl.getUniformLocation(this.postProgram, "u_texture"), 0);
        gl.uniform1f(gl.getUniformLocation(this.postProgram, "u_time"), time);
        gl.uniform1f(gl.getUniformLocation(this.postProgram, "u_shake"), window.shakeIntensity || 0.0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(this.aPosLoc);
        gl.vertexAttribPointer(this.aPosLoc, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}
