import { CheckoutEventsData, initializePaddle, Paddle, PaddleEventData } from '@paddle/paddle-js';
import { useContext, useEffect, useState, createContext, useRef, useCallback } from 'react';
import { env } from '~/env/client.mjs';
import { isDev } from '~/env/other';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { EventEmitter } from '~/utils/eventEmitter';

type PaddleEventEmitter = {
  'checkout.completed': CheckoutEventsData | undefined;
  'checkout.closed': undefined;
  'checkout.loaded': undefined;
};

const PaddleContext = createContext<
  | {
      paddle: Paddle;
      emitter: EventEmitter<PaddleEventEmitter>;
    }
  | undefined
>(undefined);
export const usePaddle = () => {
  const context = useContext(PaddleContext);
  if (!context) throw new Error('Could not initialize paddle');
  return context;
};

export function PaddleProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser();

  const [paddle, setPaddle] = useState<Paddle>();
  const emitter = useRef<
    EventEmitter<{
      'checkout.completed': CheckoutEventsData | undefined;
      'checkout.closed': undefined;
      'checkout.loaded': undefined;
    }>
  >();
  const eventCallback = useCallback(
    (e: PaddleEventData) => {
      if (e.name === 'checkout.completed') {
        emitter.current?.emit(e.name, e.data);
      }
      if (e.name === 'checkout.closed') {
        emitter.current?.emit(e.name, undefined);
      }
      if (e.name === 'checkout.loaded') {
        emitter.current?.emit(e.name, undefined);
      }
    },
    [emitter]
  );

  // Download and initialize Paddle instance from CDN
  useEffect(() => {
    if (env.NEXT_PUBLIC_PADDLE_TOKEN) {
      emitter.current = new EventEmitter<{
        'checkout.completed': CheckoutEventsData | undefined;
        'checkout.closed': undefined;
        'checkout.loaded': undefined;
      }>();
      const pwCustomer = currentUser
        ? currentUser.paddleCustomerId
          ? { id: currentUser.paddleCustomerId }
          : { email: currentUser.email }
        : {};
      initializePaddle({
        environment: isDev ? 'sandbox' : 'production',
        token: env.NEXT_PUBLIC_PADDLE_TOKEN,
        eventCallback,
        pwCustomer,
        checkout: {
          settings: {
            theme: 'dark',
            allowLogout: false,
          },
        },
      }).then((paddleInstance: Paddle | undefined) => {
        if (paddleInstance) {
          setPaddle(paddleInstance);
        }
      });
    }
  }, [currentUser, eventCallback]);

  return (
    <PaddleContext.Provider
      value={{
        paddle: paddle as Paddle,
        emitter: emitter.current as EventEmitter<PaddleEventEmitter>,
      }}
    >
      {children}
    </PaddleContext.Provider>
  );
}
