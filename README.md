# Sample load tester with Playwright

This is not ready for production in any way, still need to pull out helper methods and set up more than one script, add pauses, etc.

## To set up

1. `npm install`
2. Copy `.env-sample` to `.env` and set proper Honeycomb API Key, change service name

## TO Run:

```
npm run load
```

## Other options

* Artillery with playwright runner - this didn't work for me
* Playwright runner config, kept getting "flaky" test results
