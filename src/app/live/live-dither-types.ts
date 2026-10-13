export type LiveSubject = "statue" | "photo";

export type LiveDitherSettings = {
  subject: LiveSubject;
  threshold: number;
  noise: number;
  pixelSize: number;
};
