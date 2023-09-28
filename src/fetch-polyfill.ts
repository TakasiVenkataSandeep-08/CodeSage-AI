import fetch, { Headers, Request, Response } from "node-fetch";

if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = fetch;
  (globalThis as any).Headers = Headers;
  (globalThis as any).Request = Request;
  (globalThis as any).Response = Response;
}
