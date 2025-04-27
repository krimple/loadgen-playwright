export {}



declare global {
      type NodeSDK = {
            shutdown: () => Promise<void>;
            start: () => void;
      }

      namespace NodeJS {
            interface Global {
                  sdk: NodeSDK | undefined
            }
      }

      const sdk: NodeSDK
}
