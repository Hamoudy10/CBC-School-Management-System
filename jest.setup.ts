import "@testing-library/jest-dom";

// Polyfill Request/Response for NextRequest compat in tests
if (typeof globalThis.Request === "undefined") {
  class MockRequest {
    readonly headers = new Headers();
    readonly method = "GET";
    readonly url = "http://localhost";
    readonly body: ReadableStream | null = null;
    readonly bodyUsed = false;
    readonly cache = "default" as RequestCache;
    readonly credentials = "same-origin" as RequestCredentials;
    readonly destination = "";
    readonly integrity = "";
    readonly keepalive = false;
    readonly mode = "cors" as RequestMode;
    readonly redirect = "follow" as RequestRedirect;
    readonly referrer = "";
    readonly referrerPolicy = "" as ReferrerPolicy;
    readonly signal = new AbortController().signal;
    clone() { return this as unknown as Request; }
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
    blob() { return Promise.resolve(new Blob()); }
    formData() { return Promise.resolve(new FormData()); }
    json() { return Promise.resolve({}); }
    text() { return Promise.resolve(""); }
  }
  (globalThis as any).Request = MockRequest;
}
if (typeof globalThis.Response === "undefined") {
  class MockResponse {
    readonly headers = new Headers();
    readonly ok = true;
    readonly status = 200;
    readonly statusText = "OK";
    readonly url = "";
    readonly body: ReadableStream | null = null;
    readonly bodyUsed = false;
    readonly redirected = false;
    readonly type = "basic" as ResponseType;
    clone() { return this as unknown as Response; }
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
    blob() { return Promise.resolve(new Blob()); }
    formData() { return Promise.resolve(new FormData()); }
    json() { return Promise.resolve({}); }
    text() { return Promise.resolve(""); }
    static error() { return new MockResponse() as unknown as Response; }
    static redirect() { return new MockResponse() as unknown as Response; }
    static json() { return new MockResponse() as unknown as Response; }
  }
  (globalThis as any).Response = MockResponse;
}

jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    };
  },
  usePathname() {
    return "";
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("act("))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
