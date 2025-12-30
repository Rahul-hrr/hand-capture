import * as THREE from 'three';

// --- Global Variables ---
const PARTICLE_COUNT = 8000;
let expansionFactor = 1.0;
let currentHue = 0.5;
const lerpSpeed = 0.08;

let targetPositions = new Float32Array(PARTICLE_COUNT * 3);
const videoElement = document.getElementById('video');
const gestureText = document.getElementById('gesture-name');

// --- Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

camera.position.z = 6;

// Particle Geometry
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

// --- Template Math Functions ---
function toSphere() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
        const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;
        targetPositions[i * 3] = 2.5 * Math.cos(theta) * Math.sin(phi);
        targetPositions[i * 3 + 1] = 2.5 * Math.sin(theta) * Math.sin(phi);
        targetPositions[i * 3 + 2] = 2.5 * Math.cos(phi);
    }
}

function toHeart() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const t = Math.random() * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const depth = (Math.random() - 0.5) * 4;
        targetPositions[i * 3] = x * 0.15;
        targetPositions[i * 3 + 1] = y * 0.15;
        targetPositions[i * 3 + 2] = depth * 0.2;
    }
}

function toFlower() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const t = (i / PARTICLE_COUNT) * Math.PI * 20;
        const r = 2 * Math.cos(2.5 * t); 
        targetPositions[i * 3] = r * Math.cos(t);
        targetPositions[i * 3 + 1] = r * Math.sin(t);
        targetPositions[i * 3 + 2] = (Math.random() - 0.5) * 1;
    }
}

function toSaturn() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (i < PARTICLE_COUNT * 0.5) {
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;
            targetPositions[i * 3] = 1.5 * Math.cos(phi) * Math.sin(theta);
            targetPositions[i * 3 + 1] = 1.5 * Math.sin(phi) * Math.sin(theta);
            targetPositions[i * 3 + 2] = 1.5 * Math.cos(theta);
        } else {
            const angle = Math.random() * Math.PI * 2;
            const r = 2.2 + Math.random() * 1.2;
            targetPositions[i * 3] = r * Math.cos(angle);
            targetPositions[i * 3 + 1] = r * Math.sin(angle) * 0.2;
            targetPositions[i * 3 + 2] = r * Math.sin(angle);
        }
    }
}

toSphere(); // Default shape

// --- MediaPipe Hand Tracking ---
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];

        // 1. Scene Rotation
        particleSystem.rotation.y = (lm[0].x - 0.5) * 4;
        particleSystem.rotation.x = (lm[0].y - 0.5) * 4;

        // 2. Expansion (Index vs Thumb)
        const dx = lm[8].x - lm[4].x;
        const dy = lm[8].y - lm[4].y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        expansionFactor = THREE.MathUtils.lerp(expansionFactor, distance * 8, 0.1);

        // 3. Dynamic Hue
        currentHue = lm[8].x;

        // 4. Gesture Detection
        const isExtended = (tip, pip) => lm[tip].y < lm[pip].y;
        const fingers = [
            isExtended(8, 6),
            isExtended(12, 10),
            isExtended(16, 14),
            isExtended(20, 18)
        ].filter(v => v).length;

        if (fingers <= 1) {
            gestureText.innerText = "Sphere";
            toSphere();
        } else if (fingers === 2) {
            gestureText.innerText = "Heart";
            toHeart();
        } else if (fingers === 3) {
            gestureText.innerText = "Flower";
            toFlower();
        } else {
            gestureText.innerText = "Saturn";
            toSaturn();
        }
    }
});

// --- Camera Start with Iriun Selection ---
async function startCamera() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    
    // Iriun ko priority de raha hoon agar mila toh
    let selectedDevice = videoDevices.find(d => d.label.toLowerCase().includes('iriun'));
    let deviceId = selectedDevice ? selectedDevice.deviceId : undefined;

    const cameraFeed = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480,
        deviceId: deviceId
    });
    cameraFeed.start();
}

startCamera();

// --- Animation Loop ---
const colorObj = new THREE.Color();
function animate() {
    requestAnimationFrame(animate);

    const posAttr = geometry.attributes.position;
    const colAttr = geometry.attributes.color;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        posAttr.array[ix] += (targetPositions[ix] * expansionFactor - posAttr.array[ix]) * lerpSpeed;
        posAttr.array[ix+1] += (targetPositions[ix+1] * expansionFactor - posAttr.array[ix+1]) * lerpSpeed;
        posAttr.array[ix+2] += (targetPositions[ix+2] * expansionFactor - posAttr.array[ix+2]) * lerpSpeed;

        const h = (currentHue + (i / PARTICLE_COUNT) * 0.2) % 1;
        colorObj.setHSL(h, 0.8, 0.6);
        colAttr.array[ix] = colorObj.r;
        colAttr.array[ix+1] = colorObj.g;
        colAttr.array[ix+2] = colorObj.b;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    particleSystem.rotation.z += 0.002;

    renderer.render(scene, camera);
}

animate();

// Resize Handle
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
