export interface CarHandlingConfig {
  // Сила разгона при нажатии газа.
  acceleration: number;
  // Интенсивность замедления при торможении.
  brakingForce: number;
  // Базовое сопротивление движению (чем выше, тем быстрее теряется скорость).
  drag: number;
  // Базовое сцепление: как быстро вектор скорости выравнивается по направлению машины.
  baseGrip: number;
  // Сцепление в режиме дрифта/ручника (ниже = больше скольжение).
  driftGrip: number;
  // Дополнительный множитель снижения сцепления при зажатом ручнике.
  handbrakeGripPenalty: number;
  // Максимально допустимая скорость машины.
  maxSpeed: number;
  // Максимальная скорость поворота руля (yaw rate).
  maxSteerRate: number;
  // Плавность/резкость выхода на целевую угловую скорость поворота.
  turnResponse: number;
  // Порог боковой скорости, после которого состояние считается дрифтом.
  driftThreshold: number;
  // Дополнительное замедление на бездорожье (вне трассы).
  offTrackDamping: number;
}

export interface TurboConfig {
  // Доля секунды дрифта, которая конвертируется в секунду турбо (0.2 = 20%).
  fillRate: number;
  // Максимальный заряд турбо в секундах.
  maxCharge: number;
  // Параметры carHandling, которые меняются при активном турбо (остальные — без изменений).
  handling: Partial<CarHandlingConfig>;
}

export interface CarConfig {
  handling: CarHandlingConfig;
  turbo: TurboConfig;
}

export const DEFAULT_CAR: CarConfig = {
  handling: {
    acceleration: 420,
    brakingForce: 460,
    drag: 0.65,
    baseGrip: 2,
    driftGrip: 0.5,
    handbrakeGripPenalty: 0.45,
    maxSpeed: 700,
    maxSteerRate: 3.7,
    turnResponse: 5.2,
    driftThreshold: 55,
    offTrackDamping: 0.95
  },
  turbo: {
    fillRate: 0.2,
    maxCharge: 3,
    handling: {
      acceleration: 620
    }
  }
};

export function getEffectiveHandling(car: CarConfig, turboActive: boolean): CarHandlingConfig {
  if (!turboActive) return car.handling;
  return { ...car.handling, ...car.turbo.handling };
}

// Backward-compat alias used by existing imports
export const carHandling = DEFAULT_CAR.handling;
