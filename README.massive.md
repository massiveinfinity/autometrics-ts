# massive-slo

## Install

1. Install Autometrics main library

```sh
npm install @massiveinfinity/slo-autometrics
```
2. Install an Exporter

- For a pull Exporter (suitable with setup with `Express`)
```sh
npm install @massiveinfinity/slo-exporter-prometheus
```

- For a push Exporter (suitable for short-lived functions or Serverless)
```sh
npm install @massiveinfinity/slo-exporter-prometheus-push-gateway
```

## Examples

You can find more real-life code examples: [https://github.com/massiveinfinity/dso-slo-examples](https://github.com/massiveinfinity/dso-slo-examples)

### Server-side example

Import libraries and instrument your code using the `autometrics` wrapper.
`init()` function is called at the start of your app to set up a Prometheus scrape endpoint.

```ts
import { 
  autometrics, 
  ObjectivePercentile, 
  ObjectiveLatency, 
} from '@massiveinfinty/slo-autometrics';
import { init } from '@massiveinfinity/slo-exporter-prometheus';

// or you can Javascript require, e.g.
// const { autometrics } = require('@massiveinfinty/slo-autometrics');

init();

const yourFunctionWithMetrics = autometrics({
  functionName: 'yourFunction',
  objective: {
    name: 'api',
    successRate: ObjectivePercentile.P99,
    latency: [ObjectiveLatency.Ms250, ObjectivePercentile.P99],
  },
  async function yourFunction(anyParametersHere) {
    //...
  }
);

yourFunctionWithMetrics();
```

The default `init()` will start a second webserver with a path endpoint `/metrics` to display the Prometheus endpoint.

If you do not require another webserver and is using `Express`, you can reuse your own `Express` app via code example below:

```ts
const router = express.Router();
init({ router, routePath: '/metrics' });
app.use(router);
```

Additionally, you could protect the `/metrics` path with a Basic auth using `express-basic-auth` package

```ts
const router = express.Router();
init({ router, routePath: '/' });

const protectedRouter = express.Router();
protectedRouter.use(
  '/metrics',
  basicAuth({
    users: {
      admin: 'password'
    },
      challenge: true
  }),
  router
);

app.use(protectedRouter);
```

### Edge/Client side example

Import libraries and instrument your code using the `autometrics` wrapper.
`init()` function is called at the start of your app to set up a Prometheus scrape endpoint.

```ts
import { 
  autometrics, 
  ObjectivePercentile, 
  ObjectiveLatency, 
} from '@massiveinfinty/slo-autometrics';
import { init } from '@massiveinfinity/slo-exporter-prometheus-push-gateway';

// or you can Javascript require, e.g.
// const { autometrics } = require('@massiveinfinty/slo-autometrics');

const yourFunctionWithMetrics = autometrics({
    functionName: 'yourFunction',
    objective: {
      name: 'serverless-api',
      successRate: ObjectivePercentile.P99,
      latency: [ObjectiveLatency.Ms250, ObjectivePercentile.P99],
    }
  },
  async function yourFunction(anyParametersHere) {
    init({
      tenantId: '...',
      url: '...',
      headers: {
        'Content-Type': 'text/plain',
      },
    });
    
    // ...
  }
);

yourFunctionWithMetrics();
```

## API References

The documentation below is to highlight new parameters that the `massive-dso` team have added.

> Read original API Reference [here](./packages/lib/reference/README.md)

### `autometrics`

| Name | Type | Description |
| :------ | :------ | :------ |
| `monitorId*` | `string` | **This is a required parameter**. Get the value of your monitor from the DSOv3 Platform. |  
| `functionName?` | `string` | Name of your function. Only necessary if using the decorator/wrapper on the client side where builds get minified. |
| `moduleName?` | `string` | Name of the module (usually filename) |
| `objective?` | [`Objective`](README.md#objective) | Include this function's metrics in the specified objective or SLO. See the docs for [Objective](README.md#objective) for details on how to create objectives. |
| `recordErrorIf?` | `ReportErrorCondition`<`F`\> | A custom callback function that determines whether a function return should be considered an error by Autometrics. This may be most useful in top-level functions such as the HTTP handler which would catch any errors thrown called from inside the handler. **`Example`** ```typescript async function createUser(payload: User) { // ... } // This will record an error if the handler response status is 4xx or 5xx const recordErrorIf = (res) => res.status >= 400; app.post("/users", autometrics({ recordErrorIf }, createUser) ``` |
| `recordSuccessIf?` | `ReportSuccessCondition` | A custom callback function that determines whether a function result should be considered a success (regardless if it threw an error). This may be most useful when you want to ignore certain errors that are thrown by the function. |
| `trackConcurrency?` | `boolean` | Pass this argument to track the number of concurrent calls to the function (using a gauge). This may be most useful for top-level functions such as the main HTTP handler that passes requests off to other functions. (default: `false`) |

### `init` from `slo-exporter-prometheus`

| Name | Type | Description |
| :------ | :------ | :------ |
| `tenantId*` | `string` | **This is a required parameter**. Get the value of your monitor from the DSOv3 Platform.<br /><br />Alternatively you can use an environment variable `MASSIVE_TENANT_ID` without defining this variable |
| `router?` | `express.Router` | Specify this parameter if you would like to reuse your app's own Express app. That way the library will not create another webserver |
| `routePath` | `string` | Set a customized path of metrics if required |

### `init` from `slo-exporter-prometheus-push-gateway`

| Name | Type | Description |
| :------ | :------ | :------ |
| `tenantId*` | `string` | **This is a required parameter**. Get the value of your monitor from the DSOv3 Platform.<br /><br />Alternatively you can use an environment variable `MASSIVE_TENANT_ID` without defining this variable |
