/* eslint-disable jest/no-export */

import "jest-extended";

import Hapi from "@hapi/hapi";
import Joi, { Schema } from "joi";

import { plugin } from ".";

export const sendRequest = async (
  method: string,
  options: Record<string, any> = {},
) => {
  const server: Hapi.Server = new Hapi.Server({
    host: "localhost",
    port: 8000,
  });

  await server.register({
    // @ts-ignore
    options: {
      ...options,

      methods: [
        {
          async method() {
            return { data: [] };
          },
          name: "hello",
        },
        {
          async method(parameters) {
            return { data: { name: parameters.name } };
          },
          name: "joi",
          schema: Joi.object()
            .keys({
              name: Joi.string().required(),
            })
            .required(),
        },
      ],
    },
    plugin,
  });

  const response = await server.inject({
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
    method: "POST",
    payload: {
      id: Math.random().toString(36),
      jsonrpc: "2.0",
      method,
    },
    url: "/",
  });

  let { payload } = response;
  try {
    payload = JSON.parse(response.payload);
  } catch {
    //
  }

  return {
    headers: response.headers,
    payload,
    query: response.request.query,
    response,
  };
};

function expectPass(response, payload) {
  expect(response.statusCode).toBe(200);
  expect(payload.jsonrpc).toBe("2.0");
  expect(payload.result.data).toEqual([]);
}

function expectFail(response, payload, code, message) {
  expect(response.statusCode).toBe(200);
  expect(payload.jsonrpc).toBe("2.0");
  expect(payload.error.code).toBe(code);
  expect(payload.error.message).toBe(message);
}

test("should send a successful request", async () => {
  const { response, payload } = await sendRequest("hello");

  expectPass(response, payload);
});

test("should receive a response failure due to validation error", async () => {
  const { response, payload } = await sendRequest("joi", {
    processor: {
      schema: Joi.object().keys({
        id: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
        jsonrpc: Joi.string().allow("2.0").required(),
        method: Joi.string().required(),
        params: Joi.object(),
      }),
      validate(data: object, schema: Schema) {
        return schema.validate(data);
      },
    },
  });

  expectFail(
    response,
    payload,
    -32_602,
    'ValidationError: "value" is required',
  );
});
