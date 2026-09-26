import { pool, executeInTransaction } from "./db.js";
import { config } from "./config.js";
import { log } from "./logger.js";
import { metricsCollector } from "./metrics.js";
import {
  type CheckoutRequest,
  type CheckoutResponse,
} from "@runsafe/shared";

export class CheckoutError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public errorCategory: string = "CHECKOUT_ERROR"
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export async function processCheckout(
  req: CheckoutRequest
): Promise<CheckoutResponse> {
  const reqId = req.syntheticRequestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();

  // Ambiguous fault injection (intermittent 503 / latency independent of replica or version)
  if (config.faultProfile === "ambiguous") {
    if (Math.random() < 0.5) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      metricsCollector.recordCheckout(false);
      log({
        level: "ERROR",
        message: "Ambiguous downstream payment gateway gateway timeout",
        requestId: reqId,
        route: "/checkout",
        status: 503,
        durationMs: Date.now() - startTime,
        errorCategory: "DOWNSTREAM_TIMEOUT",
        error: "Gateway timeout communicating with external merchant provider",
      });
      throw new CheckoutError(
        "Downstream merchant provider timeout (intermittent)",
        503,
        "DOWNSTREAM_TIMEOUT"
      );
    }
  }

  // Bad deployment fault injection (Hero scenario: V2 regression)
  const isV2BadDeployment =
    config.appVersion.startsWith("v2") ||
    config.faultProfile === "bad_deployment" ||
    config.faultProfile === "v2_regression";

  try {
    const result = await executeInTransaction(async (client) => {
      // 1. Select product with lock
      const productRes = await client.query(
        "SELECT id, name, price, stock, active FROM products WHERE id = $1 FOR UPDATE",
        [req.productId]
      );

      if (productRes.rows.length === 0) {
        throw new CheckoutError(`Product not found: ${req.productId}`, 404, "PRODUCT_NOT_FOUND");
      }

      const product = productRes.rows[0];
      if (!product.active) {
        throw new CheckoutError(`Product is inactive: ${req.productId}`, 400, "PRODUCT_INACTIVE");
      }

      if (product.stock < req.quantity) {
        throw new CheckoutError(
          `Insufficient stock for ${req.productId}. Available: ${product.stock}, requested: ${req.quantity}`,
          400,
          "INSUFFICIENT_STOCK"
        );
      }

      // 2. Trigger intentional V2 bad deployment fault
      if (isV2BadDeployment) {
        // Deterministic failure: all v2 transactions abort with serialization/schema regression
        throw new CheckoutError(
          "Database transaction aborted: inventory ledger reconciliation anomaly (v2.0.0 schema lock constraint)",
          500,
          "SCHEMA_REGRESSION"
        );
      }

      // 3. Normal business path: deduct stock & create order
      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [req.quantity, req.productId]
      );

      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const unitPrice = parseFloat(product.price);
      const total = parseFloat((unitPrice * req.quantity).toFixed(2));

      await client.query(
        `INSERT INTO orders (id, synthetic_request_id, status, total, version, replica_id)
         VALUES ($1, $2, 'COMPLETED', $3, $4, $5)`,
        [orderId, reqId, total, config.appVersion, config.replicaId]
      );

      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, req.productId, req.quantity, unitPrice]
      );

      return {
        orderId,
        productId: req.productId,
        quantity: req.quantity,
        total,
      };
    });

    const durationMs = Date.now() - startTime;
    metricsCollector.recordCheckout(true);

    log({
      level: "INFO",
      message: `Checkout successful for product ${req.productId}, order ${result.orderId}`,
      requestId: reqId,
      route: "/checkout",
      status: 200,
      durationMs,
      metadata: { orderId: result.orderId, total: result.total },
    });

    return {
      success: true,
      orderId: result.orderId,
      productId: result.productId,
      quantity: result.quantity,
      total: result.total,
      version: config.appVersion,
      replica: config.replicaId,
      environment: config.environment,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    metricsCollector.recordCheckout(false);

    const statusCode = err instanceof CheckoutError ? err.statusCode : 500;
    const errorCategory = err instanceof CheckoutError ? err.errorCategory : "INTERNAL_ERROR";
    const errorMessage = err.message || "An unexpected checkout error occurred";

    log({
      level: "ERROR",
      message: `Checkout failed: ${errorMessage}`,
      requestId: reqId,
      route: "/checkout",
      status: statusCode,
      durationMs,
      errorCategory,
      error: errorMessage,
    });

    if (err instanceof CheckoutError) {
      throw err;
    }
    throw new CheckoutError(errorMessage, statusCode, errorCategory);
  }
}
