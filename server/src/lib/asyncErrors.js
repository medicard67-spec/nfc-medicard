// Express 4 does not notice when an async route handler throws (a failed
// upload, a bad date): the request is left without an answer and the app
// spins forever. This wraps every handler of a router so such an error goes
// to the error handler in index.js, which always answers.
export function catchAsyncErrors(router) {
  for (const layer of router.stack) {
    const handlers = layer.route ? layer.route.stack : [layer];
    for (const h of handlers) {
      const fn = h.handle;
      if (fn.length === 4 || fn.catchesAsync) continue; // error handlers stay as they are
      const wrapped = function (req, res, next) {
        try {
          const out = fn(req, res, next);
          if (out && typeof out.catch === "function") out.catch(next);
        } catch (err) {
          next(err);
        }
      };
      wrapped.catchesAsync = true;
      h.handle = wrapped;
    }
  }
  return router;
}
