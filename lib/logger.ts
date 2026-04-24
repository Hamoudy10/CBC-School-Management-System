// lib/logger.ts
// ============================================================
// Structured logging utility for production observability
// Replaces console.error/info/warn with structured JSON logs
// Compatible with Vercel, Datadog, Sentry, and log aggregation services
// ============================================================

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
    code?: string;
  };
  request?: {
    method?: string;
    url?: string;
    userAgent?: string;
    ip?: string;
    requestId?: string;
  };
  response?: {
    status?: number;
    duration?: number;
  };
  user?: {
    id?: string;
    role?: string;
    schoolId?: string;
  };
}

const ENVIRONMENT = process.env.NODE_ENV || "development";
const SERVICE_NAME = "cbc-school-management";

function formatLogEntry(entry: LogEntry): string {
  if (ENVIRONMENT === "production") {
    return JSON.stringify(entry);
  }

  // Development: human-readable format
  const parts = [
    `[${entry.timestamp}]`,
    `${entry.level.toUpperCase().padEnd(5)}`,
    `[${entry.service}]`,
    entry.message,
  ];

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context, null, 2));
  }

  if (entry.error) {
    parts.push(`Error: ${entry.error.message}`);
    if (entry.error.stack) {
      parts.push(entry.error.stack);
    }
  }

  return parts.join(" ");
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
  };

  if (context) {
    entry.context = context;
  }

  return entry;
}

// ============================================================
// Core logger
// ============================================================

export const logger = {
  debug(message: string, context?: LogContext) {
    const entry = createLogEntry("debug", message, context);
    // eslint-disable-next-line no-console
    console.debug(formatLogEntry(entry));
  },

  info(message: string, context?: LogContext) {
    const entry = createLogEntry("info", message, context);
    // eslint-disable-next-line no-console
    console.info(formatLogEntry(entry));
  },

  warn(message: string, context?: LogContext) {
    const entry = createLogEntry("warn", message, context);
    console.warn(formatLogEntry(entry));
  },

  error(message: string, context?: LogContext & { error?: Error }) {
    const { error, ...restContext } = context || {};
    const entry = createLogEntry("error", message, restContext);

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    console.error(formatLogEntry(entry));
  },

  fatal(message: string, context?: LogContext & { error?: Error }) {
    const { error, ...restContext } = context || {};
    const entry = createLogEntry("fatal", message, restContext);

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    console.error(formatLogEntry(entry));
  },
};

// ============================================================
// API request logger middleware
// ============================================================

export function createRequestLogger(routeName: string) {
  return {
    request(method: string, url: string, context?: LogContext) {
      logger.info(`${method} ${routeName}`, {
        request: { method, url },
        ...context,
      });
    },

    response(
      method: string,
      url: string,
      status: number,
      duration: number,
      context?: LogContext,
    ) {
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      const entry = createLogEntry(
        level as LogLevel,
        `${method} ${routeName} -> ${status}`,
        {
          request: { method, url },
          response: { status, duration },
          ...context,
        },
      );

      if (level === "error") {
        console.error(formatLogEntry(entry));
      } else if (level === "warn") {
        console.warn(formatLogEntry(entry));
      } else {
        // eslint-disable-next-line no-console
        console.info(formatLogEntry(entry));
      }
    },

    error(method: string, url: string, error: Error, context?: LogContext) {
      logger.error(`${method} ${routeName} failed`, {
        request: { method, url },
        error,
        ...context,
      });
    },
  };
}

// ============================================================
// Performance timer
// ============================================================

export function createTimer(label: string) {
  const start = performance.now();

  return {
    end(context?: LogContext) {
      const duration = Math.round(performance.now() - start);
      logger.info(`${label} completed`, {
        duration,
        durationMs: `${duration}ms`,
        ...context,
      });
      return duration;
    },

    error(error: Error, context?: LogContext) {
      const duration = Math.round(performance.now() - start);
      logger.error(`${label} failed`, {
        duration,
        durationMs: `${duration}ms`,
        error,
        ...context,
      });
    },
  };
}

// ============================================================
// Database query logger
// ============================================================

export function logDatabaseQuery(
  table: string,
  operation: string,
  duration: number,
  context?: LogContext,
) {
  const level = duration > 1000 ? "warn" : "info";
  logger[level as LogLevel](`${operation.toUpperCase()} ${table}`, {
    database: { table, operation, duration },
    durationMs: `${duration}ms`,
    slow: duration > 1000,
    ...context,
  });
}

// ============================================================
// Security event logger
// ============================================================

export function logSecurityEvent(
  event: string,
  context: LogContext & { userId?: string; ip?: string },
) {
  logger.warn(`Security: ${event}`, {
    security: { event },
    ...context,
  });
}
