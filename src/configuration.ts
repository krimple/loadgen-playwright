import {readFileSync} from "fs";

// Load config
const loadScript = readFileSync("load-script.json").toString();
export const loadInstructions = JSON.parse(loadScript);
export const BASE_URL =  loadInstructions.baseUrl;