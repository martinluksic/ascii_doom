// ============ CONFIGURACIÓN ============
const SCREEN_WIDTH = 180;
const SCREEN_HEIGHT = 70;
const FOV = 1.40; // 60 grados
const MAX_DEPTH = 16;

// Caracteres de sombreado por distancia (de cerca a lejos)
const WALL_SHADES = ['█', '▓', '▒', '░', '≡', '=', '-', '·', ' '];
const WALL_SHADES_DARK = ['▓', '▒', '░', '≡', '=', '-', '·', ' ', ' '];
const FLOOR_SHADES = ['#', 'x', '+', '=', '-', '.', ' '];
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

        // DDA Algorithm
        let distanceToWall = 0;
        let hitWall = false;
        let side = 0; // 0 para paredes Este/Oeste (corte en eje X), 1 para Norte/Sur (corte en eje Y)

        const eyeX = Math.cos(rayAngle);
        const eyeY = Math.sin(rayAngle);

        let mapX = Math.floor(player.x);
        let mapY = Math.floor(player.y);

        // Distancia para cruzar una celda
        const deltaDistX = Math.abs(1 / eyeX);
        const deltaDistY = Math.abs(1 / eyeY);

        let stepX, stepY;
        let sideDistX, sideDistY;

        // Calcular paso y distancia inicial
        if (eyeX < 0) {
            stepX = -1;
            sideDistX = (player.x - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - player.x) * deltaDistX;
        }

        if (eyeY < 0) {
            stepY = -1;
            sideDistY = (player.y - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - player.y) * deltaDistY;
        }

        // Bucle principal DDA
        while (!hitWall && distanceToWall < MAX_DEPTH) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }

            if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
                hitWall = true;
                distanceToWall = MAX_DEPTH;
            } else if (MAP[mapY][mapX] === '#') {
                hitWall = true;
            }
        }

        // Calcular distancia proyectada (distancia euclidiana)
        if (side === 0) {
            distanceToWall = (mapX - player.x + (1 - stepX) / 2) / eyeX;
        } else {
            distanceToWall = (mapY - player.y + (1 - stepY) / 2) / eyeY;
        }

        // Corrección del efecto ojo de pez (fisheye)
        distanceToWall *= Math.cos(rayAngle - player.angle);

        // Evitar división por cero
        if (distanceToWall <= 0.1) distanceToWall = 0.1;

        // Calcular altura de la pared en pantalla
        const ceiling = Math.floor((SCREEN_HEIGHT / 2) - (SCREEN_HEIGHT / distanceToWall));
        const floor = SCREEN_HEIGHT - ceiling;

        // Seleccionar paleta dependiendo del lado golpeado para simular iluminación direccional
        const activePalette = (side === 1) ? WALL_SHADES_DARK : WALL_SHADES;

        const shadeIndex = Math.min(
            Math.floor((distanceToWall / MAX_DEPTH) * activePalette.length),
            activePalette.length - 1
        );
        const wallShade = activePalette[shadeIndex];

        // Dibujar columna
        for (let y = 0; y < SCREEN_HEIGHT; y++) {
            if (y < ceiling) {
                buffer[y][x] = CEILING_CHAR;
            } else if (y >= ceiling && y < floor) {
                buffer[y][x] = wallShade;
            } else {
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