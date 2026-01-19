//! SIMD-optimized vector math operations

/// 2D Vector
#[derive(Clone, Copy, Debug, Default)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    #[inline]
    pub const fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    #[inline]
    pub const fn zero() -> Self {
        Self { x: 0.0, y: 0.0 }
    }

    #[inline]
    pub fn magnitude(&self) -> f32 {
        (self.x * self.x + self.y * self.y).sqrt()
    }

    #[inline]
    pub fn magnitude_squared(&self) -> f32 {
        self.x * self.x + self.y * self.y
    }

    #[inline]
    pub fn normalize(&self) -> Self {
        let mag = self.magnitude();
        if mag > 0.0001 {
            Self {
                x: self.x / mag,
                y: self.y / mag,
            }
        } else {
            Self::zero()
        }
    }

    #[inline]
    pub fn dot(&self, other: &Self) -> f32 {
        self.x * other.x + self.y * other.y
    }

    #[inline]
    pub fn cross(&self, other: &Self) -> f32 {
        self.x * other.y - self.y * other.x
    }

    #[inline]
    pub fn add(&self, other: &Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }

    #[inline]
    pub fn sub(&self, other: &Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }

    #[inline]
    pub fn scale(&self, s: f32) -> Self {
        Self {
            x: self.x * s,
            y: self.y * s,
        }
    }

    #[inline]
    pub fn lerp(&self, other: &Self, t: f32) -> Self {
        Self {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
        }
    }

    #[inline]
    pub fn distance(&self, other: &Self) -> f32 {
        self.sub(other).magnitude()
    }

    #[inline]
    pub fn rotate(&self, angle: f32) -> Self {
        let cos = angle.cos();
        let sin = angle.sin();
        Self {
            x: self.x * cos - self.y * sin,
            y: self.x * sin + self.y * cos,
        }
    }

    #[inline]
    pub fn perpendicular(&self) -> Self {
        Self { x: -self.y, y: self.x }
    }

    #[inline]
    pub fn reflect(&self, normal: &Self) -> Self {
        let d = self.dot(normal) * 2.0;
        Self {
            x: self.x - normal.x * d,
            y: self.y - normal.y * d,
        }
    }

    #[inline]
    pub fn angle(&self) -> f32 {
        self.y.atan2(self.x)
    }

    #[inline]
    pub fn from_angle(angle: f32) -> Self {
        Self {
            x: angle.cos(),
            y: angle.sin(),
        }
    }
}

/// 3D Vector
#[derive(Clone, Copy, Debug, Default)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vec3 {
    #[inline]
    pub const fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    #[inline]
    pub const fn zero() -> Self {
        Self { x: 0.0, y: 0.0, z: 0.0 }
    }

    #[inline]
    pub fn magnitude(&self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    #[inline]
    pub fn magnitude_squared(&self) -> f32 {
        self.x * self.x + self.y * self.y + self.z * self.z
    }

    #[inline]
    pub fn normalize(&self) -> Self {
        let mag = self.magnitude();
        if mag > 0.0001 {
            Self {
                x: self.x / mag,
                y: self.y / mag,
                z: self.z / mag,
            }
        } else {
            Self::zero()
        }
    }

    #[inline]
    pub fn dot(&self, other: &Self) -> f32 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    #[inline]
    pub fn cross(&self, other: &Self) -> Self {
        Self {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }

    #[inline]
    pub fn add(&self, other: &Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
            z: self.z + other.z,
        }
    }

    #[inline]
    pub fn sub(&self, other: &Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
            z: self.z - other.z,
        }
    }

    #[inline]
    pub fn scale(&self, s: f32) -> Self {
        Self {
            x: self.x * s,
            y: self.y * s,
            z: self.z * s,
        }
    }

    #[inline]
    pub fn lerp(&self, other: &Self, t: f32) -> Self {
        Self {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
            z: self.z + (other.z - self.z) * t,
        }
    }

    #[inline]
    pub fn distance(&self, other: &Self) -> f32 {
        self.sub(other).magnitude()
    }

    /// Convert to spherical coordinates (r, theta, phi)
    #[inline]
    pub fn to_spherical(&self) -> (f32, f32, f32) {
        let r = self.magnitude();
        if r < 0.0001 {
            return (0.0, 0.0, 0.0);
        }
        let theta = (self.z / r).acos();
        let phi = self.y.atan2(self.x);
        (r, theta, phi)
    }

    /// Create from spherical coordinates
    #[inline]
    pub fn from_spherical(r: f32, theta: f32, phi: f32) -> Self {
        Self {
            x: r * theta.sin() * phi.cos(),
            y: r * theta.sin() * phi.sin(),
            z: r * theta.cos(),
        }
    }

    /// Convert lat/lng to 3D point on unit sphere
    #[inline]
    pub fn from_lat_lng(lat: f32, lng: f32) -> Self {
        let lat_rad = lat.to_radians();
        let lng_rad = lng.to_radians();
        Self {
            x: lat_rad.cos() * lng_rad.cos(),
            y: lat_rad.cos() * lng_rad.sin(),
            z: lat_rad.sin(),
        }
    }

    /// Convert point on unit sphere to lat/lng
    #[inline]
    pub fn to_lat_lng(&self) -> (f32, f32) {
        let lat = self.z.asin().to_degrees();
        let lng = self.y.atan2(self.x).to_degrees();
        (lat, lng)
    }
}

