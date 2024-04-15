import { MetricReader } from "$otel/sdk-metrics";
import { Router } from 'express';

import {
  BuildInfo,
  amLogger,
  recordBuildInfo,
  registerExporter,
} from "../../mod.ts";
import { MassivePrometheusExporter } from "./MassivePrometheusExporter";

let metricReader: MetricReader | undefined;

export type InitOptions = {
  /**
   * Optional build info to be added to the `build_info` metric.
   */
  buildInfo?: BuildInfo;

  /**
   * Hostname or IP address on which to listen.
   *
   * @default '0.0.0.0'
   */
  hostname?: string;

  /**
   * Port on which to open the Prometheus scrape endpoint (default: 9464).
   */
  port?: number;

  tenantId?: string;
  router?: Router;
  routePath? :string;
};

/**
 * Initializes and registers the Prometheus exporter for Autometrics.
 *
 * This opens up a webserver with the `/metrics` endpoint, to be scraped by
 * Prometheus.
 */
export function init({
  buildInfo = {},
  hostname = "0.0.0.0",
  port = 9464,
  tenantId,
  router,
  routePath = '/metrics',
}: InitOptions = {}) {
  if (metricReader) {
    throw new Error(
      "Prometheus exporter is already running. You might have called `init()` " +
        "more than once.",
    );
  }

  if (!tenantId && !process.env.MASSIVE_TENANT_ID) {
      amLogger.trace('No environment variable defined for {MASSIVE_TENANT_ID}. This is a required parameter so that we can identify you.');
      return;
    }

  if (router) {
    amLogger.info(`Opening a Prometheus scrape endpoint at route /metrics`);
    metricReader = new MassivePrometheusExporter({ router, routePath, tenantId });
  }
  else {
    amLogger.info(`Opening a Prometheus scrape endpoint at port ${port}`);
    metricReader = new MassivePrometheusExporter({ host: hostname, port, routePath, tenantId });
  }

  registerExporter({ metricReader });

  recordBuildInfo(buildInfo);
}

/**
 * Stops the built-in Prometheus exporter.
 */
export async function stop() {
  if (metricReader) {
    await metricReader.shutdown();
    metricReader = undefined;
  } else {
    amLogger.warn("Prometheus exporter already stopped or never started");
  }
}

export { MassivePrometheusExporter };
