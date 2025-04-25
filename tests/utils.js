module.exports = {
  // Wait for idle callback and some delay
  pause: async (page) => {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const delaytime = Math.random() * 3000;
        global.requestIdleCallback(
          () => {
            setTimeout(resolve, delaytime / 2);
          },
          { timeout: delaytime }
        );
      });
    });
  },
};
