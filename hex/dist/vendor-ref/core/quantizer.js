import { oklabToRgb, rgbToOklab } from "./colorUtils.js";
const BAYER_2X2 = [0, 2, 3, 1].map((v) => (v + 0.5) / 4);
const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const BAYER_8X8 = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36,
    14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23,
    61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);
const ORDERED_MATRIX = [
    1, 9, 3, 11, 13, 5, 15, 7, 4, 12, 2, 10, 16, 8, 14, 6,
].map((v) => (v - 1 + 0.5) / 16);
function getDitherMatrix(mode) {
    switch (mode) {
        case "bayer-2x2":
            return BAYER_2X2;
        case "bayer-4x4":
            return BAYER_4X4;
        case "bayer-8x8":
            return BAYER_8X8;
        case "ordered":
            return ORDERED_MATRIX;
        default:
            return ORDERED_MATRIX;
    }
}
export class OklabKMeans {
    maxColors;
    maxIterations;
    tolerance;
    constructor(maxColors, maxIterations = 20, tolerance = 0.001) {
        this.maxColors = maxColors;
        this.maxIterations = maxIterations;
        this.tolerance = tolerance;
    }
    /**
     * K-means clustering to reduce colors
     */
    quantize(pixels) {
        // 1. Pre-processing: Extract unique opaque colors to speed up K-means
        const opaquePixels = pixels.filter((p) => p.alpha > 0);
        if (opaquePixels.length === 0 || this.maxColors >= opaquePixels.length) {
            return pixels;
        }
        // Use a Map to count occurrences of each color for weighted centroids
        const colorMap = new Map();
        for (const p of opaquePixels) {
            const key = (p.r << 16) | (p.g << 8) | p.b;
            const entry = colorMap.get(key);
            if (entry) {
                entry.count++;
            }
            else {
                colorMap.set(key, { lab: rgbToOklab(p), count: 1 });
            }
        }
        const uniqueColors = Array.from(colorMap.values());
        if (uniqueColors.length <= this.maxColors) {
            return pixels;
        }
        // 2. Initialization: Randomly pick maxColors as initial centroids
        let centroids = this.initializeCentroids(uniqueColors);
        // 3. Main Loop
        for (let iter = 0; iter < this.maxIterations; iter++) {
            const clusters = Array.from({ length: this.maxColors }, () => ({
                sumL: 0,
                suma: 0,
                sumb: 0,
                count: 0,
            }));
            // Assignment
            for (const color of uniqueColors) {
                let minDist = Number.MAX_VALUE;
                let bestCluster = 0;
                for (let i = 0; i < centroids.length; i++) {
                    const dist = this.colorDistanceSq(color.lab, centroids[i]);
                    if (dist < minDist) {
                        minDist = dist;
                        bestCluster = i;
                    }
                }
                const cluster = clusters[bestCluster];
                cluster.sumL += color.lab.L * color.count;
                cluster.suma += color.lab.a * color.count;
                cluster.sumb += color.lab.b * color.count;
                cluster.count += color.count;
            }
            // Update
            let maxMovement = 0;
            const newCentroids = [];
            for (let i = 0; i < centroids.length; i++) {
                const cluster = clusters[i];
                if (cluster.count > 0) {
                    const nextCentroid = {
                        L: cluster.sumL / cluster.count,
                        a: cluster.suma / cluster.count,
                        b: cluster.sumb / cluster.count,
                    };
                    const movement = this.colorDistanceSq(centroids[i], nextCentroid);
                    maxMovement = Math.max(maxMovement, movement);
                    newCentroids.push(nextCentroid);
                }
                else {
                    // If a cluster is empty, re-initialize it with a random color
                    newCentroids.push(uniqueColors[Math.floor(Math.random() * uniqueColors.length)].lab);
                }
            }
            centroids = newCentroids;
            if (maxMovement < this.tolerance * this.tolerance)
                break;
        }
        // 4. Mapping: Replace each pixel with the nearest centroid
        const palette = centroids.map((lab) => oklabToRgb(lab));
        const centroidRgbMap = new Map(); // unique color key -> palette index
        for (const [key, entry] of colorMap.entries()) {
            let minDist = Number.MAX_VALUE;
            let bestIdx = 0;
            for (let i = 0; i < centroids.length; i++) {
                const dist = this.colorDistanceSq(entry.lab, centroids[i]);
                if (dist < minDist) {
                    minDist = dist;
                    bestIdx = i;
                }
            }
            centroidRgbMap.set(key, bestIdx);
        }
        return pixels.map((p) => {
            if (p.alpha === 0)
                return p;
            const key = (p.r << 16) | (p.g << 8) | p.b;
            const paletteIdx = centroidRgbMap.get(key) ?? 0;
            const rgb = palette[paletteIdx];
            return { ...rgb, alpha: p.alpha };
        });
    }
    /**
     * Floyd-Steinberg dithering using K-means centroids as palette
     */
    dither(pixels, width, height, strength = 1.0) {
        return this.applyDithering(pixels, width, height, "floyd-steinberg", strength);
    }
    /**
     * Apply dithering with various modes
     */
    applyDithering(pixels, width, height, mode, strength = 1.0) {
        // 1. Get palette via K-means (using existing quantize logic to find centroids)
        const opaquePixels = pixels.filter((p) => p.alpha > 0);
        if (opaquePixels.length === 0 || this.maxColors >= opaquePixels.length) {
            return pixels;
        }
        const colorMap = new Map();
        for (const p of opaquePixels) {
            const key = (p.r << 16) | (p.g << 8) | p.b;
            const entry = colorMap.get(key);
            if (entry) {
                entry.count++;
            }
            else {
                colorMap.set(key, { lab: rgbToOklab(p), count: 1 });
            }
        }
        const uniqueColors = Array.from(colorMap.values());
        if (uniqueColors.length <= this.maxColors) {
            return pixels;
        }
        let centroids = this.initializeCentroids(uniqueColors);
        // Run K-means (simplified version of quantize loop to get centroids)
        for (let iter = 0; iter < this.maxIterations; iter++) {
            const clusters = Array.from({ length: this.maxColors }, () => ({
                sumL: 0,
                suma: 0,
                sumb: 0,
                count: 0,
            }));
            for (const color of uniqueColors) {
                let minDist = Number.MAX_VALUE;
                let bestCluster = 0;
                for (let i = 0; i < centroids.length; i++) {
                    const dist = this.colorDistanceSq(color.lab, centroids[i]);
                    if (dist < minDist) {
                        minDist = dist;
                        bestCluster = i;
                    }
                }
                const cluster = clusters[bestCluster];
                cluster.sumL += color.lab.L * color.count;
                cluster.suma += color.lab.a * color.count;
                cluster.sumb += color.lab.b * color.count;
                cluster.count += color.count;
            }
            let maxMovement = 0;
            const newCentroids = [];
            for (let i = 0; i < centroids.length; i++) {
                const cluster = clusters[i];
                if (cluster.count > 0) {
                    const nextCentroid = {
                        L: cluster.sumL / cluster.count,
                        a: cluster.suma / cluster.count,
                        b: cluster.sumb / cluster.count,
                    };
                    const movement = this.colorDistanceSq(centroids[i], nextCentroid);
                    maxMovement = Math.max(maxMovement, movement);
                    newCentroids.push(nextCentroid);
                }
                else {
                    newCentroids.push(uniqueColors[Math.floor(Math.random() * uniqueColors.length)].lab);
                }
            }
            centroids = newCentroids;
            if (maxMovement < this.tolerance * this.tolerance)
                break;
        }
        const palette = centroids.map((lab) => oklabToRgb(lab));
        const paletteLabs = centroids;
        if (mode === "none" || strength <= 0) {
            return this.quantizeWithPalette(pixels, palette, paletteLabs);
        }
        if (mode === "floyd-steinberg") {
            return this.applyFloydSteinberg(pixels, width, height, palette, paletteLabs, strength);
        }
        return this.applyOrderedDithering(pixels, width, height, palette, paletteLabs, mode, strength);
    }
    quantizeWithPalette(pixels, palette, paletteLabs) {
        const memo = new Map();
        return pixels.map((p) => {
            if (p.alpha === 0)
                return p;
            const key = (p.r << 16) | (p.g << 8) | p.b;
            let bestIdx = memo.get(key);
            if (bestIdx === undefined) {
                const lab = rgbToOklab(p);
                let minDist = Number.MAX_VALUE;
                bestIdx = 0;
                for (let i = 0; i < paletteLabs.length; i++) {
                    const dist = this.colorDistanceSq(lab, paletteLabs[i]);
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                }
                memo.set(key, bestIdx);
            }
            const rgb = palette[bestIdx];
            return { ...rgb, alpha: p.alpha };
        });
    }
    applyFloydSteinberg(pixels, width, height, palette, paletteLabs, strength) {
        const out = pixels.map((p) => ({ ...p }));
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const p = out[idx];
                if (p.alpha === 0)
                    continue;
                const lab = rgbToOklab(p);
                let minDist = Number.MAX_VALUE;
                let bestIdx = 0;
                for (let i = 0; i < paletteLabs.length; i++) {
                    const dist = this.colorDistanceSq(lab, paletteLabs[i]);
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                }
                const closest = palette[bestIdx];
                const errR = (p.r - closest.r) * strength;
                const errG = (p.g - closest.g) * strength;
                const errB = (p.b - closest.b) * strength;
                out[idx].r = closest.r;
                out[idx].g = closest.g;
                out[idx].b = closest.b;
                // Distribute error
                this.distributeError(out, x + 1, y, width, height, errR, errG, errB, 7 / 16);
                this.distributeError(out, x - 1, y + 1, width, height, errR, errG, errB, 3 / 16);
                this.distributeError(out, x, y + 1, width, height, errR, errG, errB, 5 / 16);
                this.distributeError(out, x + 1, y + 1, width, height, errR, errG, errB, 1 / 16);
            }
        }
        return out;
    }
    applyOrderedDithering(pixels, width, height, palette, paletteLabs, mode, strength) {
        const matrix = getDitherMatrix(mode);
        const size = Math.sqrt(matrix.length);
        const out = new Array(pixels.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const p = pixels[idx];
                if (p.alpha === 0) {
                    out[idx] = p;
                    continue;
                }
                const threshold = matrix[(y % size) * size + (x % size)];
                // Convert threshold to range -0.5 ~ 0.5 and multiply by strength
                const bias = (threshold - 0.5) * strength * 255;
                const biasedR = Math.max(0, Math.min(255, p.r + bias));
                const biasedG = Math.max(0, Math.min(255, p.g + bias));
                const biasedB = Math.max(0, Math.min(255, p.b + bias));
                const lab = rgbToOklab({
                    r: biasedR,
                    g: biasedG,
                    b: biasedB,
                });
                let minDist = Number.MAX_VALUE;
                let bestIdx = 0;
                for (let i = 0; i < paletteLabs.length; i++) {
                    const dist = this.colorDistanceSq(lab, paletteLabs[i]);
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                }
                const closest = palette[bestIdx];
                out[idx] = { ...closest, alpha: p.alpha };
            }
        }
        return out;
    }
    distributeError(pixels, x, y, width, height, errR, errG, errB, weight) {
        if (x < 0 || x >= width || y < 0 || y >= height)
            return;
        const idx = y * width + x;
        const p = pixels[idx];
        if (p.alpha === 0)
            return;
        p.r = Math.max(0, Math.min(255, p.r + errR * weight));
        p.g = Math.max(0, Math.min(255, p.g + errG * weight));
        p.b = Math.max(0, Math.min(255, p.b + errB * weight));
    }
    initializeCentroids(uniqueColors) {
        const centroids = [];
        const usedIndices = new Set();
        // Simple random initialization
        while (centroids.length < this.maxColors &&
            usedIndices.size < uniqueColors.length) {
            const idx = Math.floor(Math.random() * uniqueColors.length);
            if (!usedIndices.has(idx)) {
                usedIndices.add(idx);
                centroids.push(uniqueColors[idx].lab);
            }
        }
        return centroids;
    }
    colorDistanceSq(c1, c2) {
        const dL = c1.L - c2.L;
        const da = c1.a - c2.a;
        const db = c1.b - c2.b;
        return dL * dL + da * da + db * db;
    }
}
/**
 * Fixed palette quantization using Oklab distance
 */
