import type { LoaderFunctionArgs } from "@remix-run/node";
import { eventStream } from "remix-utils/sse/server";
import { emitter } from "~/lib/emitter.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // TODO: Add authentication check here if needed

  return eventStream(request.signal, function setup(send) {
    const handleEvent = (data: any) => {
      // Send the event data to the client
      // Ensure data is stringified if it's an object
      send({ event: data.type, data: JSON.stringify(data) });
    };

    // Listener for score updates
    emitter.on("score_update", handleEvent);

    // Return cleanup function to remove listener when client disconnects
    return function clear() {
      emitter.off("score_update", handleEvent);
    };
  });
} 