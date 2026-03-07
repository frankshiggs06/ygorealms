export class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationId = null;

        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: this.canvas.height + 10,
            size: Math.random() * 5 + 2,
            speedY: Math.random() * -3 - 2,
            speedX: Math.random() * 2 - 1,
            color: `hsl(${Math.random() * 60 + 260}, 70%, 60%)`, // Purples/Blues
            opacity: 1
        };
    }

    start() {
        if (this.animationId) return;
        this.animate();
    }

    stop() {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles = [];
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.particles.length < 100) {
            this.particles.push(this.createParticle());
        }

        for (let i = 0; i < this.particles.length; i++) {
            let p = this.particles[i];
            p.y += p.speedY;
            p.x += p.speedX;
            p.opacity -= 0.005;

            this.ctx.globalAlpha = p.opacity;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();

            if (p.opacity <= 0 || p.y < -10) {
                this.particles[i] = this.createParticle();
            }
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }
}
