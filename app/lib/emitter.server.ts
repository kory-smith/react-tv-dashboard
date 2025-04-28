import { EventEmitter } from "events";

// Declare emitter type for type safety
declare global {
  var __emitter: EventEmitter | undefined;
}

let emitter: EventEmitter;

// Ensure only one emitter instance exists globally (important for development hot reload)
if (process.env.NODE_ENV === "production") {
  emitter = new EventEmitter();
} else {
  if (!global.__emitter) {
    global.__emitter = new EventEmitter();
  }
  emitter = global.__emitter;
}

// Set max listeners to avoid warnings for many connections
emitter.setMaxListeners(100); // Adjust as needed

export { emitter }; 