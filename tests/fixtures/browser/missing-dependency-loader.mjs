// Simulate an absent package without modifying the installed node_modules.
export function resolve(specifier, context, nextResolve) {
  if (specifier === process.env.ANW_TEST_MISSING_PACKAGE) {
    const error = new Error(`Cannot find package '${specifier}' imported from ${context.parentURL}`);
    error.code = "ERR_MODULE_NOT_FOUND";
    throw error;
  }
  return nextResolve(specifier, context);
}
