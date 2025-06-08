import "@opentelemetry/auto-instrumentations-node/register";

import { fastify } from "fastify";
import { fastifyCors } from "@fastify/cors";
import { trace } from "@opentelemetry/api";
import { z } from "zod";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { db } from "../db/client.ts";
import { schema } from "../db/schema/index.ts";
import { randomUUID } from "node:crypto";
import { dispatchOrderCreated } from "../broker/messages/order-created.ts";

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.register(fastifyCors, {
  origin: "*",
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.get("/health", () => {
  return "OK";
});

app.post(
  "/orders",
  {
    schema: {
      body: z.object({
        amount: z.coerce.number(),
      }),
    },
  },
  async (request, reply) => {
    const { amount } = request.body;
    console.log("Creating an order with amount", amount);
    const orderId = randomUUID();
    const customerId = "5eb70ee8-f92c-4d5e-9848-f889b7ca2152";
    await db.insert(schema.orders).values({
      id: orderId,
      customerId,
      amount,
    });
    trace.getActiveSpan()?.setAttribute("order_id", orderId);
    dispatchOrderCreated({
      orderId,
      amount,
      customer: {
        id: customerId,
      },
    });
    return reply.status(201).send();
  }
);

app.listen({ host: "0.0.0.0", port: 3333 }).then(() => {
  console.log("[Orders] HTTP server running!");
});
