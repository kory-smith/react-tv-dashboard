import { useState, useEffect, useRef } from 'react';

// Define the structure of the score update event data
interface ScoreUpdateData {
  type: 'SCORE_UPDATE';
  employeeId: number;
  field: 'day' | 'week' | 'month' | 'wrongNumbers';
  newValue: number;
  timestamp: string;
}

// Define the structure of the user creation event data
interface UserCreatedData {
  type: 'USER_CREATED';
  employee: {
    id: number;
    name: string;
    wrongNumbers: number;
    scores: {
      id: number;
      employeeId: number;
      timestamp: string;
      score: number;
    }[];
    processedScores: {
      day: number;
      week: number;
      month: number;
    };
  };
  timestamp: string;
}

// Combined event type
type EventData = ScoreUpdateData | UserCreatedData;

// Define the hook's return type
interface UseSSEReturn {
  lastEvent: EventData | null;
  isConnected: boolean;
  error: Event | null;
}

/**
 * Custom hook to connect to a Server-Sent Events (SSE) stream.
 * Manages the connection lifecycle and processes incoming score update events.
 *
 * @param url The URL of the SSE endpoint.
 * @returns An object containing the last received event, connection status, and any error.
 */
export function useSSE(url: string): UseSSEReturn {
  const [lastEvent, setLastEvent] = useState<EventData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Event | null>(null);
  // useRef to hold the EventSource instance to avoid recreating it on re-renders
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Only establish connection if URL is provided and not already connected
    if (url && !eventSourceRef.current) {
      console.log(`Connecting to SSE stream at: ${url}`);
      const es = new EventSource(url, { withCredentials: true }); // Use withCredentials if auth cookies are needed
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('SSE Connection opened');
        setIsConnected(true);
        setError(null);
      };

      es.onerror = (err) => {
        console.error('SSE Error:', err);
        setError(err);
        setIsConnected(false);
        // Don't automatically close here, EventSource might retry
        // es.close(); // Close manually if retry is not desired
      };

      // Listen specifically for 'SCORE_UPDATE' events
      es.addEventListener('SCORE_UPDATE', (event) => {
        // console.log('SSE SCORE_UPDATE received:', event.data);
        try {
          const parsedData: ScoreUpdateData = JSON.parse(event.data);
          // Basic validation of the received data structure
          if (parsedData && parsedData.type === 'SCORE_UPDATE' && typeof parsedData.newValue === 'number') {
            setLastEvent(parsedData);
          } else {
            console.warn('Received invalid SCORE_UPDATE data:', parsedData);
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event data:', parseError, event.data);
        }
      });

      // Listen for 'USER_CREATED' events
      es.addEventListener('USER_CREATED', (event) => {
        console.log('SSE USER_CREATED received:', event.data);
        try {
          const parsedData: UserCreatedData = JSON.parse(event.data);
          // Basic validation of the received data
          if (parsedData && parsedData.type === 'USER_CREATED' && parsedData.employee) {
            setLastEvent(parsedData);
          } else {
            console.warn('Received invalid USER_CREATED data:', parsedData);
          }
        } catch (parseError) {
          console.error('Failed to parse USER_CREATED event data:', parseError, event.data);
        }
      });

      // Generic message handler (optional, handles events without specific type)
      // es.onmessage = (event) => {
      //   console.log('Generic SSE message:', event.data);
      // };
    }

    // Cleanup function runs when component unmounts or URL changes
    return () => {
      if (eventSourceRef.current) {
        console.log('Closing SSE Connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null; // Clear the ref
        setIsConnected(false);
      }
    };
  }, [url]); // Re-run effect if URL changes

  return { lastEvent, isConnected, error };
} 