/** Stable SDK error with a machine-readable code and the original cause. */
export class AutonomiError extends Error {
    code;
    constructor(code, message, cause) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = "AutonomiError";
        this.code = code;
    }
}
/** Upload failure with explicit recovery ownership and the original error code. */
export class UploadError extends AutonomiError {
    recovery;
    constructor(error, recovery) {
        super(error.code, error.message, error);
        this.name = "UploadError";
        this.recovery = recovery;
    }
}
export function errorMessage(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === "string")
        return error;
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
export function wrapError(code, context, error) {
    if (error instanceof AutonomiError)
        return error;
    return new AutonomiError(code, `${context}: ${errorMessage(error)}`, error);
}
//# sourceMappingURL=errors.js.map