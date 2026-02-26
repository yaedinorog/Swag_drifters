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

export const carHandling: CarHandlingConfig = {
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
};
