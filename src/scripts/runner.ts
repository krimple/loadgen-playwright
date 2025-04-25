import dotenv from "dotenv";
dotenv.config();

import { setupTracing } from "../tracing";
import path from "path";
import { selectBrowser } from "../utils";
import { BASE_URL, loadInstructions } from "./configuration";

console.log(`Starting load generation for: ${loadInstructions.name}`);

// Execute all actions
(async () => {
  const sdk = await setupTracing(); // Initialize OpenTelemetry SDK
  console.log("tracing loaded");
  for (const action of loadInstructions.actions) {
    console.log(
      `Executing action: ${action.name}, Script: ${action.script}, Workers: ${action.workers}`,
    );

    // Dynamically import the script
    const scriptPath = path.resolve(__dirname, action.script);
    const actionScript = await import(scriptPath);

    // Run with specified workers
    const workers = Array.from({ length: action.workers }, async (_, i) => {
      console.log(`Starting worker ${i + 1} for action: ${action.name}`);
      const stop = false;
      while (!stop) {
        try {
          await actionScript.run(BASE_URL);
        } catch (e) {
          console.log("Iteration failed. Continuing.");
        }
      }
    });

    // Wait for all workers to finish
    await Promise.all(workers);

    console.log(`Completed action: ${action.name}`);
  }
  // all scripts finished
  await sdk.shutdown();
})();
