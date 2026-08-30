const LL = {
    // ---------- 基础工具 ----------
    hua_getKBZ(x1, y1, x2, y2, points) {
        if (!points) throw new Error('points is null');
        const rows = points.length;
        if (rows === 0 || points[0].length < 3) throw new Error('输入点集必须至少包含 X, Y, Z 三列');
        const dx = x2 - x1,
            dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) throw new Error('直线两点重合');
        const len = Math.sqrt(len2);
        const a = y1 - y2,
            b = x2 - x1,
            c = x1 * y2 - x2 * y1;
        const result = new Array(rows);
        for (let i = 0; i < rows; i++) {
            const x0 = points[i][0],
                y0 = points[i][1],
                z = points[i][2];
            const dot = (x0 - x1) * dx + (y0 - y1) * dy;
            const signedDistToFoot = dot / len;
            const signedVerticalDist = (a * x0 + b * y0 + c) / len;
            result[i] = [signedDistToFoot, signedVerticalDist, z];
        }
        return result;
    },
    hua_Num2K(meters) {
        const km = Math.floor(meters / 1000);
        let m = Math.round((meters - km * 1000) * 100) / 100;
        if (Number.isInteger(m)) return `K${km}+${String(m).padStart(3,'0')}`;
        else return `K${km}+${m.toFixed(2).padStart(6,'0')}`;
    },
    hua_DmsToRadians(dms) {
        const deg = Math.floor(dms);
        const frac = dms - deg;
        const min = Math.floor(frac * 100);
        const sec = (frac * 100 - min) * 100;
        return (deg + min / 60 + sec / 3600) * Math.PI / 180;
    },
    hua_radiansToDMS_度分秒(rad) {
        let deg = rad * 180 / Math.PI;
        const d = Math.floor(deg);
        let rem = (deg - d) * 60;
        const m = Math.floor(rem);
        const s = (rem - m) * 60;
        return `${d}°${String(m).padStart(2,'0')}′${String(Math.round(s*10)/10).padStart(4,'0')}″`;
    },
    hua_Fwj(x0, y0, x1, y1) {
        const x = x1 - x0,
            y = y1 - y0;
        const cd = Math.sqrt(x * x + y * y);
        let hd = Math.atan2(y, x);
        if (hd < 0) hd += 2 * Math.PI;
        return [cd, hd];
    },
    // ---------- 线路计算 ----------
    hua_Zs(xyk, xyx, xyy, xyhd, xycd, xyqdr, xyzdr, xyzy, jsk, jsb, jd) {
        jd = this.hua_DmsToRadians(jd);
        if (Math.abs(xyqdr - xyzdr) < 0.01 && xyqdr > 0) {
            const cx = xyx + xyqdr * Math.cos(xyhd + xyzy * Math.PI / 2);
            const cy = xyy + xyqdr * Math.sin(xyhd + xyzy * Math.PI / 2);
            const da = (jsk - xyk) / xyqdr * xyzy;
            let az = xyhd + da;
            if (az < 0) az += 2 * Math.PI;
            const ang = xyhd + xyzy * Math.PI / 2 + da;
            return [cx - xyqdr * Math.cos(ang) + jsb * Math.cos(ang - xyzy * Math.PI / 2 + jd),
                cy - xyqdr * Math.sin(ang) + jsb * Math.sin(ang - xyzy * Math.PI / 2 + jd), az
            ];
        }
        if (xyqdr < 0.01 && xyzdr < 0.01 && xyzy < 0.01) {
            return [xyx + (jsk - xyk) * Math.cos(xyhd) + jsb * Math.cos(xyhd + jd),
                xyy + (jsk - xyk) * Math.sin(xyhd) + jsb * Math.sin(xyhd + jd), xyhd
            ];
        }
        let r1 = xyqdr < 0.001 ? 99999999 : xyqdr,
            r2 = xyzdr < 0.001 ? 99999999 : xyzdr;
        const f0 = xyhd,
            q = xyzy,
            c = 1 / r1,
            d = (r1 - r2) / (2 * xycd * r1 * r2);
        const rr = [0, 0.1739274226, 0.3260725774, 0.3260725774, 0.1739274226];
        const vv = [0, 0.0694318442, 0.3300094782, 1 - 0.3300094782, 1 - 0.0694318442];
        const w = jsk - xyk;
        let xs = 0,
            ys = 0;
        for (let i = 1; i < 5; i++) {
            const ff = f0 + q * vv[i] * w * (c + vv[i] * w * d);
            xs += rr[i] * Math.cos(ff);
            ys += rr[i] * Math.sin(ff);
        }
        let fhz3 = f0 + q * w * (c + w * d);
        if (fhz3 < 0) fhz3 += 2 * Math.PI;
        if (fhz3 >= 2 * Math.PI) fhz3 -= 2 * Math.PI;
        return [xyx + w * xs + jsb * Math.cos(fhz3 + jd),
            xyy + w * ys + jsb * Math.sin(fhz3 + jd), fhz3
        ];
    },
    hua_Dantiaoxianludange(pqx, k, b, z) {
        for (let i = 0; i < pqx.length; i++) {
            const [dtk, dtx, dty, dtfwj, dtcd, dtr1, dtr2, dtzy] = pqx[i];
            if (k >= dtk && k <= dtk + dtcd) {
                const hudu = this.hua_DmsToRadians(dtfwj);
                const js = this.hua_Zs(dtk, dtx, dty, hudu, dtcd, dtr1, dtr2, dtzy, k, b, z);
                return [Math.round(js[0] * 1000) / 1000, Math.round(js[1] * 1000) / 1000, js[2]];
            }
        }
        return [0, 0, 0];
    },
    hua_Fs(pqx, fsx, fsy) {
        let jljd = this.hua_Fwj(pqx[0][1], pqx[0][2], fsx, fsy);
        let k = pqx[0][0];
        const hudu = this.hua_DmsToRadians(pqx[0][3]);
        let cz = jljd[0] * Math.cos(jljd[1] - hudu);
        let pj = jljd[0] * Math.sin(jljd[1] - hudu);
        const qdlc = pqx[0][0];
        const zdlc = pqx[pqx.length - 1][0] + pqx[pqx.length - 1][4];
        let iter = 0;
        while (Math.abs(cz) > 0.01) {
            k += cz;
            iter++;
            if (k < qdlc) return [-1, -1];
            if (k > zdlc) return [-2, -2];
            if (iter > 15) return [-3, -3];
            const xy = this.hua_Dantiaoxianludange(pqx, k, 0, 0);
            jljd = this.hua_Fwj(xy[0], xy[1], fsx, fsy);
            cz = jljd[0] * Math.cos(jljd[1] - xy[2]);
            pj = jljd[0] * Math.sin(jljd[1] - xy[2]);
        }
        return [Math.round(k * 1000) / 1000, Math.round(pj * 1000) / 1000];
    },
    // ---------- 新增：快速生成线路点列 ----------
    hua_Dantiaoxianlu(pqx, startK, endK, step, b, z) {
        if (!pqx || pqx.length === 0) return null;
        const rowCount = pqx.length;
        const realStart = (startK !== undefined && startK !== null) ? startK : pqx[0][0];
        const realEnd = (endK !== undefined && endK !== null) ? endK : (pqx[rowCount - 1][0] + pqx[rowCount - 1][4]);
        if (realStart > realEnd || step <= 0) return null;
        const kList = [];
        kList.push(realStart);
        const firstMultiple = Math.ceil(realStart / step) * step;
        if (Math.abs(firstMultiple - realStart) > 1e-9) kList.push(firstMultiple);
        for (let k = firstMultiple + step; k <= realEnd - 1e-9; k += step) kList.push(k);
        if (Math.abs(kList[kList.length - 1] - realEnd) > 1e-9) kList.push(realEnd);

        const points = [];
        let pointIdx = 0;
        const totalPoints = kList.length;
        const bVal = (b !== undefined && b !== null) ? b : 0;
        const zVal = (z !== undefined && z !== null) ? z : 0;

        for (let i = 0; i < rowCount && pointIdx < totalPoints; i++) {
            const segStart = pqx[i][0];
            const segEnd = segStart + pqx[i][4];
            const startX = pqx[i][1];
            const startY = pqx[i][2];
            const azimuthRad = this.hua_DmsToRadians(pqx[i][3]);
            const length = pqx[i][4];
            const r1 = pqx[i][5];
            const r2 = pqx[i][6];
            const turn = pqx[i][7];
            while (pointIdx < totalPoints && kList[pointIdx] <= segEnd + 1e-9) {
                const currentK = kList[pointIdx];
                if (currentK < segStart - 1e-9) {
                    pointIdx++;
                    continue;
                }
                const result = this.hua_Zs(segStart, startX, startY, azimuthRad, length, r1, r2, turn, currentK, bVal, zVal);
                points.push([currentK, result[0], result[1], result[2]]);
                pointIdx++;
            }
        }
        const count = points.length;
        const matrix = new Array(count);
        for (let i = 0; i < count; i++) {
            matrix[i] = [points[i][0], points[i][1], points[i][2], points[i][3]];
        }
        return matrix;
    },
    // ---------- 高斯投影 ----------
    hua_Gauss_proj(L, B, lonCenter) {
        if (lonCenter === undefined) lonCenter = 360.0;
        const pi = Math.PI;
        const p0 = 206264.8062470963551564;
        const e = 0.00669438002290;
        const e1 = 0.00673949677548;
        const b = 6356752.3141;
        const a = 6378137.0;
        B = B * pi / 180;
        L = L * pi / 180;
        let L_num, L_center;
        if (lonCenter >= 359) {
            L_num = Math.floor(L * 180 / pi / 3.0 + 0.5);
            L_center = 3 * L_num;
        } else {
            L_center = lonCenter;
        }
        const l = (L / pi * 180 - L_center) * 3600;
        const M0 = a * (1 - e);
        const M2 = 3.0 / 2.0 * e * M0;
        const M4 = 5.0 / 4.0 * e * M2;
        const M6 = 7.0 / 6.0 * e * M4;
        const M8 = 9.0 / 8.0 * e * M6;
        const a0 = M0 + M2 / 2.0 + 3.0 / 8.0 * M4 + 5.0 / 16.0 * M6 + 35.0 / 128.0 * M8;
        const a2 = M2 / 2.0 + M4 / 2 + 15.0 / 32.0 * M6 + 7.0 / 16.0 * M8;
        const a4 = M4 / 8.0 + 3.0 / 16.0 * M6 + 7.0 / 32.0 * M8;
        const a6 = M6 / 32.0 + M8 / 16.0;
        const a8 = M8 / 128.0;
        const Xz = a0 * B - a2 / 2.0 * Math.sin(2 * B) + a4 / 4.0 * Math.sin(4 * B) - a6 / 6.0 * Math.sin(6 * B) + a8 / 8.0 * Math.sin(8 * B);
        const c = a * a / b;
        const V = Math.sqrt(1 + e1 * Math.cos(B) * Math.cos(B));
        const N = c / V;
        const t = Math.tan(B);
        const n = e1 * Math.cos(B) * Math.cos(B);
        const m1 = N * Math.cos(B);
        const m2 = N / 2.0 * Math.sin(B) * Math.cos(B);
        const m3 = N / 6.0 * Math.pow(Math.cos(B), 3) * (1 - t * t + n);
        const m4 = N / 24.0 * Math.sin(B) * Math.pow(Math.cos(B), 3) * (5 - t * t + 9 * n);
        const m5 = N / 120.0 * Math.pow(Math.cos(B), 5) * (5 - 18 * t * t + Math.pow(t, 4) + 14 * n - 58 * n * t * t);
        const m6 = N / 720.0 * Math.sin(B) * Math.pow(Math.cos(B), 5) * (61 - 58 * t * t + Math.pow(t, 4));
        const x = Xz + m2 * l * l / Math.pow(p0, 2) + m4 * Math.pow(l, 4) / Math.pow(p0, 4) + m6 * Math.pow(l, 6) / Math.pow(p0, 6);
        const y0 = m1 * l / p0 + m3 * Math.pow(l, 3) / Math.pow(p0, 3) + m5 * Math.pow(l, 5) / Math.pow(p0, 5);
        const y = y0 + 500000;
        return [x, y, L_center];
    },
    hua_Gauss_unproj(x, y, l0) {
        const pi = Math.PI;
        const e = 0.00669438002290;
        const e1 = 0.00673949677548;
        const b = 6356752.3141;
        const a = 6378137.0;
        const y1 = y - 500000;
        const M0 = a * (1 - e);
        const M2 = 3.0 / 2.0 * e * M0;
        const M4 = 5.0 / 4.0 * e * M2;
        const M6 = 7.0 / 6.0 * e * M4;
        const M8 = 9.0 / 8.0 * e * M6;
        const a0 = M0 + M2 / 2.0 + 3.0 / 8.0 * M4 + 5.0 / 16.0 * M6 + 35.0 / 128.0 * M8;
        const a2 = M2 / 2.0 + M4 / 2 + 15.0 / 32.0 * M6 + 7.0 / 16.0 * M8;
        const a4 = M4 / 8.0 + 3.0 / 16.0 * M6 + 7.0 / 32.0 * M8;
        const a6 = M6 / 32.0 + M8 / 16.0;
        let Bf = x / a0;
        let B0 = Bf;
        while (Math.abs(Bf - B0) > 0.0000001 || B0 === Bf) {
            B0 = Bf;
            const FBf = -a2 / 2.0 * Math.sin(2 * B0) + a4 / 4.0 * Math.sin(4 * B0) - a6 / 6.0 * Math.sin(6 * B0);
            Bf = (x - FBf) / a0;
        }
        const t = Math.tan(Bf);
        const c = a * a / b;
        const V = Math.sqrt(1 + e1 * Math.cos(Bf) * Math.cos(Bf));
        const N = c / V;
        const M = c / Math.pow(V, 3);
        const n = e1 * Math.cos(Bf) * Math.cos(Bf);
        const n1 = 1 / (N * Math.cos(Bf));
        const n2 = -t / (2.0 * M * N);
        const n3 = -(1 + 2 * t * t + n) / (6.0 * Math.pow(N, 3) * Math.cos(Bf));
        const n4 = t * (5 + 3 * t * t + n - 9 * n * t * t) / (24.0 * M * Math.pow(N, 3));
        const n5 = (5 + 28 * t * t + 24 * Math.pow(t, 4) + 6 * n + 8 * n * t * t) / (120.0 * Math.pow(N, 5) * Math.cos(Bf));
        const n6 = -t * (61 + 90 * t * t + 45 * Math.pow(t, 4)) / (720.0 * M * Math.pow(N, 5));
        const B = (Bf + n2 * y1 * y1 + n4 * Math.pow(y1, 4) + n6 * Math.pow(y1, 6)) / pi * 180;
        const l = n1 * y1 + n3 * Math.pow(y1, 3) + n5 * Math.pow(y1, 5);
        const L = l0 + l / pi * 180;
        return [L, B];
    },
    // ---------- UTM ----------
    hua_Utm_proj(lon, lat) {
        const a = 6378137,
            f = 1 / 298.257223563;
        const e2 = 2 * f - f * f,
            e2p = e2 / (1 - e2);
        const k0 = 0.9996,
            FE = 500000,
            FN = 10000000;
        const zone = Math.floor((lon + 180) / 6) + 1;
        const cm = (zone - 1) * 6 - 180 + 3;
        const latRad = lat * Math.PI / 180,
            lonRad = lon * Math.PI / 180,
            cmRad = cm * Math.PI / 180;
        const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
        const T = Math.tan(latRad) ** 2;
        const C = e2p * Math.cos(latRad) ** 2;
        const A = (lonRad - cmRad) * Math.cos(latRad);
        const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * latRad -
            (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * latRad) +
            (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * latRad) -
            (35 * e2 ** 3 / 3072) * Math.sin(6 * latRad));
        const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * e2p) * A ** 5 / 120) + FE;
        let northing = k0 * (M + N * Math.tan(latRad) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * e2p) * A ** 6 / 720));
        if (lat < 0) northing += FN;
        return [northing, easting, zone];
    },
    hua_Utm_unproj(northing, easting, isNorthern, zoneNumber) {
        const a = 6378137,
            f = 1 / 298.257223563;
        const e2 = 2 * f - f * f,
            e2p = e2 / (1 - e2);
        const k0 = 0.9996,
            FE = 500000,
            FN = 10000000;
        const x = easting - FE;
        const y = isNorthern ? northing : northing - FN;
        const cm = (zoneNumber - 1) * 6 - 180 + 3;
        const lonCenterRad = cm * Math.PI / 180;
        const M = y / k0;
        const mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
        const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
        const phi1Rad = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
        const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1Rad) ** 2);
        const T1 = Math.tan(phi1Rad) ** 2;
        const C1 = e2p * Math.cos(phi1Rad) ** 2;
        const R1 = a * (1 - e2) / (1 - e2 * Math.sin(phi1Rad) ** 2) ** 1.5;
        const D = x / (N1 * k0);
        const latRad = phi1Rad - (N1 * Math.tan(phi1Rad) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e2p) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e2p - 3 * C1 ** 2) * D ** 6 / 720);
        const lonRad = lonCenterRad + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e2p + 24 * T1 ** 2) * D ** 5 / 120) / Math.cos(phi1Rad);
        return [lonRad * 180 / Math.PI, latRad * 180 / Math.PI];
    },
    utm_zone(lon) {
        return Math.floor((lon + 180) / 6) + 1;
    },
    // ---------- 四参数 ----------
    hua_Cs4(source, target) {
        if (!source || !target || source.length !== target.length) return [0, 0, 0, 1];
        if (source.length < 4 || source.length % 2 !== 0) return [0, 0, 0, 1];
        const pointCount = source.length / 2;
        let sumX1 = 0,
            sumY1 = 0,
            sumX2 = 0,
            sumY2 = 0;
        for (let i = 0; i < pointCount; i++) {
            sumX1 += source[2 * i];
            sumY1 += source[2 * i + 1];
            sumX2 += target[2 * i];
            sumY2 += target[2 * i + 1];
        }
        const meanX1 = sumX1 / pointCount,
            meanY1 = sumY1 / pointCount;
        const meanX2 = sumX2 / pointCount,
            meanY2 = sumY2 / pointCount;
        const centeredSource = new Array(source.length);
        const centeredTarget = new Array(target.length);
        for (let i = 0; i < pointCount; i++) {
            centeredSource[2 * i] = source[2 * i] - meanX1;
            centeredSource[2 * i + 1] = source[2 * i + 1] - meanY1;
            centeredTarget[2 * i] = target[2 * i] - meanX2;
            centeredTarget[2 * i + 1] = target[2 * i + 1] - meanY2;
        }
        let H11 = 0,
            H12 = 0,
            H21 = 0,
            H22 = 0;
        let B1 = 0,
            B2 = 0;
        for (let i = 0; i < pointCount; i++) {
            const x1 = centeredSource[2 * i],
                y1 = centeredSource[2 * i + 1];
            const x2 = centeredTarget[2 * i],
                y2 = centeredTarget[2 * i + 1];
            H11 += x1 * x1 + y1 * y1;
            H22 += x1 * x1 + y1 * y1;
            B1 += x1 * x2 + y1 * y2;
            B2 += x1 * y2 - y1 * x2;
        }
        const det = H11 * H22 - H12 * H21;
        if (Math.abs(det) < 1e-15) return [0, 0, 0, 1];
        const a = (H22 * B1 - H12 * B2) / det;
        const b = (-H21 * B1 + H11 * B2) / det;
        const scale = Math.sqrt(a * a + b * b);
        const rotation = Math.atan2(b, a);
        const deltaX = meanX2 - (a * meanX1 - b * meanY1);
        const deltaY = meanY2 - (b * meanX1 + a * meanY1);
        return [deltaX, deltaY, rotation, scale];
    },
    hua_FourParameterTransform(x, y, dx, dy, rot, scale) {
        return [scale * (x * Math.cos(rot) - y * Math.sin(rot)) + dx, scale * (x * Math.sin(rot) + y * Math.cos(rot)) + dy];
    },
    // ---------- 批量转换 ----------
    mapGps2XyBatch(lonlatPoints, proj, controlLonLat, controlXy, center) {
        // 省略，保留占位（实际未使用）
        return lonlatPoints.map(() => [0, 0]);
    },
    mapXy2GpsBatch(xyPoints, proj, controlLonLat, controlXy) {
        return xyPoints.map(() => [0, 0]);
    },
    // ---------- 填挖方 & 偏移（占位） ----------
    hua_CutAndFillArea(dmx, sjx, extendDist) {
        return [0, 0, 0, 0, 0, 0, 0];
    },
    hua_OffsetPolyline(points, offset) {
        return points;
    }
};