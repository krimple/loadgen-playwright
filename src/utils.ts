import { chromium, firefox, webkit } from 'playwright';

// Define available browsers
const browsers = [chromium, firefox, webkit];
const browserNames = ['chromium', 'firefox', 'webkit'];

export const  selectBrowser = () => {
  // Randomly select one of the available browsers
  const randomIndex = Math.floor(Math.random() * browsers.length);
  return {
    browser: browsers[randomIndex],
    name: browserNames[randomIndex]
  };
}






