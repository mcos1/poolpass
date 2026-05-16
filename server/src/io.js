let ioInstance = null;

export function setIO(io) {
  ioInstance = io;
}

export function getIO() {
  return ioInstance;
}

export function emitToCompany(event, payload) {
  ioInstance?.to("company").emit(event, payload);
}
