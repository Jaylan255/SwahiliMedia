<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/logger.php';
require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/csrf.php';
require_once __DIR__ . '/totp.php';

function security_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }

    return isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https';
}

function security_is_local_host(?string $host): bool
{
    $host = trim((string) $host);
    if ($host === '') {
        return false;
    }

    $normalizedHost = parse_url('http://' . $host, PHP_URL_HOST);
    if (!is_string($normalizedHost) || $normalizedHost === '') {
        $normalizedHost = $host;
    }

    $normalizedHost = strtolower(trim($normalizedHost, '[]'));
    return in_array($normalizedHost, ['localhost', '127.0.0.1', '0.0.0.0', '::1'], true)
        || preg_match('/^127\./', $normalizedHost) === 1;
}

function security_apply_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('X-Permitted-Cross-Domain-Policies: none');

    if (security_is_https()) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
    }
}

function security_redirect_to_https(): void
{
    $forceHttps = security_env('FORCE_HTTPS', '1') === '1';
    if (!$forceHttps || security_is_https()) {
        return;
    }

    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (security_is_local_host($host)) {
        return;
    }

    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    if ($host !== '') {
        header('Location: https://' . $host . $uri, true, 301);
        exit;
    }
}

function security_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('SWAMEDIASESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => security_is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', security_is_https() ? '1' : '0');
    ini_set('session.cookie_samesite', 'Strict');
    ini_set('session.use_strict_mode', '1');

    session_start();
}

function security_bootstrap(bool $requireSession = false): void
{
    security_redirect_to_https();
    security_apply_headers();

    if ($requireSession) {
        security_start_session();
        security_csrf_token();
    }
}
