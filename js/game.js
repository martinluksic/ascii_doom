// ============ CONFIGURACIÓN ============
const SCREEN_WIDTH = 180;
const SCREEN_HEIGHT = 70;
const FOV = 1.40; // 60 grados
const MAX_DEPTH = 16;

// Caracteres de sombreado por distancia (de cerca a lejos)
const WALL_SHADES = ['█', '▓', '▒', '░', '·', ' '];
const FLOOR_SHADES = ['#', 'x', '-', '.', ' '];
const CEILING_CHAR = ' ';

// ============ MAPA DEL NIVEL ============
// # = pared, . = espacio vacío, E = enemigo (visual)
const MAP = [
    "################",
    "#..............#",
    "#..####..####..#",
    "#..#........#..#",
    "#..#..####..#..#",
    "#.....#..#.....#",
    "#..#..#..#..#..#",
    "#..#........#..#",
    "#..####..####..#",
    "#..............#",
    "#.###......###.#",
    "#.#..........#.#",
    "#.#..######..#.#",
    "#............#.#",
    "#..##......##..#",
    "################"
];

const MAP_HEIGHT = MAP.length;
const MAP_WIDTH = MAP[0].length;

// ============ JUGADOR ============
let player = {
    x: 8.5,
    y: 8.5,
    angle: 40,
    speed: 0.02,
    rotSpeed: 0.06
};

let bobTime = 0;
let isMoving = false;
let muzzleFlash = 0;
let recoil = 0;

// ============ CONTROLES ============
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

});
document.addEventListener('keyup', (e) => keys[e.code] = false);

// ============ PANTALLA ============
const screen = document.getElementById('screen');
screen.addEventListener('click', () => {
    screen.requestPointerLock();
});
let mouseSensitivity = 0.001;
document.addEventListener('mousemove', (e) => {

    if (document.pointerLockElement === screen) {

        player.angle += e.movementX * mouseSensitivity;

    }

});
document.addEventListener('mousedown', (e) => {

    if (e.button === 0) {

        shoot();

    }

});

const minimap = document.getElementById('minimap');
const weaponDisplay = document.getElementById('weapon');
let buffer = [];

// Inicializar buffer
function initBuffer() {
    buffer = [];
    for (let y = 0; y < SCREEN_HEIGHT; y++) {
        buffer[y] = [];
        for (let x = 0; x < SCREEN_WIDTH; x++) {
            buffer[y][x] = ' ';
        }
    }
}

// ============ RAYCASTING ============
function castRays() {
    initBuffer();

    for (let x = 0; x < SCREEN_WIDTH; x++) {
        // Calcular ángulo del rayo
        const rayAngle = (player.angle - FOV / 2) + (x / SCREEN_WIDTH) * FOV;

        // Raycasting - DDA Algorithm simplificado
        let distanceToWall = 0;
        let hitWall = false;
        let hitBoundary = false;

        const eyeX = Math.cos(rayAngle);
        const eyeY = Math.sin(rayAngle);

        while (!hitWall && distanceToWall < MAX_DEPTH) {
            distanceToWall += 0.05;

            const testX = Math.floor(player.x + eyeX * distanceToWall);
            const testY = Math.floor(player.y + eyeY * distanceToWall);

            // Verificar límites del mapa
            if (testX < 0 || testX >= MAP_WIDTH || testY < 0 || testY >= MAP_HEIGHT) {
                hitWall = true;
                distanceToWall = MAX_DEPTH;
            } else {
                // Verificar si hay pared
                if (MAP[testY][testX] === '#') {
                    hitWall = true;

                    // Detectar bordes de la pared para efecto visual
                    const bounds = [];
                    for (let tx = 0; tx < 2; tx++) {
                        for (let ty = 0; ty < 2; ty++) {
                            const vx = testX + tx - player.x;
                            const vy = testY + ty - player.y;
                            const d = Math.sqrt(vx * vx + vy * vy);
                            const dot = (eyeX * vx / d) + (eyeY * vy / d);
                            bounds.push([d, dot]);
                        }
                    }
                    bounds.sort((a, b) => a[0] - b[0]);

                    const bound = 0.01;
                    if (Math.acos(bounds[0][1]) < bound ||
                        Math.acos(bounds[1][1]) < bound) {
                        hitBoundary = true;
                    }
                }
            }
        }

        // Calcular altura de la pared en pantalla
        const ceiling = Math.floor((SCREEN_HEIGHT / 2) - (SCREEN_HEIGHT / distanceToWall));
        const floor = SCREEN_HEIGHT - ceiling;

        // Seleccionar carácter de sombreado según distancia
        let wallShade;
        if (hitBoundary) {
            wallShade = '│'; // Borde de pared
        } else {
            const shadeIndex = Math.min(
                Math.floor((distanceToWall / MAX_DEPTH) * WALL_SHADES.length),
                WALL_SHADES.length - 1
            );
            wallShade = WALL_SHADES[shadeIndex];
        }

        // Dibujar columna
        for (let y = 0; y < SCREEN_HEIGHT; y++) {
            if (y < ceiling) {
                // Techo
                buffer[y][x] = CEILING_CHAR;
            } else if (y >= ceiling && y < floor) {
                // Pared
                buffer[y][x] = wallShade;
            } else {
                // Suelo
                const floorDist = 1 - ((y - SCREEN_HEIGHT / 2) / (SCREEN_HEIGHT / 2));
                const floorShadeIndex = Math.min(
                    Math.floor(floorDist * FLOOR_SHADES.length),
                    FLOOR_SHADES.length - 1
                );
                buffer[y][x] = FLOOR_SHADES[floorShadeIndex];
            }
        }
    }
    // ===== ARMA =====

    const weaponArt = [
        "                   |░░|                   ",
        "                   |██|                   ",
        "                   |██|                   ",
        "                 ▓▓█▓▓█▓▓                 ",
        "                ▒███▓▓███▒                ",
        "                ████▓▓████                ",
        "               ░████▓▓████░               ",
        "               ▓████▓▓████▓               ",
        "               █████▓▓█████               ",
        "               █████▓▓█████               ",
        "              ▓█████▓▓█████▓              ",
        "              ██████▓▓██████              ",
        "              ██████▓▓██████              ",
        "              ██████▓▓██████              ",
        "             ▓████▓▓██▓▓████▓             ",
    ];

    const bobX = Math.floor(Math.sin(bobTime) * 2);
    const startY =
        Math.floor(SCREEN_HEIGHT - weaponArt.length - recoil + 0.999);

    const startX =
        Math.floor((SCREEN_WIDTH - weaponArt[0].length) / 2)
        + bobX;

    for (let y = 0; y < weaponArt.length; y++) {
        for (let x = 0; x < weaponArt[y].length; x++) {

            const char = weaponArt[y][x];

            if (char !== ' ') {
                buffer[startY + y][startX + x] = char;
            }
        }
    }

    // ========= DESTELLO =========

    if (muzzleFlash > 0) {

        const flashArt = [
            "   ░░███░░ ",
            " ░░███████░░",
            "░░█████████░░",
            " ░░███████░░",
            "   ░░███░░ "
        ];

        const flashX =
            startX + Math.floor(weaponArt[0].length / 2) - 6;

        const flashY =
            startY - 4;

        for (let y = 0; y < flashArt.length; y++) {
            for (let x = 0; x < flashArt[y].length; x++) {

                const char = flashArt[y][x];

                if (char !== ' ') {
                    buffer[flashY + y][flashX + x] = char;
                }
            }
        }

        muzzleFlash--;
    }

    // Renderizar buffer a pantalla
    let output = '';
    for (let y = 0; y < SCREEN_HEIGHT; y++) {
        output += buffer[y].join('') + '\n';
    }
    screen.textContent = output;
}

