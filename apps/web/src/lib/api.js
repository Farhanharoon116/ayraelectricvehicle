export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "ApiError";
    }
}
export async function fetchApi(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : endpoint;
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        credentials: "include",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new ApiError(res.status, data?.error || `Request failed with status ${res.status}`);
    }
    return data;
}
