/**
 * ArchiAudit Pro - Authentication Service
 * Handles JWT authentication with main portal
 */

const MAIN_PORTAL = 'https://siliang.cfd';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.siliang.cfd/api/archiaudit';

/**
 * Get authentication token from localStorage or URL params
 */
export function getAuthToken(): string | null {
  // Try localStorage first (same-domain)
  const token = localStorage.getItem('auth_token');
  if (token) return token;

  // Try URL params (cross-domain navigation from dashboard)
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('auth_token');

  if (urlToken) {
    // Store in localStorage for future use
    localStorage.setItem('auth_token', urlToken);
    // Clean URL
    urlParams.delete('auth_token');
    const newUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    return urlToken;
  }

  return null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Redirect to main portal for login
 */
export function redirectToLogin(): void {
  window.location.href = `${MAIN_PORTAL}/index.html?from=archiaudit`;
}

/**
 * Verify token with backend
 */
export async function verifyAuth(): Promise<{ valid: boolean; user?: any }> {
  const token = getAuthToken();

  if (!token) {
    return { valid: false };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, user: data.user };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * Logout - clear token and redirect to main portal
 */
export function logout(): void {
  localStorage.removeItem('auth_token');
  redirectToLogin();
}