// ============ MINIMAPA ============
function renderMinimap() {
    let output = '';
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const px = Math.floor(player.x);
            const py = Math.floor(player.y);

            if (x === px && y === py) {
                // Jugador con indicador de dirección
                const dirChars = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
                const dirIndex = Math.floor(((player.angle + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4));
                output += '<span style="color: #00ff00">' + dirChars[(dirIndex + 8) % 8] + '</span>';
            } else if (MAP[y][x] === '#') {
                output += '<span style="color: #666">█</span>';
            } else {
                output += '<span style="color: #222">·</span>';
            }
        }
        output += '\n';
    }
    minimap.innerHTML = output;
}

// ============ MOVIMIENTO ============
function handleInput() {
    isMoving = false;
    // Normalizar ángulo
    if (player.angle < 0) player.angle += Math.PI * 2;
    if (player.angle >= Math.PI * 2) player.angle -= Math.PI * 2;

    // Movimiento hacia adelante/atrás
    let newX = player.x;
    let newY = player.y;

    if (keys['KeyW'] || keys['ArrowUp']) {
        isMoving = true;
        newX += Math.cos(player.angle) * player.speed;
        newY += Math.sin(player.angle) * player.speed;
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
        isMoving = true;
        newX -= Math.cos(player.angle) * player.speed;
        newY -= Math.sin(player.angle) * player.speed;
    }

    // Movimiento lateral (strafe)
    if (keys['KeyA']) {
        isMoving = true;
        newX += Math.cos(player.angle - Math.PI / 2) * player.speed;
        newY += Math.sin(player.angle - Math.PI / 2) * player.speed;
    }
    if (keys['KeyD']) {
        isMoving = true;
        newX += Math.cos(player.angle + Math.PI / 2) * player.speed;
        newY += Math.sin(player.angle + Math.PI / 2) * player.speed;
    }

    // Colisión - solo mover si no hay pared
    if (MAP[Math.floor(player.y)][Math.floor(newX)] !== '#') {
        player.x = newX;
    }
    if (MAP[Math.floor(newY)][Math.floor(player.x)] !== '#') {
        player.y = newY;
    }
}

// ============ DISPARO ============
function shoot() {

    muzzleFlash = 3;
    recoil = 2;
}
// ============ GAME LOOP ============
function gameLoop() {
    handleInput();
    if (isMoving) {
        bobTime += 0.07;
    }
    if (recoil > 0) {
        recoil -= 0.2;
    }
    if (recoil < 0) {
        recoil = 0;
    }

    castRays();
    renderMinimap();
    requestAnimationFrame(gameLoop);
}

// Iniciar juego
gameLoop();