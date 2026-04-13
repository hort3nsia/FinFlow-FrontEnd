import { routes } from './app.routes';

describe('app routes', () => {
  it('defines public landing, guest auth, verify-email, protected app shell, and wildcard routes', () => {
    const landingRoute = routes.find((route) => route.path === '');
    const loginRoute = routes.find((route) => route.path === 'login');
    const registerRoute = routes.find((route) => route.path === 'register');
    const verifyEmailRoute = routes.find((route) => route.path === 'auth/verify-email');
    const appRoute = routes.find((route) => route.path === 'app');
    const wildcardRoute = routes.find((route) => route.path === '**');
    const dashboardChild = appRoute?.children?.find((route) => route.path === 'dashboard');

    expect(landingRoute).toBeDefined();
    expect(landingRoute?.canActivate).toBeUndefined();

    expect(loginRoute).toBeDefined();
    expect(loginRoute?.canActivate?.length).toBe(1);

    expect(registerRoute).toBeDefined();
    expect(registerRoute?.canActivate?.length).toBe(1);

    expect(verifyEmailRoute).toBeDefined();
    expect(verifyEmailRoute?.canActivate).toBeUndefined();

    expect(appRoute).toBeDefined();
    expect(appRoute?.canActivate?.length).toBe(2);
    expect(dashboardChild).toBeDefined();

    expect(wildcardRoute).toBeDefined();
  });
});
