# Sample load tester with Playwright

This is not ready for production in any way, still need to pull out helper methods and set up more than one script, add pauses, etc.

## To set up

1. `npm install`
2. Copy `.env-sample` to `.env` and set proper Honeycomb API Key, change service name

## To make your own tests

* Edit `load-script.json` to point to a script fashioned after `scripts/purchase-journey.ts`
* Add helpers to `helpers/action-helpers.ts` as needed

This is really not that novel, but it was useful for generating some load for me.

## Tips

* Use `page.pause()` to debug the page - couple it with setting `headless` to false in the helper so you can see your browsers when they execute
* Use `page.screenshot()` to capture screenshots of failures

## TO Run:

for a single process looping infinitely

```
npm run load
```

to generate some real load, install pm2:

```
brew install pm2
or
npm install -g pm2
```

and use:

```
pm2 start ./run.sh --name loadgen -i <number of processes>
# then kill it later with
pm2 kill
```
