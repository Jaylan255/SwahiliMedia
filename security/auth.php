<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function security_admin_config(): array
{
    return [
        'username' => security_env('ADMIN_USERNAME'),
        'password_hash' => security_env('ADMIN_PASSWORD_HASH'),
        'totp_secret' => security_env('ADMIN_TOTP_SECRET'),
        'session_timeout' => (int) security_env('ADMIN_SESSION_TIMEOUT', '1800'),
    ];
}

function security_admin_is_configured(): bool
{
    $config = security_admin_config();

    return !empty($config['username']) && !empty($config['password_hash']) && !empty($config['totp_secret']);
}

function security_admin_touch_session(): void
{
    $_SESSION['admin_last_seen_at'] = time();
}

function security_admin_login(string $username): void
{
    session_regenerate_id(true);
    $_SESSION['admin_authenticated'] = true;
    $_SESSION['admin_username'] = $username;
    $_SESSION['admin_login_at'] = time();
    security_admin_touch_session();
}

function security_admin_logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool) $params['secure'], (bool) $params['httponly']);
    }
    session_destroy();
}

function security_admin_has_valid_session(bool $touch = true): bool
{
    $config = security_admin_config();
    $authenticated = !empty($_SESSION['admin_authenticated']);
    $lastSeen = (int) ($_SESSION['admin_last_seen_at'] ?? 0);
    $timeout = max(300, (int) ($config['session_timeout'] ?? 1800));

    if (!$authenticated || ($lastSeen > 0 && (time() - $lastSeen) > $timeout)) {
        security_admin_logout();
        return false;
    }

    if ($touch) {
        security_admin_touch_session();
    }

    return true;
}

function security_require_admin(): void
{
    if (!security_admin_has_valid_session()) {
        header('Location: /swamedia2/admin/login.html', true, 302);
        exit;
    }
}