export class PaletteQuantizer {
    palette;
    paletteLabs;
    constructor(palette) {
        this.palette = palette;
        this.paletteLabs = palette.map((rgb) => rgbToOklab(rgb));
    }
    quantize(pixels) {
        const memo = new Map(); // RGB key -> palette index
        return pixels.map((p) => {
            if (p.alpha === 0)
                return p;
            const key = (p.r << 16) | (p.g << 8) | p.b;
            let paletteIdx = memo.get(key);
            if (paletteIdx === undefined) {
                const lab = rgbToOklab(p);
                let minDist = Number.MAX_VALUE;
                paletteIdx = 0;
                for (let i = 0; i < this.paletteLabs.length; i++) {
                    const targetLab = this.paletteLabs[i];
                    const targetRgb = this.palette[i];
                    // Oklab distance
                    let dist = this.colorDistanceSq(lab, targetLab);
                    // For dark pixels, to prevent them from being pulled towards dark colors like brown,
                    // apply a bias to the pure black (L=0) judgment or use RGB distance as an aid.
                    // This specifically prevents misclassification of NES black (#000000) and brown (#503000).
                    const isTargetBlack = targetRgb.r === 0 && targetRgb.g === 0 && targetRgb.b === 0;
                    if (isTargetBlack) {
                        // Apply bias only to extremely dark pixels below approx L=0.2 (approx 45-50 in sRGB).
                        // This prevents "dark gray" in palettes like Game Boy from being judged as black.
                        if (lab.L < 0.2) {
                            const lBias = (0.2 - lab.L) * 1.5;
                            dist -= lBias * lBias;
                        }
                    }
                    // Also supplementally use the distance in RGB space (only for extremely dark colors).
                    if (lab.L < 0.1) {
                        const dR = (p.r - targetRgb.r) / 255;
                        const dG = (p.g - targetRgb.g) / 255;
                        const dB = (p.b - targetRgb.b) / 255;
                        const rgbDistSq = dR * dR + dG * dG + dB * dB;
                        const rgbWeight = 0.5 - lab.L;
                        dist += rgbDistSq * rgbWeight;
                    }
                    if (dist < minDist) {
                        minDist = dist;
                        paletteIdx = i;
                    }
                }
                memo.set(key, paletteIdx);
            }
            const rgb = this.palette[paletteIdx];
            return { ...rgb, alpha: p.alpha };
        });
    }
    /**
     * Floyd-Steinberg dithering using fixed palette
     */
    dither(pixels, width, height, strength = 1.0) {
        return this.applyDithering(pixels, width, height, "floyd-steinberg", strength);
    }
    /**
     * Apply dithering with various modes
     */
    applyDithering(pixels, width, height, mode, strength = 1.0) {
        if (mode === "none" || strength <= 0) {
            return this.quantize(pixels);
        }
        if (mode === "floyd-steinberg") {
            return this.applyFloydSteinberg(pixels, width, height, strength);
        }
        return this.applyOrderedDithering(pixels, width, height, mode, strength);
    }
    applyFloydSteinberg(pixels, width, height, strength) {
        const out = pixels.map((p) => ({ ...p }));
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const p = out[idx];
                if (p.alpha === 0)
                    continue;
                const lab = rgbToOklab(p);
                let minDist = Number.MAX_VALUE;
                let bestIdx = 0;
                for (let i = 0; i < this.paletteLabs.length; i++) {
                    const targetLab = this.paletteLabs[i];
                    const targetRgb = this.palette[i];
                    let dist = this.colorDistanceSq(lab, targetLab);
                    const isTargetBlack = targetRgb.r === 0 && targetRgb.g === 0 && targetRgb.b === 0;
                    if (isTargetBlack) {
                        if (lab.L < 0.2) {
                            const lBias = (0.2 - lab.L) * 1.5;
                            dist -= lBias * lBias;
                        }
                    }
                    if (lab.L < 0.1) {
                        const dR = (p.r - targetRgb.r) / 255;
                        const dG = (p.g - targetRgb.g) / 255;
                        const dB = (p.b - targetRgb.b) / 255;
                        const rgbDistSq = dR * dR + dG * dG + dB * dB;
                        const rgbWeight = 0.5 - lab.L;
                        dist += rgbDistSq * rgbWeight;
                    }
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                }
                const closest = this.palette[bestIdx];
                const errR = (p.r - closest.r) * strength;
                const errG = (p.g - closest.g) * strength;
                const errB = (p.b - closest.b) * strength;
                out[idx].r = closest.r;
                out[idx].g = closest.g;
                out[idx].b = closest.b;
                // Distribute error
                this.distributeError(out, x + 1, y, width, height, errR, errG, errB, 7 / 16);
                this.distributeError(out, x - 1, y + 1, width, height, errR, errG, errB, 3 / 16);
                this.distributeError(out, x, y + 1, width, height, errR, errG, errB, 5 / 16);
                this.distributeError(out, x + 1, y + 1, width, height, errR, errG, errB, 1 / 16);
            }
        }
        return out;
    }
    applyOrderedDithering(pixels, width, height, mode, strength) {
        const matrix = getDitherMatrix(mode);
        const size = Math.sqrt(matrix.length);
        const out = new Array(pixels.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const p = pixels[idx];
                if (p.alpha === 0) {
                    out[idx] = p;
                    continue;
                }
                const threshold = matrix[(y % size) * size + (x % size)];
                const bias = (threshold - 0.5) * strength * 255;
                const biasedR = Math.max(0, Math.min(255, p.r + bias));
                const biasedG = Math.max(0, Math.min(255, p.g + bias));
                const biasedB = Math.max(0, Math.min(255, p.b + bias));
                const lab = rgbToOklab({
                    r: biasedR,
                    g: biasedG,
                    b: biasedB,
                });
                let minDist = Number.MAX_VALUE;
                let bestIdx = 0;
                for (let i = 0; i < this.paletteLabs.length; i++) {
                    const targetLab = this.paletteLabs[i];
                    const targetRgb = this.palette[i];
                    let dist = this.colorDistanceSq(lab, targetLab);
                    const isTargetBlack = targetRgb.r === 0 && targetRgb.g === 0 && targetRgb.b === 0;
                    if (isTargetBlack) {
                        if (lab.L < 0.2) {
                            const lBias = (0.2 - lab.L) * 1.5;
                            dist -= lBias * lBias;
                        }
                    }
                    if (lab.L < 0.1) {
                        const dR = (biasedR - targetRgb.r) / 255;
                        const dG = (biasedG - targetRgb.g) / 255;
                        const dB = (biasedB - targetRgb.b) / 255;
                        const rgbDistSq = dR * dR + dG * dG + dB * dB;
                        const rgbWeight = 0.5 - lab.L;
                        dist += rgbDistSq * rgbWeight;
                    }
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                }
                const closest = this.palette[bestIdx];
                out[idx] = { ...closest, alpha: p.alpha };
            }
        }
        return out;
    }
    distributeError(pixels, x, y, width, height, errR, errG, errB, weight) {
        if (x < 0 || x >= width || y < 0 || y >= height)
            return;
        const idx = y * width + x;
        const p = pixels[idx];
        if (p.alpha === 0)
            return;
        p.r = Math.max(0, Math.min(255, p.r + errR * weight));
        p.g = Math.max(0, Math.min(255, p.g + errG * weight));
        p.b = Math.max(0, Math.min(255, p.b + errB * weight));
    }
    colorDistanceSq(c1, c2) {
        const dL = c1.L - c2.L;
        const da = c1.a - c2.a;
        const db = c1.b - c2.b;
        return dL * dL + da * da + db * db;
    }
}