/// 4x4 Matrix (column-major)
#[derive(Clone, Copy, Debug)]
pub struct Mat4 {
    pub data: [f32; 16],
}

impl Mat4 {
    pub fn identity() -> Self {
        Self {
            data: [
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
        }
    }

    pub fn translation(x: f32, y: f32, z: f32) -> Self {
        Self {
            data: [
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                x, y, z, 1.0,
            ],
        }
    }

    pub fn scale(x: f32, y: f32, z: f32) -> Self {
        Self {
            data: [
                x, 0.0, 0.0, 0.0,
                0.0, y, 0.0, 0.0,
                0.0, 0.0, z, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
        }
    }

    pub fn rotation_x(angle: f32) -> Self {
        let c = angle.cos();
        let s = angle.sin();
        Self {
            data: [
                1.0, 0.0, 0.0, 0.0,
                0.0, c, s, 0.0,
                0.0, -s, c, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
        }
    }

    pub fn rotation_y(angle: f32) -> Self {
        let c = angle.cos();
        let s = angle.sin();
        Self {
            data: [
                c, 0.0, -s, 0.0,
                0.0, 1.0, 0.0, 0.0,
                s, 0.0, c, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
        }
    }

    pub fn rotation_z(angle: f32) -> Self {
        let c = angle.cos();
        let s = angle.sin();
        Self {
            data: [
                c, s, 0.0, 0.0,
                -s, c, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
        }
    }

    pub fn perspective(fov: f32, aspect: f32, near: f32, far: f32) -> Self {
        let f = 1.0 / (fov / 2.0).tan();
        let nf = 1.0 / (near - far);
        
        Self {
            data: [
                f / aspect, 0.0, 0.0, 0.0,
                0.0, f, 0.0, 0.0,
                0.0, 0.0, (far + near) * nf, -1.0,
                0.0, 0.0, 2.0 * far * near * nf, 0.0,
            ],
        }
    }

    pub fn multiply(&self, other: &Self) -> Self {
        let mut result = [0.0f32; 16];
        
        for i in 0..4 {
            for j in 0..4 {
                result[i * 4 + j] = 
                    self.data[0 * 4 + j] * other.data[i * 4 + 0] +
                    self.data[1 * 4 + j] * other.data[i * 4 + 1] +
                    self.data[2 * 4 + j] * other.data[i * 4 + 2] +
                    self.data[3 * 4 + j] * other.data[i * 4 + 3];
            }
        }
        
        Self { data: result }
    }

    pub fn transform_point(&self, v: &Vec3) -> Vec3 {
        let w = self.data[3] * v.x + self.data[7] * v.y + self.data[11] * v.z + self.data[15];
        Vec3 {
            x: (self.data[0] * v.x + self.data[4] * v.y + self.data[8] * v.z + self.data[12]) / w,
            y: (self.data[1] * v.x + self.data[5] * v.y + self.data[9] * v.z + self.data[13]) / w,
            z: (self.data[2] * v.x + self.data[6] * v.y + self.data[10] * v.z + self.data[14]) / w,
        }
    }

    pub fn transform_direction(&self, v: &Vec3) -> Vec3 {
        Vec3 {
            x: self.data[0] * v.x + self.data[4] * v.y + self.data[8] * v.z,
            y: self.data[1] * v.x + self.data[5] * v.y + self.data[9] * v.z,
            z: self.data[2] * v.x + self.data[6] * v.y + self.data[10] * v.z,
        }
    }
}

/// Quaternion for rotations
#[derive(Clone, Copy, Debug)]
pub struct Quat {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub w: f32,
}

impl Quat {
    pub const fn identity() -> Self {
        Self { x: 0.0, y: 0.0, z: 0.0, w: 1.0 }
    }

    pub fn from_axis_angle(axis: &Vec3, angle: f32) -> Self {
        let half = angle / 2.0;
        let s = half.sin();
        let normalized = axis.normalize();
        Self {
            x: normalized.x * s,
            y: normalized.y * s,
            z: normalized.z * s,
            w: half.cos(),
        }
    }

    pub fn from_euler(x: f32, y: f32, z: f32) -> Self {
        let cx = (x / 2.0).cos();
        let sx = (x / 2.0).sin();
        let cy = (y / 2.0).cos();
        let sy = (y / 2.0).sin();
        let cz = (z / 2.0).cos();
        let sz = (z / 2.0).sin();

        Self {
            x: sx * cy * cz - cx * sy * sz,
            y: cx * sy * cz + sx * cy * sz,
            z: cx * cy * sz - sx * sy * cz,
            w: cx * cy * cz + sx * sy * sz,
        }
    }

    pub fn magnitude(&self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z + self.w * self.w).sqrt()
    }

    pub fn normalize(&self) -> Self {
        let mag = self.magnitude();
        if mag > 0.0001 {
            Self {
                x: self.x / mag,
                y: self.y / mag,
                z: self.z / mag,
                w: self.w / mag,
            }
        } else {
            Self::identity()
        }
    }

    pub fn conjugate(&self) -> Self {
        Self {
            x: -self.x,
            y: -self.y,
            z: -self.z,
            w: self.w,
        }
    }

    pub fn multiply(&self, other: &Self) -> Self {
        Self {
            x: self.w * other.x + self.x * other.w + self.y * other.z - self.z * other.y,
            y: self.w * other.y - self.x * other.z + self.y * other.w + self.z * other.x,
            z: self.w * other.z + self.x * other.y - self.y * other.x + self.z * other.w,
            w: self.w * other.w - self.x * other.x - self.y * other.y - self.z * other.z,
        }
    }

    pub fn rotate_vector(&self, v: &Vec3) -> Vec3 {
        let qv = Self { x: v.x, y: v.y, z: v.z, w: 0.0 };
        let result = self.multiply(&qv).multiply(&self.conjugate());
        Vec3 { x: result.x, y: result.y, z: result.z }
    }

    pub fn slerp(&self, other: &Self, t: f32) -> Self {
        let mut dot = self.x * other.x + self.y * other.y + self.z * other.z + self.w * other.w;
        
        let (other, dot) = if dot < 0.0 {
            (Self { x: -other.x, y: -other.y, z: -other.z, w: -other.w }, -dot)
        } else {
            (*other, dot)
        };

        if dot > 0.9995 {
            // Linear interpolation for very close quaternions
            Self {
                x: self.x + t * (other.x - self.x),
                y: self.y + t * (other.y - self.y),
                z: self.z + t * (other.z - self.z),
                w: self.w + t * (other.w - self.w),
            }.normalize()
        } else {
            let theta = dot.acos();
            let sin_theta = theta.sin();
            let s0 = ((1.0 - t) * theta).sin() / sin_theta;
            let s1 = (t * theta).sin() / sin_theta;

            Self {
                x: s0 * self.x + s1 * other.x,
                y: s0 * self.y + s1 * other.y,
                z: s0 * self.z + s1 * other.z,
                w: s0 * self.w + s1 * other.w,
            }
        }
    }

    pub fn to_matrix4(&self) -> Mat4 {
        let x2 = self.x + self.x;
        let y2 = self.y + self.y;
        let z2 = self.z + self.z;
        
        let xx = self.x * x2;
        let xy = self.x * y2;
        let xz = self.x * z2;
        let yy = self.y * y2;
        let yz = self.y * z2;
        let zz = self.z * z2;
        let wx = self.w * x2;
        let wy = self.w * y2;
        let wz = self.w * z2;

        Mat4 {
            data: [
                1.0 - (yy + zz), xy + wz, xz - wy, 0.0,
                xy - wz, 1.0 - (xx + zz), yz + wx, 0.0,
                xz + wy, yz - wx, 1.0 - (xx + yy), 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH OPERATIONS (for SIMD-style processing)
// ═══════════════════════════════════════════════════════════════════════════

/// Batch transform an array of points
pub fn batch_transform_points(points: &mut [(f32, f32, f32)], matrix: &Mat4) {
    for (x, y, z) in points.iter_mut() {
        let v = Vec3::new(*x, *y, *z);
        let result = matrix.transform_point(&v);
        *x = result.x;
        *y = result.y;
        *z = result.z;
    }
}

/// Batch compute distances
pub fn batch_distances(points: &[(f32, f32)], target: (f32, f32)) -> Vec<f32> {
    points.iter()
        .map(|(x, y)| {
            let dx = x - target.0;
            let dy = y - target.1;
            (dx * dx + dy * dy).sqrt()
        })
        .collect()
}

/// Batch normalize vectors
pub fn batch_normalize(vectors: &mut [(f32, f32)]) {
    for (x, y) in vectors.iter_mut() {
        let mag = (*x * *x + *y * *y).sqrt();
        if mag > 0.0001 {
            *x /= mag;
            *y /= mag;
        }
    }
}
