<?php

declare(strict_types=1);

function security_csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return (string) $_SESSION['csrf_token'];
}

function security_verify_csrf(?string $token): bool
{
    $expected = $_SESSION['csrf_token'] ?? '';
    return is_string($expected) && $expected !== '' && is_string($token) && hash_equals($expected, $token);
}
