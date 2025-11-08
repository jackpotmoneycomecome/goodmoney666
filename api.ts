// Define the base URL for the Cloud Run backend
const API_BASE_URL = "https://ichiban-backend-510223165951.us-central1.run.app";

/**
 * A generic API call utility to communicate with the backend.
 * It automatically handles JSON content type, includes credentials (cookies),
 * and provides standardized error handling.
 * @param endpoint The API endpoint to call (e.g., '/lottery-sets').
 * @param options Standard fetch options (method, body, etc.).
 * @returns The JSON response from the server, or undefined for no-content responses.
 */
export async function apiCall(endpoint: string, options: RequestInit = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            // Include credentials (like cookies) in requests for session management
            credentials: 'include', 
        });

        const contentType = response.headers.get("content-type");
        if (!response.ok) {
            let errorData = { message: `HTTP error! status: ${response.status}` };
            if (contentType && contentType.includes("application/json")) {
                errorData = await response.json();
            }
            // Use the message from the backend error response if available
            throw new Error(errorData.message || `API request to ${endpoint} failed`);
        }
        
        // Handle responses with no content (e.g., HTTP 204)
        if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
            return; 
        }
        
        return response.json();
    } catch (error) {
        console.error(`API Call Error to ${endpoint}:`, error);
        throw error; // Re-throw to be caught by the calling function
    }
}
