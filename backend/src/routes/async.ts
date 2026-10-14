import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not catch rejected promises, so async handlers are wrapped
// and their errors handed to the error middleware in app.ts.
export function route(
  handler: (req: Request, res: Response) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}
