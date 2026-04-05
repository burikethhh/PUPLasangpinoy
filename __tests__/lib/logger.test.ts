import {
    clearLogs,
    createLogger,
    getErrorLogs,
    getLogCount,
    getLogs
} from "../../lib/logger";

beforeEach(() => {
  clearLogs();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("createLogger", () => {
  it("returns a Logger with all four methods", () => {
    const log = createLogger("Test");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("log.info writes an entry at level=info", () => {
    const log = createLogger("ModA");
    log.info("hello world");
    const entries = getLogs();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("info");
    expect(entries[0].module).toBe("ModA");
    expect(entries[0].message).toBe("hello world");
  });

  it("log.debug writes an entry at level=debug", () => {
    const log = createLogger("ModB");
    log.debug("debugging");
    const entries = getLogs("debug");
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("debug");
  });

  it("log.warn writes an entry at level=warn", () => {
    const log = createLogger("ModC");
    log.warn("watch out");
    const entries = getLogs("warn");
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("warn");
  });

  it("log.error writes an entry at level=error", () => {
    const log = createLogger("ModD");
    log.error("something broke");
    const entries = getLogs("error");
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("error");
  });

  it("serializes Error objects into plain object with name/message/stack", () => {
    const log = createLogger("ModE");
    const err = new Error("boom");
    log.error("caught", err);
    const entry = getLogs("error")[0];
    const serialized = entry.data as any;
    expect(serialized.name).toBe("Error");
    expect(serialized.message).toBe("boom");
    expect(typeof serialized.stack).toBe("string");
  });

  it("entries include an ISO timestamp", () => {
    const log = createLogger("ModF");
    log.info("ts test");
    const entry = getLogs()[0];
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("stores data alongside message", () => {
    const log = createLogger("ModG");
    log.info("with data", { foo: "bar" });
    const entry = getLogs()[0];
    expect((entry.data as any).foo).toBe("bar");
  });
});

describe("getLogs", () => {
  it("returns all entries when no level filter", () => {
    const log = createLogger("Filter");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(getLogs()).toHaveLength(4);
  });

  it("filters by level correctly", () => {
    const log = createLogger("Filter2");
    log.debug("d");
    log.info("i");
    log.error("e");
    expect(getLogs("debug")).toHaveLength(1);
    expect(getLogs("info")).toHaveLength(1);
    expect(getLogs("error")).toHaveLength(1);
    expect(getLogs("warn")).toHaveLength(0);
  });

  it("returns a copy — mutations don't affect the buffer", () => {
    const log = createLogger("Copy");
    log.info("original");
    const copy = getLogs();
    copy.pop();
    expect(getLogs()).toHaveLength(1);
  });
});

describe("getErrorLogs", () => {
  it("returns only warn and error entries", () => {
    const log = createLogger("ErrFilter");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    const errorLogs = getErrorLogs();
    expect(errorLogs).toHaveLength(2);
    expect(errorLogs.every((e) => e.level === "warn" || e.level === "error")).toBe(true);
  });
});

describe("getLogCount", () => {
  it("returns total count with no filter", () => {
    const log = createLogger("Count");
    log.info("a");
    log.info("b");
    expect(getLogCount()).toBe(2);
  });

  it("returns filtered count by level", () => {
    const log = createLogger("Count2");
    log.error("e1");
    log.error("e2");
    log.warn("w1");
    expect(getLogCount("error")).toBe(2);
    expect(getLogCount("warn")).toBe(1);
  });
});

describe("clearLogs", () => {
  it("empties the buffer", () => {
    const log = createLogger("Clear");
    log.info("a");
    log.info("b");
    clearLogs();
    expect(getLogs()).toHaveLength(0);
    expect(getLogCount()).toBe(0);
  });
});

describe("buffer overflow", () => {
  it("keeps at most 200 entries (rolls over oldest)", () => {
    const log = createLogger("Overflow");
    for (let i = 0; i < 210; i++) {
      log.debug(`entry ${i}`);
    }
    const all = getLogs();
    expect(all.length).toBe(200);
    // First entry should be #10 (oldest 10 were dropped)
    expect(all[0].message).toBe("entry 10");
    // Last entry should be #209
    expect(all[all.length - 1].message).toBe("entry 209");
  });
});

describe("multiple modules", () => {
  it("tags entries with their respective module names", () => {
    const logA = createLogger("Alpha");
    const logB = createLogger("Beta");
    logA.info("from alpha");
    logB.info("from beta");
    const all = getLogs();
    expect(all.find((e) => e.module === "Alpha")?.message).toBe("from alpha");
    expect(all.find((e) => e.module === "Beta")?.message).toBe("from beta");
  });
});
