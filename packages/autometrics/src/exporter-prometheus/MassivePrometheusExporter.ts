/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Adapted from @opentelemetry/prometheus-exporter that uses native NodeJS codes
// https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-exporter-prometheus/src/PrometheusExporter.ts

import {
  Aggregation,
  AggregationTemporality,
  MetricReader,
} from "$otel/sdk-metrics";
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { Router, Request, Response } from 'express';

import { amLogger } from "../../mod.ts";
import { PrometheusSerializer } from "./PrometheusSerializer.ts";

const HEADERS = { "content-type": "text/plain" };

export interface ExporterConfig {
  /**
   * Hostname or IP address on which to listen.
   */
  host?: string;

  /**
   * Port number for Prometheus exporter server
   */
  port?: number;

  router?: Router;
  routePath?: string;
  tenantId?: string;
}

export class MassivePrometheusExporter extends MetricReader {
  private readonly _abortController: AbortController;
  private readonly _serializer: PrometheusSerializer;
  private _server: Server | undefined;

  // This will be required when histogram is implemented. Leaving here so it is not forgotten
  // Histogram cannot have a attribute named 'le'
  // private static readonly RESERVED_HISTOGRAM_LABEL = 'le';

  /**
   * Constructor
   * @param config Exporter configuration
   */
  constructor({ host, port, router, routePath, tenantId }: ExporterConfig) {
    super({
      aggregationSelector: (_instrumentType) => Aggregation.Default(),
      aggregationTemporalitySelector: (_instrumentType) =>
        AggregationTemporality.CUMULATIVE,
    });

    this._serializer = new PrometheusSerializer(undefined, false, tenantId);
    this._abortController = new AbortController();

    if (router) {
      this.initWithExpress({ router, routePath });
    }
    else {
      this.initWithDefaultServer({
        host,
        port,
        routePath
      });
    }
  }

  override async onForceFlush(): Promise<void> {
    /** do nothing */
  }

  /**
   * Shuts down the export server and clears the registry
   */
  override onShutdown(): Promise<void> {
    return this.stopServer();
  }

  /**
   * Stops the Prometheus export server
   */
  async stopServer(): Promise<void> {
    this._abortController.abort();
  }

  initWithDefaultServer({ host, port, routePath }: { host?: string; port?: number; routePath?: string; }) {
    const _metricsRoutePath = routePath || '/metrics';
    const metricsRoutePath = _metricsRoutePath.charAt(0) === '/' ? _metricsRoutePath : `/${_metricsRoutePath}`;

    const serializer = this._serializer;

    this._server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url !== `${metricsRoutePath}`) {
        res.statusCode = 404;
        res.end();
        return;
      }

      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain');
      this.collect().then(
        collectionResult => {
          const { resourceMetrics, errors } = collectionResult;
          if (errors.length) {
            amLogger.trace(
              'PrometheusExporter: metrics collection errors',
              ...errors
            );
          }
          res.end(serializer.serialize(resourceMetrics));
        },
        err => {
          res.end(`# failed to export metrics: ${err}`);
        }
      );
    });

    const serverPort = port || 9464;
    this._server.listen(
        {
          host,
          port: serverPort
        },
        () => {
          amLogger.debug(
              `Prometheus exporter server started: ${host}:${serverPort}${metricsRoutePath}`
          )
        }
    );
  }

  initWithExpress({ router, routePath }: { router: Router; routePath?: string; }) {
    const serializer = this._serializer;
    const path = routePath === undefined || routePath === null ? "/metrics": routePath;
    router.get(path.charAt(0) === '/' ? path : `/${path}`, async (_req: Request, res: Response) => {
      Object.entries(HEADERS).forEach(([headerKey, headerValue]) => {
        res.append(headerKey, headerValue);
      });

      try {
        const { resourceMetrics, errors } = await this.collect();
        if (errors.length) {
          amLogger.trace(
            "PrometheusExporter: metrics collection errors",
            ...errors,
          );
        }

        res.status(200).send(serializer.serialize(resourceMetrics));
      } catch (error) {
        res.status(500).send(`# failed to export metrics: ${error}`);
      }
    });

    amLogger.debug(
      `Prometheus exporter server started with Project's Express at route: /metrics`,
    );
  }
}
