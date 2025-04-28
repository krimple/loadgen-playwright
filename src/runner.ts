import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: '.env' });

import { BASE_URL, loadInstructions } from "./configuration";
import { setupTracing } from "./tracing";

console.log(`Starting load generation for: ${loadInstructions.name}`);

(async() => {
  await setupTracing();
})().then(() => {
  // Execute all actions
  (async () => {
    console.log("tracing loaded");
    for (const action of loadInstructions.actions) {
      console.log(
          `Executing action: ${action.name}, Script: ${action.script}, Workers: ${action.workers}`,
      );

      // Dynamically import the script
      const scriptPath = path.resolve(__dirname, action.script);
      const actionScript = await import(scriptPath);

      let isRunning = true;
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('Received SIGINT. Gracefully shutting down...');
        isRunning = false;
      });

      // Run with specified workers
      const workers = Array.from({ length: action.workers }, async (_, i) => {
        console.log(`Starting worker ${i + 1} for action: ${action.name}`);
        let consecutiveErrors = 0;
        const MAX_CONSECUTIVE_ERRORS = 3;
        
        while (isRunning) {
          try {
            await actionScript.run(BASE_URL);
            consecutiveErrors = 0; // Reset error count on success
          } catch (e) {
            consecutiveErrors++;
            console.error(`Worker ${i + 1} iteration failed:`, e);
            
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              console.error(`Worker ${i + 1} stopped: ${MAX_CONSECUTIVE_ERRORS} consecutive failures`);
              break;
            }
            
            // Add exponential backoff delay
            const delay = Math.min(1000 * Math.pow(2, consecutiveErrors), 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      });

      // Wait for all workers to finish
      await Promise.all(workers);

      console.log(`Completed action: ${action.name}`);
    }
    // all scripts finished
  })();

});

