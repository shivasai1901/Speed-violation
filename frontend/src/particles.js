/**
 * particles.js — Three.js animated 3D particle background
 */

let scene, camera, renderer, particles, geometricShapes = [];
let mouseX = 0, mouseY = 0;
let animationId = null;

export function initParticles(containerId = 'three-bg') {
    const container = document.getElementById(containerId);
    if (!container || typeof THREE === 'undefined') return;

    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 50;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Particle system
    const particleCount = 800;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorPalette = [
        new THREE.Color(0x00f5ff),  // cyan
        new THREE.Color(0x7c3aed),  // purple
        new THREE.Color(0x10b981),  // green
        new THREE.Color(0x3b82f6),  // blue
        new THREE.Color(0xf59e0b),  // amber
    ];

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 120;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 120;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = Math.random() * 2 + 0.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Floating geometric shapes
    const shapeMaterial1 = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        wireframe: true,
        transparent: true,
        opacity: 0.15
    });
    const shapeMaterial2 = new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        wireframe: true,
        transparent: true,
        opacity: 0.12
    });
    const shapeMaterial3 = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        wireframe: true,
        transparent: true,
        opacity: 0.1
    });

    const shapes = [
        { geo: new THREE.IcosahedronGeometry(6, 1), mat: shapeMaterial1, pos: [-30, 20, -20], speed: 0.003 },
        { geo: new THREE.OctahedronGeometry(5, 0), mat: shapeMaterial2, pos: [35, -15, -25], speed: 0.004 },
        { geo: new THREE.TorusGeometry(4, 1.5, 8, 16), mat: shapeMaterial3, pos: [-20, -25, -15], speed: 0.002 },
        { geo: new THREE.TetrahedronGeometry(4, 0), mat: shapeMaterial1, pos: [25, 25, -30], speed: 0.005 },
        { geo: new THREE.DodecahedronGeometry(3, 0), mat: shapeMaterial2, pos: [0, -30, -10], speed: 0.003 },
    ];

    shapes.forEach(({ geo, mat, pos, speed }) => {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(...pos);
        mesh.userData.speed = speed;
        mesh.userData.baseY = pos[1];
        scene.add(mesh);
        geometricShapes.push(mesh);
    });

    // Connection lines between nearby particles
    const linePositions = [];
    const posArray = positions;
    for (let i = 0; i < Math.min(particleCount, 200); i++) {
        for (let j = i + 1; j < Math.min(particleCount, 200); j++) {
            const dx = posArray[i * 3] - posArray[j * 3];
            const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1];
            const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < 15) {
                linePositions.push(posArray[i * 3], posArray[i * 3 + 1], posArray[i * 3 + 2]);
                linePositions.push(posArray[j * 3], posArray[j * 3 + 1], posArray[j * 3 + 2]);
            }
        }
    }

    if (linePositions.length > 0) {
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00f5ff,
            transparent: true,
            opacity: 0.04,
            blending: THREE.AdditiveBlending
        });
        const lines = new THREE.LineSegments(lineGeo, lineMat);
        scene.add(lines);
    }

    // Mouse interaction
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    });

    // Resize handler
    window.addEventListener('resize', () => {
        if (!container || !renderer) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // Start animation
    animate();
}

function animate() {
    animationId = requestAnimationFrame(animate);
    const time = Date.now() * 0.001;

    if (particles) {
        particles.rotation.y += 0.0003;
        particles.rotation.x += 0.0001;

        // Subtle mouse follow
        particles.rotation.y += mouseX * 0.0002;
        particles.rotation.x += mouseY * 0.0001;
    }

    // Animate geometric shapes
    geometricShapes.forEach((shape, i) => {
        shape.rotation.x += shape.userData.speed;
        shape.rotation.y += shape.userData.speed * 0.7;
        shape.position.y = shape.userData.baseY + Math.sin(time + i * 1.5) * 3;
    });

    // Smooth camera movement following mouse
    camera.position.x += (mouseX * 5 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 3 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}

export function disposeParticles() {
    if (animationId) cancelAnimationFrame(animationId);
    if (renderer) renderer.dispose();
}
